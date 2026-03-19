import { epg } from '../epg.js';

var KEY = {
  CH_UP:   [166, 33],
  CH_DOWN: [167, 34],
  OK:      [13],
  BACK:    [8, 27],
  LEFT:    [37],
  UP:      [38],
  DOWN:    [40]
};

function isKey(keyCode, group) {
  return group.indexOf(keyCode) !== -1;
}

function formatTime(ts) {
  if (!ts) return '';
  var d = (ts instanceof Date) ? ts : new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
}

export function getNeighbors(channels, currentIndex) {
  var len = channels.length;
  if (len === 0) return [];

  var count = Math.min(5, len);
  var half  = Math.floor(count / 2);
  var result = [];

  for (var i = 0; i < count; i++) {
    var offset = i - half;
    var idx    = ((currentIndex + offset) % len + len) % len;
    result.push({
      channel:   channels[idx],
      index:     idx,
      isCurrent: idx === currentIndex
    });
  }

  return result;
}

function renderOsdHtml(neighbors) {
  var html = '';
  for (var i = 0; i < neighbors.length; i++) {
    var item = neighbors[i];
    var ch   = item.channel;
    var cls  = 'liptv-osd-item' + (item.isCurrent ? ' current' : '');
    var prog = '';

    if (item.isCurrent) {
      var cur = epg.getCurrent(ch.id);
      prog = cur ? cur.title : '';
    }

    html += '<div class="' + cls + '">' +
      '<span class="liptv-osd-num">' + (item.index + 1) + '</span>' +
      '<span class="liptv-osd-name">' + _esc(ch.name) + '</span>' +
      (prog ? '<span class="liptv-osd-prog">' + _esc(prog) + '</span>' : '') +
      '</div>';
  }
  return html;
}

function renderEpgHtml(channel) {
  var programs = epg.getAll(channel.id);
  if (programs.length === 0) {
    return '<div class="liptv-epg-title">' + _esc(channel.name) + '</div>' +
           '<div class="liptv-epg-empty">Нет данных о программе</div>';
  }

  var now  = Date.now();
  var html = '<div class="liptv-epg-title">' + _esc(channel.name) + '</div>';

  for (var i = 0; i < programs.length; i++) {
    var p         = programs[i];
    var startMs   = p.start ? p.start.getTime() : 0;
    var stopMs    = p.stop  ? p.stop.getTime()  : Infinity;
    var isCurrent = startMs <= now && now < stopMs;
    var isPast    = stopMs  <= now;

    var cls = 'liptv-epg-item';
    if (isPast)    cls += ' past';
    if (isCurrent) cls += ' now';

    var progress = '';
    if (isCurrent && p.stop && p.start) {
      var total = stopMs - startMs;
      var done  = now - startMs;
      var pct   = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
      progress  = '<div class="liptv-epg-progress">' +
                  '<div class="liptv-epg-progress-fill" style="width:' + pct + '%"></div>' +
                  '</div>';
    }

    var timeStr = formatTime(p.start) + (p.stop ? ' – ' + formatTime(p.stop) : '');
    if (isCurrent) timeStr += ' · Сейчас';

    html += '<div class="' + cls + '" data-epg-index="' + i + '">' +
      '<div class="liptv-epg-time">' + timeStr + '</div>' +
      '<div class="liptv-epg-prog-title">' + _esc(p.title) + '</div>' +
      progress +
      '</div>';
  }

  return html;
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createOsd(channels, onSwitch) {
  // Create DOM elements
  var osdEl = document.createElement('div');
  osdEl.className = 'liptv-osd';

  var epgEl = document.createElement('div');
  epgEl.className = 'liptv-epg';

  document.body.appendChild(osdEl);
  document.body.appendChild(epgEl);

  var _currentIndex = 0;
  var _hideTimer    = null;
  var _epgVisible   = false;
  var _osdVisible   = false;
  var _epgItems     = [];
  var _epgFocusIdx  = -1;

  // ── OSD ──────────────────────────────────────────────────────────────────

  function show(currentIndex) {
    _currentIndex = currentIndex;
    _resetTimer();
    _renderOsd();
    osdEl.classList.add('visible');
    osdEl.classList.remove('fade-out');
    _osdVisible = true;
  }

  function hide() {
    clearTimeout(_hideTimer);
    _hideTimer = null;
    osdEl.classList.remove('visible', 'fade-out');
    _osdVisible = false;
  }

  function _renderOsd() {
    var neighbors = getNeighbors(channels, _currentIndex);
    osdEl.innerHTML = renderOsdHtml(neighbors);
  }

  function _resetTimer() {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(function() {
      osdEl.classList.add('fade-out');
      setTimeout(function() {
        osdEl.classList.remove('visible', 'fade-out');
        _osdVisible = false;
      }, 350);
    }, 3000);
  }

  // ── EPG sidebar ───────────────────────────────────────────────────────────

  function showEpgSidebar(channel) {
    hide(); // hide OSD while EPG is open
    epgEl.innerHTML = renderEpgHtml(channel);
    epgEl.classList.add('visible');
    epgEl.classList.remove('hiding');
    _epgVisible  = true;
    _epgFocusIdx = -1;

    // Collect focusable items
    _epgItems = epgEl.querySelectorAll('.liptv-epg-item');

    // Auto-scroll to current program
    var nowItem = epgEl.querySelector('.liptv-epg-item.now');
    if (nowItem) {
      // Set focus on current program
      var items = Array.prototype.slice.call(_epgItems);
      _epgFocusIdx = items.indexOf(nowItem);
      nowItem.classList.add('focus');
      nowItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function hideEpgSidebar() {
    epgEl.classList.add('hiding');
    setTimeout(function() {
      epgEl.classList.remove('visible', 'hiding');
      _epgVisible  = false;
      _epgItems    = [];
      _epgFocusIdx = -1;
    }, 280);
  }

  // ── EPG navigation helpers ────────────────────────────────────────────────

  function _epgMoveFocus(direction) {
    var items = epgEl.querySelectorAll('.liptv-epg-item');
    if (items.length === 0) return;

    if (_epgFocusIdx >= 0 && _epgFocusIdx < items.length) {
      items[_epgFocusIdx].classList.remove('focus');
    }

    _epgFocusIdx += direction;
    if (_epgFocusIdx < 0)             _epgFocusIdx = 0;
    if (_epgFocusIdx >= items.length) _epgFocusIdx = items.length - 1;

    items[_epgFocusIdx].classList.add('focus');
    items[_epgFocusIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ── Channel switch helper ─────────────────────────────────────────────────

  function _switchChannel(direction) {
    var next = _currentIndex + direction;
    if (next >= channels.length) next = 0;
    if (next < 0)                next = channels.length - 1;
    _currentIndex = next;
    if (typeof onSwitch === 'function') onSwitch(channels[_currentIndex], _currentIndex);
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────

  function _onKeyDown(e) {
    var kc = e.keyCode;

    // Layer 3: EPG sidebar open
    if (_epgVisible) {
      if (isKey(kc, KEY.UP)) {
        e.preventDefault(); e.stopPropagation();
        _epgMoveFocus(-1);
        return;
      }
      if (isKey(kc, KEY.DOWN)) {
        e.preventDefault(); e.stopPropagation();
        _epgMoveFocus(1);
        return;
      }
      if (isKey(kc, KEY.LEFT) || isKey(kc, KEY.BACK)) {
        e.preventDefault(); e.stopPropagation();
        hideEpgSidebar();
        return;
      }
      if (isKey(kc, KEY.CH_UP)) {
        e.preventDefault(); e.stopPropagation();
        _switchChannel(1);
        showEpgSidebar(channels[_currentIndex]);
        return;
      }
      if (isKey(kc, KEY.CH_DOWN)) {
        e.preventDefault(); e.stopPropagation();
        _switchChannel(-1);
        showEpgSidebar(channels[_currentIndex]);
        return;
      }
      // All other keys pass through
      return;
    }

    // Layer 2: OSD visible
    if (_osdVisible) {
      if (isKey(kc, KEY.CH_UP)) {
        e.preventDefault(); e.stopPropagation();
        _switchChannel(1);
        show(_currentIndex);
        return;
      }
      if (isKey(kc, KEY.CH_DOWN)) {
        e.preventDefault(); e.stopPropagation();
        _switchChannel(-1);
        show(_currentIndex);
        return;
      }
      if (isKey(kc, KEY.OK)) {
        e.preventDefault(); e.stopPropagation();
        showEpgSidebar(channels[_currentIndex]);
        return;
      }
      if (isKey(kc, KEY.BACK)) {
        e.preventDefault(); e.stopPropagation();
        hide();
        return;
      }
      // All other keys pass through
      return;
    }

    // Layer 1: nothing shown
    if (isKey(kc, KEY.CH_UP)) {
      e.preventDefault(); e.stopPropagation();
      _switchChannel(1);
      show(_currentIndex);
      return;
    }
    if (isKey(kc, KEY.CH_DOWN)) {
      e.preventDefault(); e.stopPropagation();
      _switchChannel(-1);
      show(_currentIndex);
      return;
    }
    // All other keys pass to native Lampa player
  }

  document.addEventListener('keydown', _onKeyDown, true);

  // ── Destroy ───────────────────────────────────────────────────────────────

  function destroy() {
    clearTimeout(_hideTimer);
    document.removeEventListener('keydown', _onKeyDown, true);
    if (osdEl.parentNode) osdEl.parentNode.removeChild(osdEl);
    if (epgEl.parentNode) epgEl.parentNode.removeChild(epgEl);
  }

  return {
    show:            show,
    hide:            hide,
    setIndex:        function(idx) { _currentIndex = idx; },
    showEpgSidebar:  showEpgSidebar,
    hideEpgSidebar:  hideEpgSidebar,
    destroy:         destroy
  };
}
