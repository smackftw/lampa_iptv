import { storage }       from '../storage.js';
import { epg }           from '../epg.js';
import { showEpgScreen } from './epg-screen.js';

export function showCard(channel, onClose) {
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

var _onPlay = null;
export function setOnPlay(fn) { _onPlay = fn; }

export function playChannel(channel) {
  if (typeof _onPlay === 'function') _onPlay(channel);
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
