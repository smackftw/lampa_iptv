import { storage } from '../storage.js';

export function registerSettings(onM3uChange) {
  Lampa.SettingsApi.addComponent({
    component: 'liptv',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>',
    name: 'IPTV'
  });

  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param: { name: 'liptv_m3u_url', type: 'input', default: '' },
    field: { name: 'M3U URL', description: 'Ссылка на M3U плейлист' },
    onChange: function(e) {
      const v = e.value || '';
      storage.setM3uUrl(v);
      if (typeof onM3uChange === 'function') onM3uChange(v);
    }
  });

  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param: { name: 'liptv_epg_url', type: 'input', default: '' },
    field: { name: 'EPG URL (XMLTV)', description: 'Необязательно — отдельная программа передач' },
    onChange: function(e) { storage.setEpgUrl(e.value || ''); }
  });

  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param: {
      name: 'liptv_view_mode',
      type: 'select',
      values: { list: 'Список', grid: 'Сетка' },
      default: 'list'
    },
    field: { name: 'Режим отображения' },
    onChange: function(e) { storage.setViewMode(e.value || 'list'); }
  });

  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param: { name: 'liptv_hidden', type: 'trigger', default: false },
    field: { name: 'Скрытые каналы', description: 'Каналы, убранные из списка' },
    onChange: function() { showHiddenChannels(); }
  });

  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param: { name: 'liptv_clear_history', type: 'trigger', default: false },
    field: { name: 'Очистить историю просмотров' },
    onChange: function() {
      storage.clearHistory();
      Lampa.Noty.show('История очищена');
    }
  });
}

// id -> name map for display in hidden channels list; set from index.js after M3U loads
let _channelMap = {};
export function setChannelMap(map) { _channelMap = map; }

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
