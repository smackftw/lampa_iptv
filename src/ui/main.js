import { storage } from '../storage.js';
import { epg }     from '../epg.js';

const VIRTUAL_GROUPS = ['Все', 'Избранное', 'История'];

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createMainScreen(allChannels, onChannelSelect) {
  let currentGroup = 'Все';
  let viewMode     = storage.getViewMode();

  const groups = VIRTUAL_GROUPS.concat(
    [...new Set(allChannels.map(function(ch) { return ch.group; }))].filter(Boolean)
  );

  function getVisible() {
    const blacklist = storage.getBlacklist();
    let list = allChannels.filter(function(ch) { return !blacklist.includes(ch.id); });

    if (currentGroup === 'Избранное') {
      const favs = storage.getFavorites();
      list = list.filter(function(ch) { return favs.includes(ch.id); });
    } else if (currentGroup === 'История') {
      const history = storage.getHistory();
      const rank = {};
      history.forEach(function(h, i) { rank[h.id] = i; });
      list = list
        .filter(function(ch) { return ch.id in rank; })
        .sort(function(a, b) { return rank[a.id] - rank[b.id]; });
    } else if (currentGroup !== 'Все') {
      list = list.filter(function(ch) { return ch.group === currentGroup; });
    }
    return list;
  }

  function channelHtml(ch) {
    const cur  = epg.getCurrent(ch.id);
    const prog = cur ? esc(cur.title) : '';
    const logo = ch.logo
      ? '<img class="liptv-logo" src="' + esc(ch.logo) + '" onerror="this.style.display=\'none\'">'
      : '<div class="liptv-logo liptv-no-logo"></div>';

    if (viewMode === 'grid') {
      return '<div class="liptv-tile selector" data-id="' + esc(ch.id) + '">'
        + logo
        + '<div class="liptv-tile-name">' + esc(ch.name) + '</div>'
        + '</div>';
    }
    return '<div class="liptv-row selector" data-id="' + esc(ch.id) + '">'
      + logo
      + '<div class="liptv-row-info">'
      + '<div class="liptv-row-name">' + esc(ch.name) + '</div>'
      + '<div class="liptv-row-prog">' + prog + '</div>'
      + '</div>'
      + '</div>';
  }

  function render(body) {
    const visible    = getVisible();
    const groupsHtml = groups.map(function(g) {
      return '<div class="liptv-group selector' + (g === currentGroup ? ' active' : '') + '" data-group="' + esc(g) + '">' + esc(g) + '</div>';
    }).join('');
    const channelsHtml = visible.length
      ? visible.map(channelHtml).join('')
      : '<div class="liptv-empty">Нет каналов</div>';

    body.empty().append(
      '<div class="liptv-wrap">'
        + '<div class="liptv-toolbar">'
        + '<div class="liptv-btn selector" data-action="search">Поиск</div>'
        + '<div class="liptv-btn selector" data-action="toggle">'
        + (viewMode === 'list' ? '⊞ Сетка' : '☰ Список')
        + '</div>'
        + '</div>'
        + '<div class="liptv-body">'
        + '<div class="liptv-sidebar">' + groupsHtml + '</div>'
        + '<div class="liptv-channels ' + viewMode + '">' + channelsHtml + '</div>'
        + '</div>'
        + '</div>'
    );

    body.find('[data-group]').on('click', function() {
      currentGroup = $(this).data('group');
      render(body);
    });

    body.find('[data-action="toggle"]').on('click', function() {
      viewMode = viewMode === 'list' ? 'grid' : 'list';
      storage.setViewMode(viewMode);
      render(body);
    });

    body.find('[data-action="search"]').on('click', function() {
      onChannelSelect(null, 'search');
    });

    body.find('[data-id]').on('click', function() {
      const id = $(this).data('id');
      const ch = allChannels.find(function(c) { return c.id === id; });
      if (ch) onChannelSelect(ch, 'card');
    });
  }

  // Refresh EPG labels when data loads — keep named reference for cleanup
  function onEpgLoaded() {
    document.querySelectorAll('.liptv-row[data-id]').forEach(function(el) {
      const cur    = epg.getCurrent(el.dataset.id);
      const progEl = el.querySelector('.liptv-row-prog');
      if (progEl && cur) progEl.textContent = cur.title;
    });
  }
  Lampa.Listener.follow('liptv:epg_loaded', onEpgLoaded);

  return {
    render:  render,
    destroy: function() { Lampa.Listener.remove('liptv:epg_loaded'); }
  };
}
