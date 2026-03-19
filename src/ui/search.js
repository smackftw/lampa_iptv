import { epg }      from '../epg.js';
import { showCard } from './card.js';

export function showSearch(allChannels) {
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
