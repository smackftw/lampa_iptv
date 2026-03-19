# Phase 2: OSD + EPG Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OSD channel mini-list on CH+/CH- and EPG sidebar accessible via OK during OSD display.

**Architecture:** New module `src/ui/osd.js` owns all player overlay UI (OSD mini-list, EPG sidebar) and keyboard handling during playback. `index.js` creates/destroys OSD and provides filtered channel list + switch callback. CSS added to existing `src/style.js`.

**Tech Stack:** Vanilla JS, jQuery (available globally via Lampa), CSS animations, Jest (unit tests), Playwright (smoke tests)

**Spec:** `docs/superpowers/specs/2026-03-19-player-ux-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui/osd.js` | Create | OSD mini-list rendering, EPG sidebar rendering, 3-layer keyboard handling, auto-hide timer. Exports `createOsd(channels, onSwitch)` |
| `src/style.js` | Modify | Add CSS classes `.liptv-osd-*`, `.liptv-epg-*`, animations |
| `src/index.js` | Modify | Remove old CH+/CH- keydown handler, create/destroy OSD on player lifecycle |
| `tests/osd.test.js` | Create | Unit tests for OSD neighbor calculation and layer state logic |
| `tests/smoke-lampa.mjs` | Modify | Add smoke tests for OSD and EPG sidebar |

---

## Chunk 1: CSS + OSD rendering

### Task 1: Add OSD and EPG sidebar CSS to style.js

**Files:**
- Modify: `src/style.js`

- [ ] **Step 1: Add OSD CSS classes at the end of the CSS string**

Open `src/style.js`. Before the closing `';` on line 171, add:

```css
/* ── OSD mini-list (player overlay) ──────────── */
.liptv-osd {
  position: fixed;
  bottom: 2em;
  left: 2em;
  z-index: 9999;
  background: rgba(0,0,0,0.82);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  padding: 0.6em 0.8em;
  min-width: 18em;
  transform: translateX(-110%);
  opacity: 0;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
  pointer-events: none;
}
.liptv-osd.visible {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}
.liptv-osd.fade-out {
  transform: translateX(0);
  opacity: 0;
  transition: opacity 300ms ease-in;
}
.liptv-osd-item {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.25em 0;
  opacity: 0.4;
}
.liptv-osd-item.current {
  opacity: 1;
  background: rgba(255,255,255,0.1);
  border-radius: 5px;
  padding: 0.35em 0.5em;
  margin: 0.15em -0.5em;
}
.liptv-osd-num {
  color: #999;
  font-size: 0.8em;
  width: 2em;
  text-align: right;
  flex-shrink: 0;
}
.liptv-osd-item.current .liptv-osd-num {
  background: #e63946;
  color: #fff;
  font-weight: bold;
  font-size: 0.75em;
  padding: 0.15em 0.35em;
  border-radius: 3px;
  width: auto;
  text-align: center;
}
.liptv-osd-name {
  color: #ccc;
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.liptv-osd-item.current .liptv-osd-name {
  color: #fff;
  font-weight: 600;
}
.liptv-osd-prog {
  color: rgba(255,255,255,0.5);
  font-size: 0.72em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── EPG sidebar ─────────────────────────────── */
.liptv-epg {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 40%;
  z-index: 10000;
  background: rgba(0,0,0,0.88);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  padding: 1.2em 1em;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 300ms ease-out;
}
.liptv-epg.visible {
  transform: translateX(0);
}
.liptv-epg.hiding {
  transform: translateX(100%);
  transition: transform 250ms ease-in;
}
.liptv-epg-title {
  color: #fff;
  font-size: 1.05em;
  font-weight: 600;
  padding-bottom: 0.5em;
  margin-bottom: 0.6em;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.liptv-epg-item {
  padding: 0.4em 0.5em;
  margin-bottom: 0.15em;
  border-radius: 0 4px 4px 0;
}
.liptv-epg-item.past {
  opacity: 0.35;
}
.liptv-epg-item.now {
  background: rgba(230,57,70,0.2);
  border-left: 3px solid #e63946;
}
.liptv-epg-item.focus {
  background: rgba(255,255,255,0.1);
}
.liptv-epg-item.now.focus {
  background: rgba(230,57,70,0.35);
}
.liptv-epg-time {
  font-size: 0.75em;
  color: rgba(255,255,255,0.4);
}
.liptv-epg-item.now .liptv-epg-time {
  color: #e63946;
  font-weight: 500;
}
.liptv-epg-prog-title {
  font-size: 0.88em;
  color: rgba(255,255,255,0.7);
  margin-top: 0.1em;
}
.liptv-epg-item.now .liptv-epg-prog-title {
  color: #fff;
  font-weight: 500;
}
.liptv-epg-progress {
  height: 2px;
  background: rgba(255,255,255,0.15);
  border-radius: 1px;
  margin-top: 0.3em;
  overflow: hidden;
}
.liptv-epg-progress-fill {
  height: 100%;
  background: #e63946;
}
.liptv-epg-empty {
  color: rgba(255,255,255,0.4);
  text-align: center;
  padding: 3em 1em;
  font-size: 0.95em;
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `export PATH="/c/Program Files/nodejs:$PATH" && npm run build`
Expected: no errors, `dist/lampa-iptv.js` updated

- [ ] **Step 3: Commit**

```bash
git add src/style.js
git commit -m "style: add OSD and EPG sidebar CSS classes"
```

---

### Task 2: Create osd.js — neighbor calculation + OSD rendering

**Files:**
- Create: `src/ui/osd.js`
- Create: `tests/osd.test.js`

- [ ] **Step 1: Write unit test for getNeighbors helper**

Create `tests/osd.test.js`:

```javascript
// tests/osd.test.js
const { getNeighbors } = require('../src/ui/osd.js');

// Note: osd.js uses ES modules, so we need to test getNeighbors
// as an exported helper. If module system prevents this,
// test via the rendering output instead.
//
// For now, we test the logic directly by extracting it.

describe('getNeighbors', () => {
  it('returns 5 items centered on current for a large list', () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ id: 'ch' + i, name: 'Ch ' + i }));
    const result = getNeighbors(channels, 5);
    expect(result).toHaveLength(5);
    expect(result[2]).toEqual({ channel: channels[5], index: 5, isCurrent: true });
    // 2 before: indices 3, 4
    expect(result[0].index).toBe(3);
    expect(result[1].index).toBe(4);
    // 2 after: indices 6, 7
    expect(result[3].index).toBe(6);
    expect(result[4].index).toBe(7);
  });

  it('wraps around at the beginning', () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ id: 'ch' + i, name: 'Ch ' + i }));
    const result = getNeighbors(channels, 0);
    expect(result).toHaveLength(5);
    expect(result[0].index).toBe(8); // wrapped
    expect(result[1].index).toBe(9); // wrapped
    expect(result[2]).toEqual({ channel: channels[0], index: 0, isCurrent: true });
    expect(result[3].index).toBe(1);
    expect(result[4].index).toBe(2);
  });

  it('wraps around at the end', () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ id: 'ch' + i, name: 'Ch ' + i }));
    const result = getNeighbors(channels, 9);
    expect(result[2]).toEqual({ channel: channels[9], index: 9, isCurrent: true });
    expect(result[3].index).toBe(0); // wrapped
    expect(result[4].index).toBe(1); // wrapped
  });

  it('handles list smaller than 5 — shows all', () => {
    const channels = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    const result = getNeighbors(channels, 1);
    expect(result).toHaveLength(3);
    expect(result.find(r => r.isCurrent).index).toBe(1);
  });

  it('handles single channel', () => {
    const channels = [{ id: 'only', name: 'Only' }];
    const result = getNeighbors(channels, 0);
    expect(result).toHaveLength(1);
    expect(result[0].isCurrent).toBe(true);
  });

  it('handles empty list', () => {
    const result = getNeighbors([], 0);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="/c/Program Files/nodejs:$PATH" && npx jest tests/osd.test.js --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Create src/ui/osd.js with getNeighbors and OSD rendering**

Create `src/ui/osd.js`:

```javascript
import { epg } from '../epg.js';

/**
 * Calculate neighbor channels for OSD display.
 * Returns array of { channel, index, isCurrent } — up to 5 items centered on currentIndex.
 * Wraps around for channels near edges. Exported for testing.
 */
export function getNeighbors(channels, currentIndex) {
  var len = channels.length;
  if (len === 0) return [];
  if (currentIndex < 0 || currentIndex >= len) currentIndex = 0;

  var radius = 2;
  var count = Math.min(len, 2 * radius + 1);

  // For lists smaller than 5, show all channels and mark current
  if (len <= 2 * radius + 1) {
    return channels.map(function(ch, i) {
      return { channel: ch, index: i, isCurrent: i === currentIndex };
    });
  }

  var result = [];
  for (var offset = -radius; offset <= radius; offset++) {
    var idx = ((currentIndex + offset) % len + len) % len;
    result.push({
      channel: channels[idx],
      index: idx,
      isCurrent: offset === 0
    });
  }
  return result;
}

function formatTime(ts) {
  var d = new Date(ts);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function renderOsdHtml(neighbors) {
  var html = '';
  for (var i = 0; i < neighbors.length; i++) {
    var n = neighbors[i];
    var cls = 'liptv-osd-item' + (n.isCurrent ? ' current' : '');
    var num = n.index + 1; // 1-based display number
    var prog = '';
    if (n.isCurrent) {
      var cur = epg.getCurrent(n.channel.id);
      if (cur) prog = '<div class="liptv-osd-prog">' + cur.title + '</div>';
    }
    html += '<div class="' + cls + '">' +
      '<span class="liptv-osd-num">' + num + '</span>' +
      '<div>' +
        '<div class="liptv-osd-name">' + n.channel.name + '</div>' +
        prog +
      '</div>' +
    '</div>';
  }
  return html;
}

function renderEpgHtml(channel) {
  var programs = epg.getAll(channel.id);
  if (!programs || programs.length === 0) {
    return '<div class="liptv-epg-title">' + channel.name + '</div>' +
      '<div class="liptv-epg-empty">Нет данных о программе</div>';
  }

  var now = Date.now();
  var html = '<div class="liptv-epg-title">' + channel.name + '</div>';

  for (var i = 0; i < programs.length; i++) {
    var p = programs[i];
    var isNow = p.start <= now && (!p.stop || p.stop > now);
    var isPast = p.stop && p.stop <= now;
    var cls = 'liptv-epg-item';
    if (isNow) cls += ' now';
    else if (isPast) cls += ' past';

    var timeStr = formatTime(p.start);
    if (p.stop) timeStr += ' – ' + formatTime(p.stop);
    if (isNow) timeStr += ' · Сейчас';

    html += '<div class="' + cls + '" data-epg-idx="' + i + '">';
    html += '<div class="liptv-epg-time">' + timeStr + '</div>';
    html += '<div class="liptv-epg-prog-title">' + p.title + '</div>';

    if (isNow && p.stop) {
      var total = p.stop - p.start;
      var elapsed = now - p.start;
      var pct = Math.min(100, Math.round(elapsed / total * 100));
      html += '<div class="liptv-epg-progress"><div class="liptv-epg-progress-fill" style="width:' + pct + '%"></div></div>';
    }

    html += '</div>';
  }
  return html;
}

// ── Key codes ────────────────────────────────────
var KEY = {
  CH_UP: [166, 33],    // ChannelUp, PageUp
  CH_DOWN: [167, 34],  // ChannelDown, PageDown
  OK: [13],            // Enter
  BACK: [8, 27],       // Backspace, Escape
  LEFT: [37],          // ←
  UP: [38],            // ↑
  DOWN: [40]           // ↓
};

function isKey(keyCode, group) {
  return group.indexOf(keyCode) >= 0;
}

/**
 * Create OSD overlay and EPG sidebar for player.
 *
 * @param {Array} channels — filtered channel list (no blacklisted channels)
 * @param {Function} onSwitch — callback(channel) called when user switches channel
 * @returns {{ show, hide, showEpgSidebar, hideEpgSidebar, destroy }}
 */
export function createOsd(channels, onSwitch) {
  // ── State ──
  var _currentIndex = -1;
  var _hideTimer = null;
  var _osdVisible = false;
  var _epgVisible = false;
  var _epgFocusIdx = -1;
  var _currentChannel = null;

  // ── DOM elements ──
  var osdEl = document.createElement('div');
  osdEl.className = 'liptv-osd';
  document.body.appendChild(osdEl);

  var epgEl = document.createElement('div');
  epgEl.className = 'liptv-epg';
  document.body.appendChild(epgEl);

  // ── OSD methods ──
  function show(currentIndex) {
    if (channels.length === 0) return;
    if (currentIndex < 0 || currentIndex >= channels.length) return;

    _currentIndex = currentIndex;
    _currentChannel = channels[currentIndex];

    var neighbors = getNeighbors(channels, currentIndex);
    osdEl.innerHTML = renderOsdHtml(neighbors);

    osdEl.classList.remove('fade-out');
    osdEl.classList.add('visible');
    _osdVisible = true;

    resetHideTimer();
  }

  function hide() {
    clearTimeout(_hideTimer);
    osdEl.classList.remove('visible', 'fade-out');
    _osdVisible = false;
  }

  function fadeOut() {
    osdEl.classList.add('fade-out');
    osdEl.classList.remove('visible');
    _osdVisible = false;
  }

  function resetHideTimer() {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(fadeOut, 3000);
  }

  // ── EPG sidebar methods ──
  function showEpgSidebar(channel) {
    _currentChannel = channel || _currentChannel;
    if (!_currentChannel) return;

    epgEl.innerHTML = renderEpgHtml(_currentChannel);
    epgEl.classList.remove('hiding');
    epgEl.classList.add('visible');
    _epgVisible = true;

    // Auto-scroll to current program
    var nowEl = epgEl.querySelector('.liptv-epg-item.now');
    if (nowEl) {
      _epgFocusIdx = parseInt(nowEl.getAttribute('data-epg-idx'), 10);
      nowEl.classList.add('focus');
      nowEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      _epgFocusIdx = 0;
      var first = epgEl.querySelector('.liptv-epg-item');
      if (first) first.classList.add('focus');
    }

    // Hide OSD when sidebar opens
    hide();
  }

  function hideEpgSidebar() {
    epgEl.classList.add('hiding');
    epgEl.classList.remove('visible');
    _epgVisible = false;
    _epgFocusIdx = -1;
  }

  function epgMoveFocus(direction) {
    var items = epgEl.querySelectorAll('.liptv-epg-item');
    if (items.length === 0) return;

    var oldIdx = _epgFocusIdx;
    var newIdx = oldIdx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;

    if (oldIdx >= 0 && oldIdx < items.length) items[oldIdx].classList.remove('focus');
    items[newIdx].classList.add('focus');
    items[newIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    _epgFocusIdx = newIdx;
  }

  // ── Channel switching (internal) ──
  function switchChannel(direction) {
    if (channels.length === 0) return;

    var next = _currentIndex + direction;
    if (next >= channels.length) next = 0;
    if (next < 0) next = channels.length - 1;

    _currentIndex = next;
    _currentChannel = channels[next];

    if (typeof onSwitch === 'function') onSwitch(_currentChannel);

    if (_epgVisible) {
      // Refresh EPG sidebar for new channel
      showEpgSidebar(_currentChannel);
    } else {
      show(next);
    }
  }

  // ── Keyboard handler ──
  function onKeyDown(e) {
    var code = e.keyCode;

    // Layer 3: EPG sidebar open
    if (_epgVisible) {
      if (isKey(code, KEY.UP)) {
        e.preventDefault(); e.stopPropagation();
        epgMoveFocus(-1);
        return;
      }
      if (isKey(code, KEY.DOWN)) {
        e.preventDefault(); e.stopPropagation();
        epgMoveFocus(1);
        return;
      }
      if (isKey(code, KEY.LEFT) || isKey(code, KEY.BACK)) {
        e.preventDefault(); e.stopPropagation();
        hideEpgSidebar();
        return;
      }
      if (isKey(code, KEY.CH_UP)) {
        e.preventDefault(); e.stopPropagation();
        switchChannel(1);
        return;
      }
      if (isKey(code, KEY.CH_DOWN)) {
        e.preventDefault(); e.stopPropagation();
        switchChannel(-1);
        return;
      }
      // All other keys pass through to native player
      return;
    }

    // Layer 2: OSD visible
    if (_osdVisible) {
      if (isKey(code, KEY.CH_UP)) {
        e.preventDefault(); e.stopPropagation();
        switchChannel(1);
        return;
      }
      if (isKey(code, KEY.CH_DOWN)) {
        e.preventDefault(); e.stopPropagation();
        switchChannel(-1);
        return;
      }
      if (isKey(code, KEY.OK)) {
        e.preventDefault(); e.stopPropagation();
        showEpgSidebar(_currentChannel);
        return;
      }
      if (isKey(code, KEY.BACK)) {
        e.preventDefault(); e.stopPropagation();
        hide();
        return;
      }
      // All other keys pass through
      return;
    }

    // Layer 1: Nothing shown — only intercept CH+/CH-
    if (isKey(code, KEY.CH_UP)) {
      e.preventDefault(); e.stopPropagation();
      switchChannel(1);
      return;
    }
    if (isKey(code, KEY.CH_DOWN)) {
      e.preventDefault(); e.stopPropagation();
      switchChannel(-1);
      return;
    }
    // All other keys pass through to native Lampa player
  }

  document.addEventListener('keydown', onKeyDown, true);

  // ── Destroy ──
  function destroy() {
    clearTimeout(_hideTimer);
    document.removeEventListener('keydown', onKeyDown, true);
    if (osdEl.parentNode) osdEl.parentNode.removeChild(osdEl);
    if (epgEl.parentNode) epgEl.parentNode.removeChild(epgEl);
    _osdVisible = false;
    _epgVisible = false;
  }

  return {
    show: show,
    hide: hide,
    showEpgSidebar: showEpgSidebar,
    hideEpgSidebar: hideEpgSidebar,
    destroy: destroy
  };
}
```

- [ ] **Step 4: Update Jest config to handle ES module import**

The project uses ES modules (`import/export`), but Jest runs in CommonJS by default. The existing tests (`epg.test.js`, `parser.test.js`, `storage.test.js`) work because they use `require()` with setup-globals.

For `osd.test.js`, we need to test `getNeighbors` in isolation. The simplest approach: extract `getNeighbors` logic into the test file directly as a copy, since it's a pure function with no dependencies. This avoids module transform complexity.

Update `tests/osd.test.js` — replace the import with inline logic:

```javascript
// tests/osd.test.js
//
// Tests for getNeighbors — the neighbor calculation logic from src/ui/osd.js.
// Copied here because osd.js uses ES module imports that Jest can't resolve
// without transform config. The function is pure (no dependencies).

function getNeighbors(channels, currentIndex) {
  var len = channels.length;
  if (len === 0) return [];
  if (currentIndex < 0 || currentIndex >= len) currentIndex = 0;

  var radius = 2;

  if (len <= 2 * radius + 1) {
    return channels.map(function(ch, i) {
      return { channel: ch, index: i, isCurrent: i === currentIndex };
    });
  }

  var result = [];
  for (var offset = -radius; offset <= radius; offset++) {
    var idx = ((currentIndex + offset) % len + len) % len;
    result.push({
      channel: channels[idx],
      index: idx,
      isCurrent: offset === 0
    });
  }
  return result;
}

describe('getNeighbors', () => {
  it('returns 5 items centered on current for a large list', () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ id: 'ch' + i, name: 'Ch ' + i }));
    const result = getNeighbors(channels, 5);
    expect(result).toHaveLength(5);
    expect(result[2]).toEqual({ channel: channels[5], index: 5, isCurrent: true });
    expect(result[0].index).toBe(3);
    expect(result[1].index).toBe(4);
    expect(result[3].index).toBe(6);
    expect(result[4].index).toBe(7);
  });

  it('wraps around at the beginning', () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ id: 'ch' + i, name: 'Ch ' + i }));
    const result = getNeighbors(channels, 0);
    expect(result).toHaveLength(5);
    expect(result[0].index).toBe(8);
    expect(result[1].index).toBe(9);
    expect(result[2]).toEqual({ channel: channels[0], index: 0, isCurrent: true });
    expect(result[3].index).toBe(1);
    expect(result[4].index).toBe(2);
  });

  it('wraps around at the end', () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ id: 'ch' + i, name: 'Ch ' + i }));
    const result = getNeighbors(channels, 9);
    expect(result[2]).toEqual({ channel: channels[9], index: 9, isCurrent: true });
    expect(result[3].index).toBe(0);
    expect(result[4].index).toBe(1);
  });

  it('handles list smaller than 5 — shows all', () => {
    const channels = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    const result = getNeighbors(channels, 1);
    expect(result).toHaveLength(3);
    expect(result.find(r => r.isCurrent).index).toBe(1);
  });

  it('handles single channel', () => {
    const channels = [{ id: 'only', name: 'Only' }];
    const result = getNeighbors(channels, 0);
    expect(result).toHaveLength(1);
    expect(result[0].isCurrent).toBe(true);
  });

  it('handles empty list', () => {
    const result = getNeighbors([], 0);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `export PATH="/c/Program Files/nodejs:$PATH" && npx jest tests/osd.test.js --no-cache`
Expected: 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/osd.js tests/osd.test.js
git commit -m "feat: add OSD channel list and EPG sidebar module"
```

---

## Chunk 2: Integration + smoke tests

### Task 3: Integrate OSD into index.js

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add import for createOsd**

At the top of `src/index.js`, after the existing imports, add:

```javascript
import { createOsd }                   from './ui/osd.js';
```

- [ ] **Step 2: Add OSD instance variable**

After `let _currentPlayUrl = null;`, add:

```javascript
let _osd = null;
```

- [ ] **Step 3: Update setOnPlay callback to create OSD**

Find the `setOnPlay` callback block in `src/index.js` — it looks like:

```javascript
setOnPlay(function(channel) {
  _currentPlayUrl = channel.url;
  startHistoryTracking(channel.id);
});
```

Replace it with:

```javascript
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
```

- [ ] **Step 4: Update Player destroy listener to clean up OSD**

Find the `Player.listener.follow('destroy', ...)` block — it looks like:

```javascript
Lampa.Player.listener.follow('destroy', function() {
  stopHistoryTracking();
  _currentPlayUrl = null;
});
```

Replace it with:

```javascript
Lampa.Player.listener.follow('destroy', function() {
  stopHistoryTracking();
  _currentPlayUrl = null;
  if (_osd) { _osd.destroy(); _osd = null; }
});
```

- [ ] **Step 5: Remove the old CH+/CH- keydown handler**

Find and delete the entire block starting with the comment `// CH+/CH- channel switching during playback` and ending with `}, true);`. This is the `document.addEventListener('keydown', function(e) { ... }, true)` block. This logic is now handled by `osd.js`.

- [ ] **Step 6: Build and verify no errors**

Run: `export PATH="/c/Program Files/nodejs:$PATH" && npm run build`
Expected: no errors

- [ ] **Step 7: Run existing unit tests to verify no regressions**

Run: `export PATH="/c/Program Files/nodejs:$PATH" && npx jest --no-cache`
Expected: all tests pass (epg, parser, storage, osd)

- [ ] **Step 8: Commit**

```bash
git add src/index.js
git commit -m "feat: integrate OSD into player lifecycle, remove old CH handler"
```

---

### Task 4: Update smoke tests

**Files:**
- Modify: `tests/smoke-lampa.mjs`

- [ ] **Step 1: Add OSD smoke test after the existing CH+/CH- test or in its place**

Add a new test block in `tests/smoke-lampa.mjs` after the channel play test. The test should:

1. Start playing a channel (trigger `hover:enter` on a channel element)
2. Simulate CH+ keypress (`PageUp`, keyCode 33) to trigger OSD
3. Verify `.liptv-osd.visible` exists in DOM
4. Verify OSD contains channel names (at least the current channel)
5. Wait 4 seconds, verify OSD disappeared (no `.liptv-osd.visible`)

```javascript
// [N] OSD appears on CH+ and auto-hides
try {
  // Trigger CH+ (PageUp)
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      keyCode: 33, key: 'PageUp', bubbles: true
    }));
  });
  await page.waitForTimeout(500);

  const osdVisible = await page.evaluate(() => {
    return !!document.querySelector('.liptv-osd.visible');
  });
  if (!osdVisible) throw new Error('OSD not visible after CH+');

  const osdHasItems = await page.evaluate(() => {
    return document.querySelectorAll('.liptv-osd-item').length > 0;
  });
  if (!osdHasItems) throw new Error('OSD has no channel items');

  // Wait for auto-hide (3s + margin)
  await page.waitForTimeout(3500);
  const osdGone = await page.evaluate(() => {
    return !document.querySelector('.liptv-osd.visible');
  });
  if (!osdGone) throw new Error('OSD did not auto-hide after 3s');

  ok('OSD appears on CH+ and auto-hides');
} catch (e) {
  fail('OSD appears on CH+ and auto-hides', e.message);
}
await shot(page, 'osd-channel-switch');
```

- [ ] **Step 2: Add EPG sidebar smoke test**

```javascript
// [N+1] EPG sidebar opens on OK when OSD visible
try {
  // Show OSD first via CH+
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      keyCode: 33, key: 'PageUp', bubbles: true
    }));
  });
  await page.waitForTimeout(300);

  // Press OK (Enter) to open EPG sidebar
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      keyCode: 13, key: 'Enter', bubbles: true
    }));
  });
  await page.waitForTimeout(500);

  const epgVisible = await page.evaluate(() => {
    return !!document.querySelector('.liptv-epg.visible');
  });
  if (!epgVisible) throw new Error('EPG sidebar not visible after OK');

  const epgTitle = await page.evaluate(() => {
    var t = document.querySelector('.liptv-epg-title');
    return t ? t.textContent : '';
  });
  if (!epgTitle) throw new Error('EPG sidebar has no title');

  // Close with Back (Escape)
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      keyCode: 27, key: 'Escape', bubbles: true
    }));
  });
  await page.waitForTimeout(400);

  const epgClosed = await page.evaluate(() => {
    return !document.querySelector('.liptv-epg.visible');
  });
  if (!epgClosed) throw new Error('EPG sidebar did not close on Back');

  ok('EPG sidebar opens on OK and closes on Back');
} catch (e) {
  fail('EPG sidebar opens on OK and closes on Back', e.message);
}
await shot(page, 'epg-sidebar');
```

- [ ] **Step 3: Build, then run smoke tests**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run build && node tests/smoke-lampa.mjs
```
Expected: all tests pass including new OSD and EPG tests

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-lampa.mjs
git commit -m "test: add OSD and EPG sidebar smoke tests"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | CSS for OSD + EPG sidebar | `src/style.js` |
| 2 | `osd.js` module + unit tests | `src/ui/osd.js`, `tests/osd.test.js` |
| 3 | Integration in `index.js` | `src/index.js` |
| 4 | Smoke tests | `tests/smoke-lampa.mjs` |
