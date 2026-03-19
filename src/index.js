import { fetchM3U }                        from './parser.js';
import { epg }                             from './epg.js';
import { storage }                         from './storage.js';
import { injectStyles }                    from './style.js';
import { createMainScreen }                from './ui/main.js';
import { showCard, playChannel, setOnPlay } from './ui/card.js';
import { showSearch }                      from './ui/search.js';
import { registerSettings, setChannelMap } from './ui/settings.js';
import { createOsd }                   from './ui/osd.js';

(function() {
  'use strict';

  let historyTimer    = null;
  let _mainScreen     = null;
  let _body           = null;
  let _channels       = [];   // current channel list — used by player history tracking
  let _currentPlayUrl = null; // URL of currently playing channel (for CH+/CH- switching)
  let _osd = null;

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

    // Track current playing channel immediately when playChannel() is called
    setOnPlay(function(channel) {
      _currentPlayUrl = channel.url;
      startHistoryTracking(channel.id);

      // Create OSD for player overlay
      if (_osd) _osd.destroy();
      var blacklist = storage.getBlacklist();
      var visible = _channels.filter(function(ch) { return !blacklist.includes(ch.id); });
      var idx = visible.findIndex(function(ch) { return ch.url === channel.url; });

      _osd = createOsd(visible, function(switchedChannel) {
        playChannel(switchedChannel);
      });
      if (idx >= 0) _osd.show(idx);
    });

    // Register player listeners once
    Lampa.Player.listener.follow('destroy', function() {
      stopHistoryTracking();
      _currentPlayUrl = null;
      if (_osd) { _osd.destroy(); _osd = null; }
    });

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
