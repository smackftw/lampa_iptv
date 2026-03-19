# Lampa IPTV Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Lampa TV plugin providing a full IPTV experience — M3U playlists, EPG, groups, favorites, history, blacklist, search — similar to OTT Navigator.

**Architecture:** Modular ES module source (parser, epg, storage, UI components) bundled to a single IIFE via Rollup. Pure logic modules are unit-tested with Jest + jsdom. UI components follow Lampa's component API and are verified by manual testing in a browser.

**Tech Stack:** Node.js, Rollup, Jest + jsdom (v29+), Babel (ESM→CJS transform for Jest), jQuery-compatible `$()` provided globally by Lampa (not a separate dependency), Lampa API (Lampa.Storage, Lampa.Listener, Lampa.Player, Lampa.Component, Lampa.Select, Lampa.Noty, Lampa.Settings)

---

## File Map

| File | Responsibility |
|---|---|
| `src/parser.js` | M3U fetch + parse → `{channels, groups, playlistEpgUrl}` |
| `src/epg.js` | XMLTV fetch, parse, in-memory storage; `getCurrent` / `getNext` / `getAll` |
| `src/storage.js` | Typed wrapper over `Lampa.Storage` |
| `src/ui/settings.js` | Settings screen registration |
| `src/ui/main.js` | Main screen: groups sidebar + list/grid + EPG labels |
| `src/ui/card.js` | Channel action card (play, fav, hide, EPG) |
| `src/ui/epg-screen.js` | Full EPG schedule for a channel |
| `src/ui/search.js` | Search screen (channels + programs) |
| `src/index.js` | Plugin entry point: startup, component registration, history tracking |
| `tests/parser.test.js` | Unit tests: M3U parsing |
| `tests/epg.test.js` | Unit tests: XMLTV parsing + getCurrent/getNext |
| `tests/storage.test.js` | Unit tests: storage accessors |
| `package.json` | Build/test scripts |
| `rollup.config.js` | Rollup IIFE build config |
| `babel.config.json` | Babel config for Jest ESM transform |
| `jest.config.json` | Jest config |

**Note on UI testing:** UI components depend on Lampa's runtime and cannot be unit tested in isolation. Verification: `npm run build` must succeed + manual smoke test in browser (Task 11).

---

## Chunk 1: Project Setup + Lampa API Research

### Task 1: Initialize build environment

**Files:**
- Modify: `package.json`
- Create: `rollup.config.js`
- Create: `babel.config.json`
- Create: `jest.config.json`
- Create: `.gitignore`

- [ ] **Step 1: Install dependencies**

```bash
cd ~/PycharmProjects/lampa-iptv
npm init -y
npm install --save-dev rollup @rollup/plugin-node-resolve @babel/core @babel/preset-env babel-jest jest jest-environment-jsdom
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 2: Update package.json scripts**

Edit `package.json`, replace the `"scripts"` section with:

```json
"scripts": {
  "build": "rollup -c",
  "watch": "rollup -c --watch",
  "test": "jest"
}
```

- [ ] **Step 3: Create rollup.config.js**

```js
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/lampa-iptv.js',
    format: 'iife',
    name: 'LampaIPTV',
    banner: '/* Lampa IPTV Plugin v0.1.0 */'
  },
  plugins: [resolve()]
};
```

- [ ] **Step 4: Create babel.config.json**

```json
{
  "presets": [
    ["@babel/preset-env", { "targets": { "node": "current" } }]
  ]
}
```

- [ ] **Step 5: Create jest.config.json**

```json
{
  "testEnvironment": "jsdom",
  "transform": {
    "^.+\\.js$": "babel-jest"
  },
  "setupFiles": ["./tests/setup-globals.js"]
}
```

`jsdom` provides `DOMParser` needed by `epg.js`. Requires `jest-environment-jsdom` v29+.

- [ ] **Step 5a: Create tests/setup-globals.js**

This file runs before any test module loads, so globals are available when modules are evaluated:

```js
// tests/setup-globals.js
const store = {};

global.Lampa = {
  Storage: {
    get: (key, def) => (key in store ? store[key] : def),
    set: (key, val) => { store[key] = val; }
  },
  Listener: {
    send: () => {},
    follow: () => {},
    remove: () => {}
  }
};

// Expose store so tests can clear it between runs
global.__store__ = store;

global.fetch = () => Promise.resolve({ ok: false, text: () => Promise.resolve('') });
```

Individual tests override `Lampa.*` methods and `fetch` with `jest.fn()` / `jest.spyOn()` as needed.

- [ ] **Step 5b: Verify DOMParser is available**

Add a temporary sanity check before writing EPG tests:

```bash
node -e "const { JSDOM } = require('jest-environment-jsdom/node_modules/jsdom'); const d = new JSDOM(); console.log(typeof d.window.DOMParser);"
```

Expected: prints `function`. If it prints `undefined`, upgrade `jest-environment-jsdom` to v29.

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
```

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p src/ui tests dist
```

- [ ] **Step 8: Commit**

```bash
git add package.json rollup.config.js babel.config.json jest.config.json .gitignore
git commit -m "chore: initialize build environment"
```

---

### Task 2: Research Lampa Plugin API

Lampa's API is not formally documented. Before writing UI code, read a real plugin to understand exact method signatures.

- [ ] **Step 1: Find and read reference plugins**

Search GitHub:
```
site:github.com lampa plugin tvg-id site:github.com
```
Or browse: https://github.com/search?q=lampa+plugin+EXTINF

Look for answers to:
- How to register a component (is it `Lampa.Component.add(name, constructor)` or an object?)
- How to open a screen (`Lampa.Activity.push({component, title, url})` or similar?)
- How to add items to Lampa's settings menu
- Exact signature of `Lampa.Player.play()`
- Player event names (start/stop — likely `player:start`, `player:stop`, `player:ended`)
- How to show a selection list (`Lampa.Select.show()`)
- How to show a toast notification (`Lampa.Noty.show()`)
- App start event name (is it `app:start`, `lampa:ready`, or `start`?)

- [ ] **Step 2: Create docs/lampa-api-notes.md with findings**

```markdown
# Lampa API Notes

## Component registration:
<!-- fill in from research -->

## Opening a screen:
<!-- fill in -->

## Player:
- Play:
- Start event:
- Stop event:

## Settings:
<!-- fill in -->

## Select/Modal:
<!-- fill in -->

## Notifications:
<!-- fill in -->

## App start event:
<!-- fill in -->
```

- [ ] **Step 3: Commit**

```bash
git add docs/lampa-api-notes.md
git commit -m "docs: add Lampa API research notes"
```

---

## Chunk 2: Core Logic — parser.js + storage.js

### Task 3: M3U parser

**Files:**
- Create: `src/parser.js`
- Create: `tests/parser.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/parser.test.js`:

```js
import { parseM3U } from '../src/parser.js';

const SAMPLE_M3U = `#EXTM3U tvg-url="http://epg.example.com/epg.xml"
#EXTINF:-1 tvg-id="perviy.ru" tvg-logo="http://logo.png" group-title="Россия",Первый канал
http://stream.example.com/perviy
#EXTINF:-1 tvg-id="ntv.ru" tvg-logo="http://ntv.png" group-title="Россия",НТВ
http://stream.example.com/ntv
#EXTINF:-1 group-title="Спорт",Матч ТВ
http://stream.example.com/match`;

describe('parseM3U', () => {
  let result;
  beforeAll(() => { result = parseM3U(SAMPLE_M3U); });

  test('extracts playlistEpgUrl from #EXTM3U header', () => {
    expect(result.playlistEpgUrl).toBe('http://epg.example.com/epg.xml');
  });

  test('parses correct number of channels', () => {
    expect(result.channels).toHaveLength(3);
  });

  test('extracts channel fields correctly', () => {
    const ch = result.channels[0];
    expect(ch.name).toBe('Первый канал');
    expect(ch.url).toBe('http://stream.example.com/perviy');
    expect(ch.logo).toBe('http://logo.png');
    expect(ch.group).toBe('Россия');
    expect(ch.tvgId).toBe('perviy.ru');
    expect(ch.id).toBe('perviy.ru'); // id = tvgId when present
  });

  test('uses djb2 hash as id when tvg-id is absent', () => {
    const ch = result.channels[2]; // Матч ТВ — no tvg-id
    expect(ch.id).toBeTruthy();
    expect(ch.tvgId).toBe('');
  });

  test('collects unique groups', () => {
    expect(result.groups).toContain('Россия');
    expect(result.groups).toContain('Спорт');
    expect(result.groups).toHaveLength(2);
  });

  test('returns null playlistEpgUrl when header has none', () => {
    const r = parseM3U('#EXTM3U\n#EXTINF:-1,Test\nhttp://test.com');
    expect(r.playlistEpgUrl).toBeNull();
  });

  test('skips malformed entries (EXTINF without url line)', () => {
    const text = `#EXTM3U\n#EXTINF:-1,Good\nhttp://good.com\n#EXTINF:-1,Bad`;
    const r = parseM3U(text);
    expect(r.channels).toHaveLength(1);
    expect(r.channels[0].name).toBe('Good');
  });
});

describe('fetchM3U', () => {
  let fetchSpy;
  beforeEach(() => { fetchSpy = jest.spyOn(global, 'fetch'); });
  afterEach(() => { jest.restoreAllMocks(); });

  test('throws when server returns non-OK status', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 404 });
    const { fetchM3U } = await import('../src/parser.js');
    await expect(fetchM3U('http://bad.com')).rejects.toThrow('HTTP 404');
  });

  test('throws when fetch rejects (network error, DNS failure, etc.)', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));
    const { fetchM3U } = await import('../src/parser.js');
    await expect(fetchM3U('http://bad.com')).rejects.toThrow('Failed to fetch');
  });

  test('parses response on success', async () => {
    fetchSpy.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_M3U) });
    const { fetchM3U } = await import('../src/parser.js');
    const result = await fetchM3U('http://ok.com');
    expect(result.channels).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- tests/parser.test.js
```

Expected: FAIL — "Cannot find module '../src/parser.js'"

- [ ] **Step 3: Implement src/parser.js**

```js
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // keep 32-bit
  }
  return Math.abs(hash).toString(36);
}

export function parseM3U(text) {
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

export async function fetchM3U(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`M3U fetch failed: HTTP ${response.status}`);
  const text = await response.text();
  return parseM3U(text);
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npm test -- tests/parser.test.js
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser.js tests/parser.test.js
git commit -m "feat: add M3U parser with djb2 hash"
```

---

### Task 4: Storage wrapper

**Files:**
- Create: `src/storage.js`
- Create: `tests/storage.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/storage.test.js`:

```js
// Lampa.Storage is set up in tests/setup-globals.js (runs before module load)
import { storage } from '../src/storage.js';

beforeEach(() => {
  // Clear the shared store (exposed by setup-globals.js)
  Object.keys(global.__store__).forEach(k => delete global.__store__[k]);
});

describe('viewMode', () => {
  test('defaults to list', () => {
    expect(storage.getViewMode()).toBe('list');
  });
  test('persists grid', () => {
    storage.setViewMode('grid');
    expect(storage.getViewMode()).toBe('grid');
  });
});

describe('favorites', () => {
  test('add and check', () => {
    storage.addFavorite('ch1');
    expect(storage.isFavorite('ch1')).toBe(true);
    expect(storage.isFavorite('ch2')).toBe(false);
  });
  test('remove favorite', () => {
    storage.addFavorite('ch1');
    storage.removeFavorite('ch1');
    expect(storage.isFavorite('ch1')).toBe(false);
  });
  test('no duplicates', () => {
    storage.addFavorite('ch1');
    storage.addFavorite('ch1');
    expect(storage.getFavorites()).toHaveLength(1);
  });
});

describe('history', () => {
  test('adds to history', () => {
    storage.addHistory('ch1');
    expect(storage.getHistory()[0].id).toBe('ch1');
  });
  test('updates ts on repeat, no duplicate entry', () => {
    storage.addHistory('ch1');
    const ts1 = storage.getHistory()[0].ts;
    storage.addHistory('ch1');
    expect(storage.getHistory()).toHaveLength(1);
    expect(storage.getHistory()[0].ts).toBeGreaterThanOrEqual(ts1);
  });
  test('caps at 100 entries FIFO, oldest evicted', () => {
    for (let i = 0; i < 105; i++) storage.addHistory(`ch${i}`);
    const h = storage.getHistory();
    expect(h).toHaveLength(100);
    expect(h[0].id).toBe('ch104'); // newest first
    // ch0..ch4 must have been evicted
    expect(h.find(x => x.id === 'ch4')).toBeUndefined();
    expect(h.find(x => x.id === 'ch5')).toBeDefined();
  });
  test('clearHistory empties', () => {
    storage.addHistory('ch1');
    storage.clearHistory();
    expect(storage.getHistory()).toHaveLength(0);
  });
});

describe('blacklist', () => {
  test('add and check', () => {
    storage.addBlacklist('ch1');
    expect(storage.isBlacklisted('ch1')).toBe(true);
    expect(storage.isBlacklisted('ch2')).toBe(false);
  });
  test('remove from blacklist', () => {
    storage.addBlacklist('ch1');
    storage.removeBlacklist('ch1');
    expect(storage.isBlacklisted('ch1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- tests/storage.test.js
```

Expected: FAIL — "Cannot find module '../src/storage.js'"

- [ ] **Step 3: Implement src/storage.js**

```js
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

export const storage = {
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
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npm test -- tests/storage.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat: add storage wrapper with favorites/history/blacklist"
```

---

## Chunk 3: EPG Module

### Task 5: EPG manager

**Files:**
- Create: `src/epg.js`
- Create: `tests/epg.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/epg.test.js`:

```js
// Lampa and fetch are set up in tests/setup-globals.js
// Spy on them here so we can track calls and reset between tests
import { epg } from '../src/epg.js';

let sendSpy, fetchSpy;

// XMLTV sample: two programs on perviy.ru
// 20:00–21:00 UTC = 23:00–00:00 MSK; we'll use UTC times directly
const SAMPLE_XMLTV = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="perviy.ru"><display-name>Первый канал</display-name></channel>
  <programme start="20260318200000 +0000" stop="20260318210000 +0000" channel="perviy.ru">
    <title>Новости</title><desc>Главные события</desc>
  </programme>
  <programme start="20260318210000 +0000" stop="20260318220000 +0000" channel="perviy.ru">
    <title>Вечерний Ургант</title><desc></desc>
  </programme>
</tv>`;

beforeEach(() => {
  sendSpy  = jest.spyOn(Lampa.Listener, 'send').mockImplementation(() => {});
  fetchSpy = jest.spyOn(global, 'fetch');
  epg.reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('epg source priority', () => {
  test('uses settingsEpgUrl when both are set', async () => {
    fetchSpy.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_XMLTV) });
    epg.init([{ tvgId: 'perviy.ru', id: 'perviy.ru' }], 'http://playlist.com', 'http://settings.com');
    await epg.fetchInBackground();
    expect(fetchSpy).toHaveBeenCalledWith('http://settings.com');
  });

  test('falls back to playlistEpgUrl when settingsEpgUrl is empty', async () => {
    fetchSpy.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_XMLTV) });
    epg.init([{ tvgId: 'perviy.ru', id: 'perviy.ru' }], 'http://playlist.com', '');
    await epg.fetchInBackground();
    expect(fetchSpy).toHaveBeenCalledWith('http://playlist.com');
  });

  test('does nothing when no EPG URL configured', async () => {
    epg.init([{ tvgId: 'perviy.ru', id: 'perviy.ru' }], null, '');
    await epg.fetchInBackground();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('EPG load events', () => {
  test('fires liptv:epg_loaded after successful fetch', async () => {
    fetchSpy.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_XMLTV) });
    epg.init([{ tvgId: 'perviy.ru', id: 'perviy.ru' }], null, 'http://epg.com');
    await epg.fetchInBackground();
    expect(sendSpy).toHaveBeenCalledWith('liptv:epg_loaded', {});
  });

  test('does not throw on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));
    epg.init([{ tvgId: 'perviy.ru', id: 'perviy.ru' }], null, 'http://epg.com');
    await expect(epg.fetchInBackground()).resolves.not.toThrow();
  });
});

describe('getCurrent / getNext', () => {
  // NOW = 20:30 UTC — inside first program (20:00–21:00)
  const NOW = new Date('2026-03-18T20:30:00Z');

  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW.getTime() });
    fetchSpy.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_XMLTV) });
    epg.init([{ tvgId: 'perviy.ru', id: 'perviy.ru' }], null, 'http://epg.com');
    await epg.fetchInBackground();
  });

  afterEach(() => jest.useRealTimers());

  test('getCurrent returns the airing program', () => {
    expect(epg.getCurrent('perviy.ru').title).toBe('Новости');
  });

  test('getNext returns the following program', () => {
    expect(epg.getNext('perviy.ru').title).toBe('Вечерний Ургант');
  });

  test('getCurrent returns null for unknown channel', () => {
    expect(epg.getCurrent('unknown')).toBeNull();
  });

  test('getAll returns all programs for channel', () => {
    expect(epg.getAll('perviy.ru')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- tests/epg.test.js
```

Expected: FAIL — "Cannot find module '../src/epg.js'"

- [ ] **Step 3: Implement src/epg.js**

```js
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
  return map;
}

let _programs = {};
let _epgUrl   = null;

export const epg = {
  reset() {
    _programs = {};
    _epgUrl   = null;
  },

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
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npm test -- tests/epg.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/epg.js tests/epg.test.js
git commit -m "feat: add EPG module with XMLTV parsing and background fetch"
```

---

## Chunk 4: UI Components

**Important:** Before each UI task, check `docs/lampa-api-notes.md`. All Lampa API calls below (`Lampa.Settings.addParam`, `Lampa.Select.show`, `Lampa.Noty.show`, `Lampa.Activity.push`, `Lampa.Player.play`) are best-guess patterns — adjust to actual API if they differ.

### Task 6: Settings screen

**Files:**
- Create: `src/ui/settings.js`

- [ ] **Step 1: Create src/ui/settings.js**

```js
import { storage } from '../storage.js';

export function registerSettings(onM3uChange) {
  Lampa.Settings.listener.follow('open', function(e) {
    if (e.name !== 'main') return;

    Lampa.Settings.addParam({ component: 'head',   name: 'liptv_head', label: 'IPTV' });

    Lampa.Settings.addParam({
      component:   'input',
      name:        'liptv_m3u_url',
      label:       'M3U URL',
      placeholder: 'http://',
      onChange:    (v) => { storage.setM3uUrl(v); if (typeof onM3uChange === 'function') onM3uChange(v); }
    });

    Lampa.Settings.addParam({
      component:   'input',
      name:        'liptv_epg_url',
      label:       'EPG URL (XMLTV, необязательно)',
      placeholder: 'http://',
      onChange:    (v) => storage.setEpgUrl(v)
    });

    Lampa.Settings.addParam({
      component: 'select',
      name:      'liptv_view_mode',
      label:     'Режим отображения',
      values:    { list: 'Список', grid: 'Сетка' },
      onChange:  (v) => storage.setViewMode(v)
    });

    Lampa.Settings.addParam({
      component: 'button',
      name:      'liptv_hidden',
      label:     'Скрытые каналы',
      onClick:   showHiddenChannels
    });

    Lampa.Settings.addParam({
      component: 'button',
      name:      'liptv_clear_history',
      label:     'Очистить историю',
      onClick:   () => { storage.clearHistory(); Lampa.Noty.show('История очищена'); }
    });
  });
}

// channelMap: id -> name (passed from index.js for display purposes)
let _channelMap = {};
export function setChannelMap(map) { _channelMap = map; }

function showHiddenChannels() {
  const blacklist = storage.getBlacklist();
  if (blacklist.length === 0) { Lampa.Noty.show('Нет скрытых каналов'); return; }

  const items = blacklist.map(id => ({
    title:    _channelMap[id] || id,
    subtitle: 'Нажмите для восстановления'
  }));

  Lampa.Select.show({
    title:    'Скрытые каналы',
    items:    items,
    onSelect: (item, index) => {
      storage.removeBlacklist(blacklist[index]);
      Lampa.Noty.show(`Канал "${items[index].title}" восстановлен`);
    }
  });
}
```

- [ ] **Step 2: Build — verify no errors**

```bash
npm run build
```

Expected: `dist/lampa-iptv.js` created, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/settings.js
git commit -m "feat: add settings screen"
```

---

### Task 7: Main screen

**Files:**
- Create: `src/ui/main.js`

- [ ] **Step 1: Create src/ui/main.js**

```js
import { storage } from '../storage.js';
import { epg }     from '../epg.js';

const VIRTUAL_GROUPS = ['Все', 'Избранное', 'История'];

export function createMainScreen(allChannels, onChannelSelect) {
  let currentGroup = 'Все';
  let viewMode     = storage.getViewMode();

  const groups = VIRTUAL_GROUPS.concat(
    [...new Set(allChannels.map(ch => ch.group))].filter(Boolean)
  );

  function getVisible() {
    const blacklist = storage.getBlacklist();
    let list = allChannels.filter(ch => !blacklist.includes(ch.id));

    if (currentGroup === 'Избранное') {
      const favs = storage.getFavorites();
      list = list.filter(ch => favs.includes(ch.id));
    } else if (currentGroup === 'История') {
      const history = storage.getHistory();
      const rank = {};
      history.forEach((h, i) => { rank[h.id] = i; });
      list = list.filter(ch => ch.id in rank).sort((a, b) => rank[a.id] - rank[b.id]);
    } else if (currentGroup !== 'Все') {
      list = list.filter(ch => ch.group === currentGroup);
    }
    return list;
  }

  function channelHtml(ch) {
    const cur = epg.getCurrent(ch.id);
    const prog = cur ? cur.title : '';
    const logo = ch.logo
      ? `<img class="liptv-logo" src="${ch.logo}" onerror="this.style.display='none'">`
      : '<div class="liptv-logo liptv-no-logo"></div>';

    if (viewMode === 'grid') {
      return `<div class="liptv-tile selector" data-id="${ch.id}">${logo}<div class="liptv-tile-name">${ch.name}</div></div>`;
    }
    return `<div class="liptv-row selector" data-id="${ch.id}">
      ${logo}
      <div class="liptv-row-info">
        <div class="liptv-row-name">${ch.name}</div>
        <div class="liptv-row-prog">${prog}</div>
      </div>
    </div>`;
  }

  function render(body) {
    const visible = getVisible();
    body.empty().append(`
      <div class="liptv-wrap">
        <div class="liptv-toolbar">
          <div class="liptv-btn selector" data-action="search">Поиск</div>
          <div class="liptv-btn selector" data-action="toggle">
            ${viewMode === 'list' ? '⊞ Сетка' : '☰ Список'}
          </div>
        </div>
        <div class="liptv-body">
          <div class="liptv-sidebar">
            ${groups.map(g =>
              `<div class="liptv-group selector${g === currentGroup ? ' active' : ''}" data-group="${g}">${g}</div>`
            ).join('')}
          </div>
          <div class="liptv-channels ${viewMode}">
            ${visible.length
              ? visible.map(channelHtml).join('')
              : '<div class="liptv-empty">Нет каналов</div>'}
          </div>
        </div>
      </div>
    `);

    body.find('[data-group]').on('click', function() {
      currentGroup = $(this).data('group');
      render(body);
    });

    body.find('[data-action="toggle"]').on('click', function() {
      viewMode = viewMode === 'list' ? 'grid' : 'list';
      storage.setViewMode(viewMode);
      render(body);
    });

    body.find('[data-action="search"]').on('click', function() {
      onChannelSelect(null, 'search');
    });

    body.find('[data-id]').on('click', function() {
      const id = $(this).data('id');
      const ch = allChannels.find(c => c.id === id);
      if (ch) onChannelSelect(ch, 'card');
    });
  }

  // Refresh EPG labels when data loads — no full re-render
  Lampa.Listener.follow('liptv:epg_loaded', function() {
    document.querySelectorAll('.liptv-row[data-id]').forEach(el => {
      const cur = epg.getCurrent(el.dataset.id);
      const progEl = el.querySelector('.liptv-row-prog');
      if (progEl && cur) progEl.textContent = cur.title;
    });
  });

  return { render };
}
```

- [ ] **Step 2: Build — verify no errors**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/main.js
git commit -m "feat: add main screen with groups/list/grid/EPG labels"
```

---

### Task 8: Channel card

**Files:**
- Create: `src/ui/card.js`

- [ ] **Step 1: Create src/ui/card.js**

```js
import { storage }       from '../storage.js';
import { epg }           from '../epg.js';
import { showEpgScreen } from './epg-screen.js';

export function showCard(channel, onClose) {
  const cur  = epg.getCurrent(channel.id);
  const next = epg.getNext(channel.id);
  const isFav = storage.isFavorite(channel.id);

  const actions = [
    { title: '▶ Смотреть',   fn: () => playChannel(channel) },
    { title: isFav ? '★ Убрать из избранного' : '☆ В избранное',
      fn: () => { toggleFav(channel); if (onClose) onClose(); } },
    { title: '📋 Программа', fn: () => openEpgScreen(channel) },
    { title: '🚫 Скрыть',    fn: () => { storage.addBlacklist(channel.id); Lampa.Noty.show(`"${channel.name}" скрыт`); if (onClose) onClose(); } }
  ];

  Lampa.Select.show({
    title: channel.name,
    items: [
      { title: cur  ? `Сейчас: ${cur.title}`  : 'Сейчас: —', noclick: true },
      { title: next ? `Далее: ${next.title}`   : 'Далее: —',  noclick: true },
      ...actions.map(a => ({ title: a.title }))
    ],
    onSelect: (item, index) => {
      if (index >= 2) actions[index - 2].fn();
    }
  });
}

function playChannel(channel) {
  Lampa.Player.play({ url: channel.url, title: channel.name });
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

function openEpgScreen(channel) {
  showEpgScreen(channel);
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/card.js
git commit -m "feat: add channel card with play/favorite/hide"
```

---

### Task 9: EPG screen + Search screen

**Files:**
- Create: `src/ui/epg-screen.js`
- Create: `src/ui/search.js`

- [ ] **Step 1: Create src/ui/epg-screen.js**

```js
import { epg } from '../epg.js';

function fmt(date) {
  if (!date) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function showEpgScreen(channel) {
  const programs = epg.getAll(channel.id);
  if (programs.length === 0) { Lampa.Noty.show('Программа недоступна'); return; }

  const now = new Date();
  const items = programs.map(p => ({
    title:    `${fmt(p.start)}–${fmt(p.stop)}  ${p.title}`,
    subtitle: p.desc || '',
    active:   p.start <= now && (!p.stop || p.stop > now)
  }));

  Lampa.Select.show({
    title:    `${channel.name} — Программа`,
    items:    items.map(i => ({ title: i.title, subtitle: i.subtitle })),
    onSelect: () => {} // read-only screen
  });
}
```

- [ ] **Step 2: Create src/ui/search.js**

```js
import { epg }      from '../epg.js';
import { showCard } from './card.js';

export function showSearch(allChannels) {
  // Lampa keyboard input — verify exact API from lampa-api-notes.md
  // Pattern below uses Lampa.Input.show if available; adjust if needed
  Lampa.Input.show({
    title:       'Поиск',
    placeholder: 'Название канала или передачи',
    onEnter: (query) => {
      const q = query.toLowerCase().trim();
      if (!q) return;

      const byName = allChannels.filter(ch => ch.name.toLowerCase().includes(q));
      const nameIds = new Set(byName.map(ch => ch.id));
      const byProg  = allChannels.filter(ch =>
        !nameIds.has(ch.id) &&
        epg.getAll(ch.id).some(p => p.title.toLowerCase().includes(q))
      );
      const results = [...byName, ...byProg];

      if (results.length === 0) { Lampa.Noty.show('Ничего не найдено'); return; }

      Lampa.Select.show({
        title:    `Результаты (${results.length})`,
        items:    results.map(ch => {
          const cur = epg.getCurrent(ch.id);
          return { title: ch.name, subtitle: cur ? cur.title : '' };
        }),
        onSelect: (item, index) => showCard(results[index], () => {})
      });
    }
  });
}
```

**Note:** If `Lampa.Input.show` does not exist, check `Lampa.Prompt`, `Lampa.Keyboard`, or use a custom input inside a `Lampa.Component`. Consult `lampa-api-notes.md`.

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/epg-screen.js src/ui/search.js
git commit -m "feat: add EPG screen and search screen"
```

---

## Chunk 5: Entry Point + History Tracking + Final Build

### Task 10: Plugin entry point

**Files:**
- Create: `src/index.js`

- [ ] **Step 1: Re-check lampa-api-notes.md**

Before writing, confirm the exact names for:
- Component registration pattern
- `Lampa.Activity.push` signature
- Player event names (start/stop)
- App start event

- [ ] **Step 2: Create src/index.js**

```js
import { fetchM3U }          from './parser.js';
import { epg }               from './epg.js';
import { storage }           from './storage.js';
import { createMainScreen }  from './ui/main.js';
import { showCard }          from './ui/card.js';
import { showSearch }        from './ui/search.js';
import { registerSettings, setChannelMap } from './ui/settings.js';

(function() {
  'use strict';

  let historyTimer = null;

  function startHistoryTracking(channelId) {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => storage.addHistory(channelId), 10000);
  }

  function stopHistoryTracking() {
    clearTimeout(historyTimer);
    historyTimer = null;
  }

  async function launch() {
    const m3uUrl = storage.getM3uUrl();

    if (!m3uUrl) {
      Lampa.Noty.show('IPTV: укажите M3U URL в настройках');
      // Open settings — verify exact API
      Lampa.Activity.push({ component: 'settings', title: 'Настройки' });
      return;
    }

    let parsed;
    try {
      parsed = await fetchM3U(m3uUrl);
    } catch (e) {
      // TODO (v0.2.0): spec requires an error screen with a "Повторить" button.
      // v0.1.0 ships a toast. Track this as a known gap — add a retry screen task
      // in the next plan iteration before marking v0.1.0 as spec-complete.
      Lampa.Noty.show('Не удалось загрузить плейлист: ' + e.message);
      return;
    }

    const { channels, playlistEpgUrl } = parsed;

    // Build id->name map for settings hidden channels display
    const channelMap = {};
    channels.forEach(ch => { channelMap[ch.id] = ch.name; });
    setChannelMap(channelMap);

    const blacklist = storage.getBlacklist();
    const visible   = channels.filter(ch => !blacklist.includes(ch.id));

    // body is declared here so it's accessible in both the component and the callback
    var _body;

    const mainScreen = createMainScreen(visible, function(channel, action) {
      if (action === 'search') return showSearch(visible);
      if (action === 'card')   return showCard(channel, () => mainScreen.render(_body));
    });

    // Register Lampa component — adjust pattern to actual API
    Lampa.Component.add('liptv_main', function() {
      this.create = function() {
        _body = $(this.activity.body);
        mainScreen.render(_body);
      };

      this.destroy = function() {
        stopHistoryTracking();
        Lampa.Listener.remove('liptv:epg_loaded');
      };
    });

    Lampa.Activity.push({ url: '', component: 'liptv_main', title: 'IPTV' });

    // Start EPG in background
    epg.init(channels, playlistEpgUrl, storage.getEpgUrl());
    epg.fetchInBackground();

    // History tracking — adjust event names to actual Lampa player events
    Lampa.Listener.follow('player:start', function(e) {
      const url = e && (e.url || (e.data && e.data.url));
      if (!url) return;
      const ch = channels.find(c => c.url === url);
      if (ch) startHistoryTracking(ch.id);
    });
    Lampa.Listener.follow('player:stop',  stopHistoryTracking);
    Lampa.Listener.follow('player:error', stopHistoryTracking);
  }

  function init() {
    registerSettings(() => launch()); // re-launch when M3U URL changes

    // Add IPTV to Lampa home — adjust event name to actual app start event
    Lampa.Listener.follow('app:start', function() {
      launch();
    });
  }

  if (window.Lampa && Lampa.Activity) init();
  else window.addEventListener('lampa:ready', init);
})();
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: `dist/lampa-iptv.js` created, no errors.

- [ ] **Step 4: Run all unit tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.js
git commit -m "feat: add plugin entry point with startup flow and history tracking"
```

---

### Task 11: Smoke test in Lampa browser

- [ ] **Step 1: Serve the bundle**

```bash
npx serve dist --cors -p 8080
```

Note the local URL, e.g. `http://192.168.x.x:8080/lampa-iptv.js`

- [ ] **Step 2: Load plugin in Lampa**

Lampa → Settings → Плагины → Add URL → enter the URL above → confirm.

- [ ] **Step 3a: Check core registration (stop if these fail, fix before continuing)**

- [ ] Plugin loads without JS errors in browser console
- [ ] IPTV entry appears in Lampa home/catalog
- [ ] First launch without M3U URL → redirects to settings (or shows toast)
- [ ] Enter a valid M3U URL → channels load and appear

If fewer than 3 of these pass: return to Task 2, update `lampa-api-notes.md` with correct API, and fix `src/index.js` + `src/ui/settings.js`. Rebuild and re-test step 3a before continuing.

- [ ] **Step 3b: Check channel list and interaction**

- [ ] Groups sidebar filters channels correctly
- [ ] List ↔ Grid toggle works and persists after restart
- [ ] Channel card opens; shows name + current/next EPG (after XMLTV loads)
- [ ] Play → stream starts in Lampa player
- [ ] Favorite → channel appears in "Избранное" group
- [ ] Hide → channel disappears immediately
- [ ] "Скрытые каналы" in settings shows hidden channel; Restore works immediately

- [ ] **Step 3c: Check secondary features**

- [ ] "Очистить историю" works
- [ ] Search by channel name returns results
- [ ] After 10+ seconds of playback, channel appears in "История"
- [ ] EPG screen shows program list for a channel

- [ ] **Step 4: Fix API mismatches**

For any Lampa calls that fail (wrong method name, wrong signature):
1. Check `docs/lampa-api-notes.md` for correct API
2. Fix in the relevant `src/ui/*.js` or `src/index.js`
3. Rebuild and re-test the affected step

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: adjust Lampa API calls after smoke test"
```

- [ ] **Step 6: Tag release**

```bash
git tag v0.1.0
```

---

## Known Gaps for v0.2.0

| Gap | Spec Reference | Notes |
|---|---|---|
| Error screen with "Повторить" button on M3U fetch failure | Error Handling table, row 1 | v0.1.0 shows a toast instead; implement a `ui/error-screen.js` component with retry callback |
| Error screen when M3U URL was cleared | Error Handling table, row 7 | Same component as above |
