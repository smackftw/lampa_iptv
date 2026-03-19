/* Lampa IPTV Plugin v0.1.0 */
(function () {
  'use strict';

  function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // keep 32-bit
    }
    return Math.abs(hash).toString(36);
  }

  function parseM3U(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const channels = [];
    const groupSet = new Set();
    let playlistEpgUrl = null;

    if (lines[0] && lines[0].startsWith('#EXTM3U')) {
      const m = lines[0].match(/tvg-url="([^"]+)"/);
      if (m) playlistEpgUrl = m[1];
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#EXTINF:')) continue;

      const urlLine = lines[i + 1];
      if (!urlLine || urlLine.startsWith('#')) continue;

      const tvgId = (line.match(/tvg-id="([^"]*)"/)    || ['', ''])[1];
      const name  = (line.match(/,(.+)$/)               || ['', 'Unknown'])[1].trim();
      const logo  = (line.match(/tvg-logo="([^"]*)"/)   || ['', ''])[1];
      const group = (line.match(/group-title="([^"]*)"/)|| ['', 'Other'])[1];

      groupSet.add(group);
      const id = tvgId || djb2(name + urlLine);
      channels.push({ id, name, url: urlLine, logo, group, tvgId });
    }

    return { channels, groups: [...groupSet], playlistEpgUrl };
  }

  async function fetchM3U(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`M3U fetch failed: HTTP ${response.status}`);
    const text = await response.text();
    return parseM3U(text);
  }

  function parseXmltvDate(str) {
    if (!str) return null;
    // Format: YYYYMMDDHHmmss +HHMM
    const m = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{2})(\d{2})/);
    if (!m) return null;
    const [, yr, mo, dy, hr, mn, sc, tzH, tzM] = m;
    return new Date(`${yr}-${mo}-${dy}T${hr}:${mn}:${sc}${tzH}:${tzM}`);
  }

  function parseXMLTV(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const map = {};
    doc.querySelectorAll('programme').forEach(node => {
      const channelId = node.getAttribute('channel');
      const start = parseXmltvDate(node.getAttribute('start'));
      const stop  = parseXmltvDate(node.getAttribute('stop'));
      const title = node.querySelector('title')?.textContent || '';
      const desc  = node.querySelector('desc')?.textContent  || '';
      if (!channelId || !start) return;
      if (!map[channelId]) map[channelId] = [];
      map[channelId].push({ channelId, title, start, stop, desc });
    });
    Object.keys(map).forEach(id => map[id].sort((a, b) => a.start - b.start));
    return map;
  }

  let _programs = {};
  let _epgUrl   = null;

  const epg = {
    reset() {
      _programs = {};
      _epgUrl   = null;
    },

    // channels param reserved for future tvgId→channelId mapping
    init(channels, playlistEpgUrl, settingsEpgUrl) {
      _epgUrl = (settingsEpgUrl || '').trim() || (playlistEpgUrl || '').trim() || null;
    },

    async fetchInBackground() {
      if (!_epgUrl) return;
      try {
        const res = await fetch(_epgUrl);
        if (!res.ok) return;
        const text = await res.text();
        _programs = parseXMLTV(text);
        Lampa.Listener.send('liptv:epg_loaded', {});
      } catch (e) {
        console.warn('[lampa-iptv] EPG fetch failed:', e.message);
      }
    },

    getCurrent(channelId) {
      const list = _programs[channelId];
      if (!list) return null;
      const now = new Date();
      return list.find(p => p.start <= now && (!p.stop || p.stop > now)) || null;
    },

    getNext(channelId) {
      const list = _programs[channelId];
      if (!list) return null;
      const now = new Date();
      return list.find(p => p.start > now) || null;
    },

    getAll(channelId) {
      return _programs[channelId] || [];
    }
  };

  const DEFAULTS = {
    liptv_m3u_url:   '',
    liptv_epg_url:   '',
    liptv_view_mode: 'list',
    liptv_favorites: [],
    liptv_history:   [],
    liptv_blacklist: []
  };

  function get(key) { return Lampa.Storage.get(key, DEFAULTS[key]); }
  function set(key, val) { Lampa.Storage.set(key, val); }

  const storage = {
    getM3uUrl:  () => get('liptv_m3u_url'),
    setM3uUrl:  (v) => set('liptv_m3u_url', v),
    getEpgUrl:  () => get('liptv_epg_url'),
    setEpgUrl:  (v) => set('liptv_epg_url', v),
    getViewMode:() => get('liptv_view_mode'),
    setViewMode:(v) => set('liptv_view_mode', v),

    getFavorites:   () => get('liptv_favorites'),
    addFavorite:    (id) => { const f = get('liptv_favorites'); if (!f.includes(id)) set('liptv_favorites', [...f, id]); },
    removeFavorite: (id) => set('liptv_favorites', get('liptv_favorites').filter(x => x !== id)),
    isFavorite:     (id) => get('liptv_favorites').includes(id),

    getHistory: () => get('liptv_history'),
    addHistory: (id) => {
      let h = get('liptv_history').filter(x => x.id !== id);
      h.unshift({ id, ts: Date.now() });
      if (h.length > 100) h = h.slice(0, 100);
      set('liptv_history', h);
    },
    clearHistory: () => set('liptv_history', []),

    getBlacklist:    () => get('liptv_blacklist'),
    addBlacklist:    (id) => { const bl = get('liptv_blacklist'); if (!bl.includes(id)) set('liptv_blacklist', [...bl, id]); },
    removeBlacklist: (id) => set('liptv_blacklist', get('liptv_blacklist').filter(x => x !== id)),
    isBlacklisted:   (id) => get('liptv_blacklist').includes(id),
  };

  /**
   * Injects IPTV plugin CSS into the page <head>.
   * Called once on plugin init.
   */
  function injectStyles() {
    if (document.getElementById('liptv-styles')) return;

    var style = document.createElement('style');
    style.id = 'liptv-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  var CSS = '\
/* ── Layout ───────────────────────────────────── */\
.liptv-container {\
  width: 100%;\
  height: 100%;\
  overflow: hidden;\
}\
.liptv-wrap {\
  display: flex;\
  flex-direction: column;\
  height: 100%;\
}\
\
/* ── Toolbar ──────────────────────────────────── */\
.liptv-toolbar {\
  display: flex;\
  gap: 1em;\
  padding: 1em 1.5em 0.5em;\
  flex-shrink: 0;\
}\
.liptv-btn {\
  padding: 0.5em 1.2em;\
  border-radius: 0.5em;\
  background: rgba(255,255,255,0.08);\
  color: #fff;\
  font-size: 1em;\
  cursor: pointer;\
  white-space: nowrap;\
}\
.liptv-btn.focus {\
  background: rgba(255,255,255,0.28);\
  color: #fff;\
}\
\
/* ── Body: sidebar + channels ─────────────────── */\
.liptv-body {\
  display: flex;\
  flex: 1;\
  overflow: hidden;\
}\
\
/* ── Sidebar (groups) ─────────────────────────── */\
.liptv-sidebar {\
  width: 15em;\
  flex-shrink: 0;\
  overflow-y: auto;\
  padding: 0.5em 0 0.5em 1.5em;\
}\
.liptv-group {\
  padding: 0.5em 1em;\
  margin-bottom: 0.2em;\
  border-radius: 0.4em;\
  color: rgba(255,255,255,0.6);\
  font-size: 0.95em;\
  cursor: pointer;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
.liptv-group.active {\
  color: #fff;\
  background: rgba(255,255,255,0.1);\
}\
.liptv-group.focus {\
  color: #fff;\
  background: rgba(255,255,255,0.22);\
}\
\
/* ── Channel list (list mode) ─────────────────── */\
.liptv-channels {\
  flex: 1;\
  overflow-y: auto;\
  padding: 0.5em 1.5em 2em 1em;\
}\
.liptv-row {\
  display: flex;\
  align-items: center;\
  gap: 1em;\
  padding: 0.6em 1em;\
  margin-bottom: 0.2em;\
  border-radius: 0.5em;\
  cursor: pointer;\
}\
.liptv-row.focus {\
  background: rgba(255,255,255,0.15);\
}\
.liptv-logo {\
  width: 3.5em;\
  height: 3.5em;\
  object-fit: contain;\
  flex-shrink: 0;\
  border-radius: 0.3em;\
}\
.liptv-no-logo {\
  background: rgba(255,255,255,0.05);\
}\
.liptv-row-info {\
  flex: 1;\
  min-width: 0;\
}\
.liptv-row-name {\
  color: #fff;\
  font-size: 1.05em;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
.liptv-row-prog {\
  color: rgba(255,255,255,0.45);\
  font-size: 0.85em;\
  margin-top: 0.15em;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
\
/* ── Channel grid (grid mode) ─────────────────── */\
.liptv-channels.grid {\
  display: flex;\
  flex-wrap: wrap;\
  gap: 1em;\
  align-content: flex-start;\
}\
.liptv-tile {\
  width: 8em;\
  display: flex;\
  flex-direction: column;\
  align-items: center;\
  padding: 0.8em;\
  border-radius: 0.5em;\
  cursor: pointer;\
}\
.liptv-tile.focus {\
  background: rgba(255,255,255,0.15);\
}\
.liptv-tile .liptv-logo {\
  width: 5em;\
  height: 5em;\
  margin-bottom: 0.4em;\
}\
.liptv-tile-name {\
  color: #fff;\
  font-size: 0.85em;\
  text-align: center;\
  max-width: 100%;\
  overflow: hidden;\
  text-overflow: ellipsis;\
  white-space: nowrap;\
}\
\
/* ── Empty state ──────────────────────────────── */\
.liptv-empty {\
  color: rgba(255,255,255,0.4);\
  font-size: 1.1em;\
  padding: 3em 1em;\
  text-align: center;\
}\
';

  const VIRTUAL_GROUPS = ['Все', 'Избранное', 'История'];

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function createMainScreen(allChannels, onChannelSelect) {
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

      body.find('[data-group]').on('hover:enter', function() {
        currentGroup = $(this).data('group');
        render(body);
      });

      body.find('[data-action="toggle"]').on('hover:enter', function() {
        viewMode = viewMode === 'list' ? 'grid' : 'list';
        storage.setViewMode(viewMode);
        render(body);
      });

      body.find('[data-action="search"]').on('hover:enter', function() {
        onChannelSelect(null, 'search');
      });

      body.find('[data-id]').on('hover:enter', function() {
        const id = $(this).data('id');
        const ch = allChannels.find(function(c) { return c.id === id; });
        if (ch) onChannelSelect(ch, 'card');
      });

      // Activate Lampa navigation on .selector elements
      Lampa.Controller.toggle('content');
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

  function fmt(date) {
    if (!date) return '';
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function showEpgScreen(channel) {
    const programs = epg.getAll(channel.id);
    if (programs.length === 0) {
      Lampa.Noty.show('Программа передач недоступна');
      return;
    }

    const now = new Date();
    Lampa.Select.show({
      title:    channel.name + ' — Программа',
      items:    programs.map(function(p) {
        return {
          title:    fmt(p.start) + '–' + fmt(p.stop) + '  ' + p.title,
          subtitle: p.desc || '',
          selected: p.start <= now && (!p.stop || p.stop > now)
        };
      }),
      onSelect: function() {} // read-only; close on select is default Lampa.Select behavior
    });
  }

  function showCard(channel, onClose) {
    const cur    = epg.getCurrent(channel.id);
    const next   = epg.getNext(channel.id);
    const isFav  = storage.isFavorite(channel.id);

    // Store action fn directly on each item; Lampa.Select.show onSelect passes only (item)
    const actionItems = [
      { title: '▶ Смотреть',
        fn: function() { playChannel(channel); } },
      { title: isFav ? '★ Убрать из избранного' : '☆ В избранное',
        fn: function() { toggleFav(channel); if (onClose) onClose(); } },
      { title: '📋 Программа',
        fn: function() { showEpgScreen(channel); } },
      { title: '🚫 Скрыть',
        fn: function() { storage.addBlacklist(channel.id); Lampa.Noty.show('"' + channel.name + '" скрыт'); if (onClose) onClose(); } }
    ];

    Lampa.Select.show({
      title: channel.name,
      items: [
        { title: cur  ? 'Сейчас: ' + cur.title  : 'Сейчас: —',  noclick: true },
        { title: next ? 'Далее: '  + next.title : 'Далее: —',   noclick: true },
        { separator: true }
      ].concat(actionItems),
      onSelect: function(item) {
        if (typeof item.fn === 'function') item.fn();
      }
    });
  }

  function playChannel(channel) {
    Lampa.Player.play({ url: channel.url, title: channel.name, iptv: true });
  }

  function toggleFav(channel) {
    if (storage.isFavorite(channel.id)) {
      storage.removeFavorite(channel.id);
      Lampa.Noty.show('Удалено из избранного');
    } else {
      storage.addFavorite(channel.id);
      Lampa.Noty.show('Добавлено в избранное');
    }
  }

  function showSearch(allChannels) {
    // Lampa.Keypad is the documented API for text input.
    // Falls back to a simple prompt for environments where Keypad is unavailable.
    if (Lampa.Keypad && typeof Lampa.Keypad.show === 'function') {
      Lampa.Keypad.show({
        title:   'Поиск',
        value:   '',
        confirm: function(query) { doSearch(query, allChannels); }
      });
    } else {
      // Minimal fallback: browser prompt (web preview / desktop testing)
      const query = window.prompt('Поиск (название канала или передачи):');
      if (query) doSearch(query, allChannels);
    }
  }

  function doSearch(query, allChannels) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return;

    const byName    = allChannels.filter(function(ch) { return ch.name.toLowerCase().includes(q); });
    const nameIds   = new Set(byName.map(function(ch) { return ch.id; }));
    const byProg    = allChannels.filter(function(ch) {
      return !nameIds.has(ch.id) &&
        epg.getAll(ch.id).some(function(p) { return p.title.toLowerCase().includes(q); });
    });
    const results = byName.concat(byProg);

    if (results.length === 0) {
      Lampa.Noty.show('Ничего не найдено');
      return;
    }

    Lampa.Select.show({
      title:    'Результаты (' + results.length + ')',
      items:    results.map(function(ch) {
        const cur = epg.getCurrent(ch.id);
        return { title: ch.name, subtitle: cur ? cur.title : '', channel: ch };
      }),
      onSelect: function(item) { showCard(item.channel, function() {}); }
    });
  }

  function promptUrl(title, current, callback) {
    if (window.Lampa && Lampa.Keypad && typeof Lampa.Keypad.show === 'function') {
      Lampa.Keypad.show({
        title:   title,
        value:   current,
        confirm: callback
      });
    } else {
      const val = window.prompt(title + ':', current);
      if (val !== null) callback(val);
    }
  }

  function registerSettings(onM3uChange) {
    Lampa.SettingsApi.addComponent({
      component: 'liptv',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>',
      name: 'IPTV'
    });

    Lampa.SettingsApi.addParam({
      component: 'liptv',
      param:  { name: 'liptv_m3u_url', type: 'trigger', default: false },
      field:  { name: 'M3U URL', description: storage.getM3uUrl() || 'Не задан' },
      onChange: function() {
        promptUrl('M3U URL', storage.getM3uUrl() || '', function(v) {
          v = v.trim();
          storage.setM3uUrl(v);
          if (typeof onM3uChange === 'function') onM3uChange(v);
        });
      }
    });

    Lampa.SettingsApi.addParam({
      component: 'liptv',
      param:  { name: 'liptv_epg_url', type: 'trigger', default: false },
      field:  { name: 'EPG URL (XMLTV)', description: storage.getEpgUrl() || 'Не задан' },
      onChange: function() {
        promptUrl('EPG URL', storage.getEpgUrl() || '', function(v) {
          storage.setEpgUrl(v.trim());
        });
      }
    });

    Lampa.SettingsApi.addParam({
      component: 'liptv',
      param: {
        name:    'liptv_view_mode',
        type:    'select',
        values:  { list: 'Список', grid: 'Сетка' },
        default: 'list'
      },
      field:    { name: 'Режим отображения' },
      onChange: function(e) { storage.setViewMode(e.value || 'list'); }
    });

    Lampa.SettingsApi.addParam({
      component: 'liptv',
      param:    { name: 'liptv_hidden', type: 'trigger', default: false },
      field:    { name: 'Скрытые каналы', description: 'Каналы, убранные из списка' },
      onChange: function() { showHiddenChannels(); }
    });

    Lampa.SettingsApi.addParam({
      component: 'liptv',
      param:    { name: 'liptv_clear_history', type: 'trigger', default: false },
      field:    { name: 'Очистить историю просмотров' },
      onChange: function() {
        storage.clearHistory();
        Lampa.Noty.show('История очищена');
      }
    });
  }

  let _channelMap = {};
  function setChannelMap(map) { _channelMap = map; }

  function showHiddenChannels() {
    const blacklist = storage.getBlacklist();
    if (blacklist.length === 0) {
      Lampa.Noty.show('Нет скрытых каналов');
      return;
    }

    Lampa.Select.show({
      title: 'Скрытые каналы',
      items: blacklist.map(function(id) {
        return { title: _channelMap[id] || id, subtitle: 'Нажмите для восстановления', id: id };
      }),
      onSelect: function(item) {
        storage.removeBlacklist(item.id);
        Lampa.Noty.show('Канал "' + item.title + '" восстановлен');
      }
    });
  }

  (function() {

    let historyTimer  = null;
    let _mainScreen   = null;
    let _body         = null;
    let _channels     = [];   // current channel list — used by player history tracking

    function startHistoryTracking(channelId) {
      clearTimeout(historyTimer);
      historyTimer = setTimeout(function() { storage.addHistory(channelId); }, 10000);
    }

    function stopHistoryTracking() {
      clearTimeout(historyTimer);
      historyTimer = null;
    }

    // Called on first launch and whenever M3U URL changes via settings.
    // Fetches playlist, (re)builds the main screen, starts EPG in background.
    async function loadAndRender() {
      const m3uUrl = storage.getM3uUrl();

      if (!m3uUrl) {
        Lampa.Noty.show('IPTV: укажите M3U URL в настройках');
        Lampa.Activity.push({ component: 'settings', url: '', title: 'Настройки' });
        return;
      }

      let parsed;
      try {
        parsed = await fetchM3U(m3uUrl);
      } catch (e) {
        // TODO (v0.2.0): replace with error screen + "Повторить" button (Known Gap)
        Lampa.Noty.show('Не удалось загрузить плейлист: ' + e.message, { style: 'error', time: 5000 });
        return;
      }

      const channels       = parsed.channels;
      const playlistEpgUrl = parsed.playlistEpgUrl;

      _channels = channels;

      const channelMap = {};
      channels.forEach(function(ch) { channelMap[ch.id] = ch.name; });
      setChannelMap(channelMap);

      // Clean up previous main screen listener before creating a new one
      if (_mainScreen) _mainScreen.destroy();

      _mainScreen = createMainScreen(channels, function(channel, action) {
        if (action === 'search') return showSearch(channels);
        if (action === 'card')   return showCard(channel, function() { if (_body && _mainScreen) _mainScreen.render(_body); });
      });

      if (_body) _mainScreen.render(_body);

      // Start EPG fetch in background — does not block rendering
      epg.reset();
      epg.init(channels, playlistEpgUrl, storage.getEpgUrl());
      epg.fetchInBackground();
    }

    function init() {
      injectStyles();

      // Register component once — create() and destroy() called by Lampa lifecycle
      class LiptvMain {
        constructor(object) { this.activity = object; }
        render() {
          this.html = $('<div class="liptv-container"></div>');
          _body = this.html;
          loadAndRender();
          return this.html[0];
        }
        create()  { return this.render(); }
        start()   {}
        pause()   {}
        stop()    {}
        destroy() {
          stopHistoryTracking();
          if (_mainScreen) { _mainScreen.destroy(); _mainScreen = null; }
          _body = null;
        }
      }
      Lampa.Component.add('liptv_main', LiptvMain);

      // Register player listeners once — use _channels closure for lookup
      Lampa.Player.listener.follow('start', function(e) {
        const url = e && e.data && e.data.url;
        if (!url) return;
        const ch = _channels.find(function(c) { return c.url === url; });
        if (ch) startHistoryTracking(ch.id);
      });
      Lampa.Player.listener.follow('destroy', stopHistoryTracking);

      // Re-render when user updates M3U URL in settings
      registerSettings(function() { loadAndRender(); });

      // Add IPTV item to the left sidebar menu
      var menuIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>';
      var menuItem = $('<li class="menu__item selector" data-action="liptv">' +
        '<div class="menu__ico">' + menuIcon + '</div>' +
        '<div class="menu__text">IPTV</div>' +
        '</li>');

      menuItem.on('hover:enter', function() {
        Lampa.Activity.push({ component: 'liptv_main', url: '', title: 'IPTV' });
      });

      // Insert before Settings item if found, otherwise append to end
      var settingsItem = $('.menu .menu__list .menu__item[data-action="settings"]');
      if (settingsItem.length) {
        settingsItem.before(menuItem);
      } else {
        $('.menu .menu__list').eq(0).append(menuItem);
      }

      Lampa.Activity.push({ component: 'liptv_main', url: '', title: 'IPTV' });
    }

    // Verified init pattern from docs/lampa-api-notes.md
    if (window.appready) {
      init();
    } else {
      Lampa.Listener.follow('app', function(e) {
        if (e.type === 'ready') init();
      });
    }
  })();

})();
