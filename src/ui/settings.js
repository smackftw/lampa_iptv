import { storage } from '../storage.js';
import { EPG_PRESETS } from '../epg-sources.js';

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

export function registerSettings(onM3uChange, onEpgChange) {
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

  // Build values object for select from EPG_PRESETS
  var epgValues = {};
  Object.keys(EPG_PRESETS).forEach(function(key) {
    epgValues[key] = EPG_PRESETS[key].label;
  });

  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param: {
      name:    'liptv_epg_source',
      type:    'select',
      values:  epgValues,
      default: 'auto'
    },
    field:    { name: 'Источник EPG' },
    onChange: function() {
      if (typeof onEpgChange === 'function') onEpgChange();
    }
  });

  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param:  { name: 'liptv_epg_url', type: 'trigger', default: false },
    field:  { name: 'EPG URL (свой)', description: storage.getEpgUrl() || 'Не задан' },
    onChange: function() {
      if (storage.getEpgSource() !== 'custom') {
        Lampa.Noty.show('Выберите "Свой URL" в источнике EPG');
        return;
      }
      promptUrl('EPG URL', storage.getEpgUrl() || '', function(v) {
        storage.setEpgUrl(v.trim());
        if (typeof onEpgChange === 'function') onEpgChange();
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
    onChange: function() { /* Lampa stores select value automatically */ }
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
