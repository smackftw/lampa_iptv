import { epg } from '../epg.js';

function fmt(date) {
  if (!date) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function showEpgScreen(channel) {
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
