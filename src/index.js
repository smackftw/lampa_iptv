import { fetchM3U }                        from './parser.js';
import { epg }                             from './epg.js';
import { storage }                         from './storage.js';
import { createMainScreen }                from './ui/main.js';
import { showCard }                        from './ui/card.js';
import { showSearch }                      from './ui/search.js';
import { registerSettings, setChannelMap } from './ui/settings.js';

(function() {
  'use strict';

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
    // Register component once — create() and destroy() called by Lampa lifecycle
    class LiptvMain {
      constructor(object) { this.activity = object; }
      create() {
        this.html = $('<div class="liptv-container"></div>');
        _body = this.html;
        loadAndRender();
        return this.html[0];
      }
      start()  {}
      pause()  {}
      stop()   {}
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
