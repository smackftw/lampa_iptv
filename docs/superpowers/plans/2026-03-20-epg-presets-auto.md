# EPG Presets + Auto-detection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EPG source presets dropdown and auto-detection by country with name-based channel matching.

**Architecture:** New `epg-sources.js` module handles presets, country detection, and name matching. Modified `epg.js` supports multiple URLs, gzip, and channel remapping. Settings UI gets a dropdown replacing the old EPG URL field.

**Tech Stack:** JavaScript (ES modules), Jest for tests, Rollup for bundling. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-20-epg-presets-auto-design.md`

---

## Chunk 1: epg-sources.js — Pure Functions

### Task 1: epg-sources.js — normalizeName, detectCountries, buildChannelMapping, resolveEpgUrls

**Files:**
- Create: `src/epg-sources.js`
- Create: `tests/epg-sources.test.js`

#### Part A: normalizeName

- [ ] **Step 1: Write tests for normalizeName**

In `tests/epg-sources.test.js`:

```javascript
import { normalizeName, detectCountries, buildChannelMapping, resolveEpgUrls, EPG_PRESETS } from '../src/epg-sources.js';

describe('normalizeName', () => {
  test('lowercases and trims', () => {
    expect(normalizeName('  CNN News  ')).toBe('cnn news');
  });

  test('removes trailing HD/SD/FHD/UHD/4K as separate words', () => {
    expect(normalizeName('Матч ТВ HD')).toBe('матч тв');
    expect(normalizeName('Discovery SD')).toBe('discovery');
    expect(normalizeName('National Geographic FHD')).toBe('national geographic');
    expect(normalizeName('Sport 4K')).toBe('sport');
  });

  test('does not remove HD/SD inside channel name', () => {
    expect(normalizeName('HD Theater')).toBe('hd theater');
    expect(normalizeName('SDTV')).toBe('sdtv');
  });

  test('removes resolution in parentheses/brackets', () => {
    expect(normalizeName('CNN (720p)')).toBe('cnn');
    expect(normalizeName('BBC (1080p) [Not 24/7]')).toBe('bbc');
  });

  test('collapses multiple spaces', () => {
    expect(normalizeName('A   B  C')).toBe('a b c');
  });

  test('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest tests/epg-sources.test.js --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement normalizeName and EPG_PRESETS**

In `src/epg-sources.js`:

```javascript
export const EPG_PRESETS = {
  auto:       { label: 'Авто' },
  playlist:   { label: 'Из плейлиста' },
  epgpw_ru:   { label: 'epg.pw — Россия',           url: 'https://epg.pw/xmltv/epg_RU.xml.gz' },
  epgpw_ua:   { label: 'epg.pw — Украина',           url: 'https://epg.pw/xmltv/epg_UA.xml.gz' },
  epgpw_cy:   { label: 'epg.pw — Кипр',              url: 'https://epg.pw/xmltv/epg_CY.xml.gz' },
  epgpw_de:   { label: 'epg.pw — Германия',          url: 'https://epg.pw/xmltv/epg_DE.xml.gz' },
  epgpw_us:   { label: 'epg.pw — США',               url: 'https://epg.pw/xmltv/epg_US.xml.gz' },
  epgpw_gb:   { label: 'epg.pw — Великобритания',    url: 'https://epg.pw/xmltv/epg_GB.xml.gz' },
  epgpw_tr:   { label: 'epg.pw — Турция',            url: 'https://epg.pw/xmltv/epg_TR.xml.gz' },
  epgpw_fr:   { label: 'epg.pw — Франция',           url: 'https://epg.pw/xmltv/epg_FR.xml.gz' },
  custom:     { label: 'Свой URL' }
};

export function normalizeName(name) {
  if (!name) return '';
  var s = name.toLowerCase();
  // Remove content in parentheses and brackets: (720p), [Not 24/7]
  s = s.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');
  // Remove trailing quality suffixes as separate words
  s = s.replace(/\b(hd|sd|fhd|uhd|4k)\s*$/g, '');
  // Collapse whitespace and trim
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx jest tests/epg-sources.test.js --no-coverage`
Expected: All normalizeName tests PASS

#### Part B: detectCountries

- [ ] **Step 5: Add tests for detectCountries**

Append to `tests/epg-sources.test.js`:

```javascript
describe('detectCountries', () => {
  test('extracts country codes from tvgId', () => {
    var channels = [
      { tvgId: 'CNN.us', name: 'CNN' },
      { tvgId: 'BBC.gb', name: 'BBC' },
      { tvgId: 'Fox.us', name: 'Fox' },
    ];
    expect(detectCountries(channels, 3)).toEqual(['US', 'GB']);
  });

  test('handles tvgId with @Quality suffix', () => {
    var channels = [
      { tvgId: '2x2.ru@SD', name: '2x2' },
      { tvgId: 'MatchHD.ru@HD', name: 'Матч' },
    ];
    expect(detectCountries(channels, 3)).toEqual(['RU']);
  });

  test('limits to maxCount', () => {
    var channels = [
      { tvgId: 'A.ru', name: 'A' },
      { tvgId: 'B.ru', name: 'B' },
      { tvgId: 'C.ua', name: 'C' },
      { tvgId: 'D.de', name: 'D' },
    ];
    expect(detectCountries(channels, 2)).toEqual(['RU', 'UA']);
  });

  test('ignores empty tvgId', () => {
    var channels = [
      { tvgId: '', name: 'A' },
      { tvgId: 'B.ru', name: 'B' },
    ];
    expect(detectCountries(channels, 3)).toEqual(['RU']);
  });

  test('returns empty array when no valid tvgId', () => {
    var channels = [
      { tvgId: '', name: 'A' },
      { tvgId: '', name: 'B' },
    ];
    expect(detectCountries(channels, 3)).toEqual([]);
  });
});
```

- [ ] **Step 6: Implement detectCountries**

Append to `src/epg-sources.js`:

```javascript
export function detectCountries(channels, maxCount) {
  var counts = {};
  channels.forEach(function(ch) {
    if (!ch.tvgId) return;
    // Remove @Quality suffix, then extract 2-char country code after last dot
    var base = ch.tvgId.replace(/@.*$/, '');
    var match = base.match(/\.([a-z]{2})$/i);
    if (!match) return;
    var cc = match[1].toUpperCase();
    counts[cc] = (counts[cc] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, maxCount)
    .map(function(e) { return e[0]; });
}
```

- [ ] **Step 7: Run tests, verify they pass**

Run: `npx jest tests/epg-sources.test.js --no-coverage`
Expected: All detectCountries tests PASS

#### Part C: buildChannelMapping

- [ ] **Step 8: Add tests for buildChannelMapping**

Append to `tests/epg-sources.test.js`:

```javascript
describe('buildChannelMapping', () => {
  test('maps by exact tvgId match first', () => {
    var epgChannels = [{ id: 'perviy.ru', displayName: 'Первый канал' }];
    var playlist = [{ id: 'perviy.ru', tvgId: 'perviy.ru', name: 'Первый канал' }];
    var mapping = buildChannelMapping(epgChannels, playlist);
    expect(mapping.get('perviy.ru')).toBe('perviy.ru');
  });

  test('falls back to normalized name match', () => {
    var epgChannels = [{ id: '5755', displayName: 'Матч ТВ HD' }];
    var playlist = [{ id: 'MatchTV.ru', tvgId: 'MatchTV.ru', name: 'Матч ТВ' }];
    var mapping = buildChannelMapping(epgChannels, playlist);
    expect(mapping.get('5755')).toBe('MatchTV.ru');
  });

  test('does not map when no match', () => {
    var epgChannels = [{ id: '999', displayName: 'Unknown Channel' }];
    var playlist = [{ id: 'abc', tvgId: '', name: 'Something Else' }];
    var mapping = buildChannelMapping(epgChannels, playlist);
    expect(mapping.has('999')).toBe(false);
  });

  test('tvgId match takes priority over name match', () => {
    var epgChannels = [{ id: 'perviy.ru', displayName: 'Другое имя' }];
    var playlist = [
      { id: 'perviy.ru', tvgId: 'perviy.ru', name: 'Первый' },
      { id: 'abc', tvgId: '', name: 'Другое имя' },
    ];
    var mapping = buildChannelMapping(epgChannels, playlist);
    expect(mapping.get('perviy.ru')).toBe('perviy.ru');
  });

  test('handles playlist channels with djb2 hash id (empty tvgId)', () => {
    var epgChannels = [{ id: '100', displayName: 'Discovery' }];
    var playlist = [{ id: 'x7f3a', tvgId: '', name: 'Discovery HD' }];
    var mapping = buildChannelMapping(epgChannels, playlist);
    expect(mapping.get('100')).toBe('x7f3a');
  });
});
```

- [ ] **Step 9: Implement buildChannelMapping**

Append to `src/epg-sources.js`:

```javascript
export function buildChannelMapping(epgChannels, playlistChannels) {
  var mapping = new Map();

  // Build lookup: tvgId → channel.id (for direct match)
  var tvgIdToId = {};
  playlistChannels.forEach(function(ch) {
    if (ch.tvgId) tvgIdToId[ch.tvgId] = ch.id;
  });

  // Build lookup: normalizedName → channel.id (for name match)
  var nameToId = {};
  playlistChannels.forEach(function(ch) {
    var norm = normalizeName(ch.name);
    if (norm && !nameToId[norm]) nameToId[norm] = ch.id;
  });

  epgChannels.forEach(function(epgCh) {
    // Priority 1: exact tvgId match
    if (tvgIdToId[epgCh.id] !== undefined) {
      mapping.set(epgCh.id, tvgIdToId[epgCh.id]);
      return;
    }
    // Priority 2: normalized name match
    var norm = normalizeName(epgCh.displayName);
    if (norm && nameToId[norm] !== undefined) {
      mapping.set(epgCh.id, nameToId[norm]);
    }
  });

  return mapping;
}
```

- [ ] **Step 10: Run tests, verify they pass**

Run: `npx jest tests/epg-sources.test.js --no-coverage`
Expected: All buildChannelMapping tests PASS

#### Part D: resolveEpgUrls

- [ ] **Step 11: Add tests for resolveEpgUrls**

Append to `tests/epg-sources.test.js`:

```javascript
describe('resolveEpgUrls', () => {
  var channels = [
    { tvgId: 'A.ru', name: 'A' },
    { tvgId: 'B.ru', name: 'B' },
    { tvgId: 'C.ua', name: 'C' },
  ];

  test('auto with tvg-url uses playlist URL, no mapping', () => {
    var r = resolveEpgUrls('auto', channels, 'http://epg.xml', null);
    expect(r.urls).toEqual(['http://epg.xml']);
    expect(r.needsMapping).toBe(false);
  });

  test('auto without tvg-url detects countries', () => {
    var r = resolveEpgUrls('auto', channels, null, null);
    expect(r.urls).toEqual([
      'https://epg.pw/xmltv/epg_RU.xml.gz',
      'https://epg.pw/xmltv/epg_UA.xml.gz',
    ]);
    expect(r.needsMapping).toBe(true);
  });

  test('playlist with tvg-url', () => {
    var r = resolveEpgUrls('playlist', channels, 'http://epg.xml', null);
    expect(r.urls).toEqual(['http://epg.xml']);
    expect(r.needsMapping).toBe(false);
  });

  test('playlist without tvg-url returns empty', () => {
    var r = resolveEpgUrls('playlist', channels, null, null);
    expect(r.urls).toEqual([]);
  });

  test('preset returns preset URL with mapping', () => {
    var r = resolveEpgUrls('epgpw_ru', channels, null, null);
    expect(r.urls).toEqual(['https://epg.pw/xmltv/epg_RU.xml.gz']);
    expect(r.needsMapping).toBe(true);
  });

  test('custom returns custom URL without mapping', () => {
    var r = resolveEpgUrls('custom', channels, null, 'http://my-epg.xml');
    expect(r.urls).toEqual(['http://my-epg.xml']);
    expect(r.needsMapping).toBe(false);
  });

  test('custom without URL returns empty', () => {
    var r = resolveEpgUrls('custom', channels, null, '');
    expect(r.urls).toEqual([]);
  });

  test('auto with mostly empty tvgId returns empty', () => {
    var noTvg = [
      { tvgId: '', name: 'A' },
      { tvgId: '', name: 'B' },
      { tvgId: '', name: 'C' },
      { tvgId: '', name: 'D' },
      { tvgId: 'E.ru', name: 'E' },
    ];
    var r = resolveEpgUrls('auto', noTvg, null, null);
    // 1/5 = 20% < 30% threshold
    expect(r.urls).toEqual([]);
  });
});
```

- [ ] **Step 12: Implement resolveEpgUrls**

Append to `src/epg-sources.js`:

```javascript
export function resolveEpgUrls(sourceKey, channels, playlistEpgUrl, customUrl) {
  // auto: prefer tvg-url from playlist, else detect countries
  if (sourceKey === 'auto') {
    if (playlistEpgUrl && playlistEpgUrl.trim()) {
      return { urls: [playlistEpgUrl.trim()], needsMapping: false };
    }
    var countries = detectCountries(channels, 3);
    // Check threshold: at least 30% of channels must have parseable tvgId
    var withCountry = channels.filter(function(ch) {
      if (!ch.tvgId) return false;
      var base = ch.tvgId.replace(/@.*$/, '');
      return /\.[a-z]{2}$/i.test(base);
    }).length;
    if (channels.length > 0 && withCountry / channels.length < 0.3) {
      return { urls: [], needsMapping: true };
    }
    var urls = countries.map(function(cc) {
      return 'https://epg.pw/xmltv/epg_' + cc + '.xml.gz';
    });
    return { urls: urls, needsMapping: true };
  }

  // playlist: use tvg-url from M3U header
  if (sourceKey === 'playlist') {
    if (playlistEpgUrl && playlistEpgUrl.trim()) {
      return { urls: [playlistEpgUrl.trim()], needsMapping: false };
    }
    return { urls: [], needsMapping: false };
  }

  // custom: user-provided URL
  if (sourceKey === 'custom') {
    if (customUrl && customUrl.trim()) {
      return { urls: [customUrl.trim()], needsMapping: false };
    }
    return { urls: [], needsMapping: false };
  }

  // Preset (epgpw_ru, epgpw_ua, etc.)
  var preset = EPG_PRESETS[sourceKey];
  if (preset && preset.url) {
    return { urls: [preset.url], needsMapping: true };
  }

  return { urls: [], needsMapping: false };
}
```

- [ ] **Step 13: Run all tests, verify they pass**

Run: `npx jest tests/epg-sources.test.js --no-coverage`
Expected: All tests PASS

- [ ] **Step 14: Commit**

```bash
git add src/epg-sources.js tests/epg-sources.test.js
git commit -m "feat: add epg-sources module with presets, country detection, name matching"
```

---

## Chunk 2: epg.js Modifications + gzip + storage + settings + integration

### Task 2: Modify epg.js — multi-URL, gzip, channel remapping

**Files:**
- Modify: `src/epg.js`
- Modify: `tests/epg.test.js`

- [ ] **Step 1: Update parseXMLTV to return channels**

In `src/epg.js`, find the function `parseXMLTV(xmlText)` (starts with `function parseXMLTV(xmlText) {`). Replace the entire function with:

```javascript
function parseXMLTV(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const programs = {};
  const channels = [];

  doc.querySelectorAll('channel').forEach(node => {
    const id = node.getAttribute('id');
    const dn = node.querySelector('display-name');
    if (id) channels.push({ id: id, displayName: dn ? dn.textContent : '' });
  });

  doc.querySelectorAll('programme').forEach(node => {
    const channelId = node.getAttribute('channel');
    const start = parseXmltvDate(node.getAttribute('start'));
    const stop  = parseXmltvDate(node.getAttribute('stop'));
    const title = node.querySelector('title')?.textContent || '';
    const desc  = node.querySelector('desc')?.textContent  || '';
    if (!channelId || !start) return;
    if (!programs[channelId]) programs[channelId] = [];
    programs[channelId].push({ channelId, title, start, stop, desc });
  });
  Object.keys(programs).forEach(id => programs[id].sort((a, b) => a.start - b.start));
  return { programs, channels };
}
```

- [ ] **Step 2: Add static import and gzip decompression helper**

Add at the top of `src/epg.js` (after the existing code, before `export const epg`):

```javascript
import { buildChannelMapping } from './epg-sources.js';
```

Add this function before the `export const epg` block in `src/epg.js`:

```javascript
async function fetchXmlText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Check gzip magic number: 0x1f 0x8b
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const stream = new Response(new Blob([buf]).stream().pipeThrough(ds));
      return await stream.text();
    }
    // Fallback: try without .gz
    var fallbackUrl = url.replace(/\.gz$/, '');
    if (fallbackUrl !== url) {
      var res2 = await fetch(fallbackUrl);
      if (res2.ok) return await res2.text();
    }
    return null;
  }
  // Not gzip — decode as text
  return new TextDecoder().decode(buf);
}
```

- [ ] **Step 3: Update epg module state and init()**

Replace the module state variables and `init` method. Find the block:

```javascript
let _programs = {};
let _epgUrl   = null;

export const epg = {
  reset() {
    _programs = {};
    _epgUrl   = null;
  },

  // channels param reserved for future tvgId→channelId mapping
  init(channels, playlistEpgUrl, settingsEpgUrl) {
    _epgUrl = (settingsEpgUrl || '').trim() || (playlistEpgUrl || '').trim() || null;
  },
```

Replace with:

```javascript
let _programs        = {};
let _urls            = [];
let _playlistChannels = [];
let _needsMapping    = false;

export const epg = {
  reset() {
    _programs        = {};
    _urls            = [];
    _playlistChannels = [];
    _needsMapping    = false;
  },

  init(urls, playlistChannels, needsMapping) {
    _urls             = urls || [];
    _playlistChannels = playlistChannels || [];
    _needsMapping     = !!needsMapping;
  },
```

- [ ] **Step 4: Update fetchInBackground()**

Replace the existing `fetchInBackground()` method (find the block that starts with `async fetchInBackground() {` and ends before `getCurrent(`) with:

```javascript
  async fetchInBackground() {
    if (_urls.length === 0) return;
    for (var i = 0; i < _urls.length; i++) {
      try {
        var text = await fetchXmlText(_urls[i]);
        if (!text) continue;
        var parsed = parseXMLTV(text);

        if (_needsMapping && _playlistChannels.length > 0) {
          var mapping = buildChannelMapping(parsed.channels, _playlistChannels);
          // Remap: EPG channel ID → playlist channel ID
          mapping.forEach(function(playlistId, epgId) {
            if (parsed.programs[epgId] && !_programs[playlistId]) {
              _programs[playlistId] = parsed.programs[epgId];
            }
          });
          // Also keep unmapped programs (may match by tvgId directly)
          Object.keys(parsed.programs).forEach(function(epgId) {
            if (!_programs[epgId]) _programs[epgId] = parsed.programs[epgId];
          });
        } else {
          // No mapping needed — merge directly
          Object.keys(parsed.programs).forEach(function(id) {
            if (!_programs[id]) _programs[id] = parsed.programs[id];
          });
        }
      } catch (e) {
        console.warn('[lampa-iptv] EPG fetch failed:', e.message);
      }
    }
    if (Object.keys(_programs).length > 0) {
      Lampa.Listener.send('liptv:epg_loaded', {});
    }
  },
```

- [ ] **Step 5: Update existing tests in epg.test.js**

The existing tests pass `init(channels, playlistEpgUrl, settingsEpgUrl)` — the old signature. Update them to new signature `init(urls, playlistChannels, needsMapping)`.

In `tests/epg.test.js`, replace the `describe('epg source priority')` block entirely with:

```javascript
describe('epg init and fetch', () => {
  test('fetches from provided URLs', async () => {
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV).buffer) });
    epg.init(['http://epg.com'], [], false);
    await epg.fetchInBackground();
    expect(fetchSpy).toHaveBeenCalledWith('http://epg.com');
  });

  test('does nothing when no URLs', async () => {
    epg.init([], [], false);
    await epg.fetchInBackground();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

Update the `describe('EPG load events')` block:

```javascript
describe('EPG load events', () => {
  test('fires liptv:epg_loaded after successful fetch', async () => {
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV).buffer) });
    epg.init(['http://epg.com'], [], false);
    await epg.fetchInBackground();
    expect(sendSpy).toHaveBeenCalledWith('liptv:epg_loaded', {});
  });

  test('does not throw on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));
    epg.init(['http://epg.com'], [], false);
    await expect(epg.fetchInBackground()).resolves.not.toThrow();
  });
});
```

Update `beforeEach` in `describe('getCurrent / getNext')`:

```javascript
  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW.getTime() });
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV).buffer) });
    epg.init(['http://epg.com'], [], false);
    await epg.fetchInBackground();
  });
```

- [ ] **Step 6: Add tests for channel remapping and multi-URL merge**

Append to `tests/epg.test.js`:

```javascript
const SAMPLE_XMLTV_NUMERIC = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="5755"><display-name>Матч ТВ HD</display-name></channel>
  <programme start="20260318200000 +0000" stop="20260318210000 +0000" channel="5755">
    <title>Футбол</title><desc></desc>
  </programme>
</tv>`;

const SAMPLE_XMLTV_SECOND = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="999"><display-name>НТВ</display-name></channel>
  <programme start="20260318200000 +0000" stop="20260318210000 +0000" channel="999">
    <title>Сериал</title><desc></desc>
  </programme>
</tv>`;

describe('channel remapping with needsMapping', () => {
  const NOW = new Date('2026-03-18T20:30:00Z');

  beforeEach(() => jest.useFakeTimers({ now: NOW.getTime() }));
  afterEach(() => jest.useRealTimers());

  test('remaps EPG numeric ID to playlist tvgId via name match', async () => {
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV_NUMERIC).buffer) });
    var channels = [{ id: 'MatchTV.ru', tvgId: 'MatchTV.ru', name: 'Матч ТВ' }];
    epg.init(['http://epg.com'], channels, true);
    await epg.fetchInBackground();
    // Should find program under playlist ID, not EPG numeric ID
    expect(epg.getCurrent('MatchTV.ru')).not.toBeNull();
    expect(epg.getCurrent('MatchTV.ru').title).toBe('Футбол');
  });
});

describe('multi-URL merge', () => {
  const NOW = new Date('2026-03-18T20:30:00Z');

  beforeEach(() => jest.useFakeTimers({ now: NOW.getTime() }));
  afterEach(() => jest.useRealTimers());

  test('merges programs from multiple URLs without overwriting', async () => {
    var callCount = 0;
    fetchSpy.mockImplementation(function() {
      callCount++;
      var xml = callCount === 1 ? SAMPLE_XMLTV : SAMPLE_XMLTV_SECOND;
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(xml).buffer) });
    });
    epg.init(['http://epg1.com', 'http://epg2.com'], [], false);
    await epg.fetchInBackground();
    expect(epg.getCurrent('perviy.ru')).not.toBeNull();
    expect(epg.getCurrent('999')).not.toBeNull();
  });
});
```

- [ ] **Step 7: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/epg.js tests/epg.test.js
git commit -m "feat: epg.js supports multi-URL, gzip, channel remapping"
```

### Task 3: storage.js + settings.js — EPG source dropdown

**Files:**
- Modify: `src/storage.js`
- Modify: `src/ui/settings.js`

- [ ] **Step 1: Add epg source to storage**

In `src/storage.js`, add `liptv_epg_source: 'auto'` to the `DEFAULTS` object (after `liptv_epg_url`):

```javascript
const DEFAULTS = {
  liptv_m3u_url:    '',
  liptv_epg_url:    '',
  liptv_epg_source: 'auto',
  liptv_view_mode:  'list',
  liptv_favorites:  [],
  liptv_history:    [],
  liptv_blacklist:  []
};
```

Add getter/setter in the `storage` export, after `setEpgUrl`:

```javascript
  getEpgSource: () => get('liptv_epg_source'),
  setEpgSource: (v) => set('liptv_epg_source', v),
```

- [ ] **Step 2: Update settings.js — add EPG source dropdown, modify registerSettings signature**

In `src/ui/settings.js`, add import at top:

```javascript
import { EPG_PRESETS } from '../epg-sources.js';
```

Change `registerSettings` signature from `registerSettings(onM3uChange)` to `registerSettings(onM3uChange, onEpgChange)`.

Find and replace the entire `liptv_epg_url` block (from `Lampa.SettingsApi.addParam({` with `name: 'liptv_epg_url'` through its closing `});`):

```javascript
  // OLD — remove this entire block:
  Lampa.SettingsApi.addParam({
    component: 'liptv',
    param:  { name: 'liptv_epg_url', type: 'trigger', default: false },
    field:  { name: 'EPG URL (XMLTV)', description: storage.getEpgUrl() || 'Не задан' },
    onChange: function() {
      promptUrl('EPG URL', storage.getEpgUrl() || '', function(v) {
        storage.setEpgUrl(v.trim());
      });
    }
  });
```

Replace with two new params:

```javascript
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
    onChange: function(e) {
      storage.setEpgSource(e.value || 'auto');
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
```

- [ ] **Step 3: Run tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS (storage tests may test old API — check and fix if needed)

- [ ] **Step 4: Commit**

```bash
git add src/storage.js src/ui/settings.js
git commit -m "feat: add EPG source dropdown in settings"
```

### Task 4: index.js integration — wire everything together

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add import and update loadAndRender**

Add import at top of `src/index.js`:

```javascript
import { resolveEpgUrls } from './epg-sources.js';
```

In `loadAndRender()`, find the EPG init block:

```javascript
    // Start EPG fetch in background — does not block rendering
    epg.reset();
    epg.init(channels, playlistEpgUrl, storage.getEpgUrl());
    epg.fetchInBackground();
```

Replace with:

```javascript
    // Resolve EPG source and start fetch in background
    epg.reset();
    var epgSource = storage.getEpgSource();
    var resolved = resolveEpgUrls(epgSource, channels, playlistEpgUrl, storage.getEpgUrl());
    if (resolved.urls.length === 0 && epgSource === 'auto' && !playlistEpgUrl) {
      Lampa.Noty.show('Не удалось определить EPG автоматически, выберите источник в настройках');
    }
    if (resolved.urls.length === 0 && epgSource === 'playlist' && !playlistEpgUrl) {
      Lampa.Noty.show('Плейлист не содержит EPG URL');
    }
    epg.init(resolved.urls, channels, resolved.needsMapping);
    epg.fetchInBackground();
```

- [ ] **Step 2: Update registerSettings call**

Find:

```javascript
    registerSettings(function() { loadAndRender(); });
```

Replace with:

```javascript
    registerSettings(
      function() { loadAndRender(); },   // onM3uChange
      function() { loadAndRender(); }    // onEpgChange — reload EPG
    );
```

- [ ] **Step 3: Build and run tests**

Run: `npx jest --no-coverage && npx rollup -c`
Expected: All tests PASS, build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/index.js
git commit -m "feat: integrate EPG presets and auto-detection in index.js"
```

### Task 5: Build, smoke test, push

**Files:**
- Modify: `dist/lampa-iptv.js` (build output)

- [ ] **Step 1: Full test suite**

Run: `npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 2: Build**

Run: `npx rollup -c`
Expected: `dist/lampa-iptv.js` created successfully

- [ ] **Step 3: Run smoke tests**

Run: `node tests/smoke-lampa.mjs`
Expected: All smoke tests PASS

- [ ] **Step 4: Commit build and push**

```bash
git add dist/lampa-iptv.js
git commit -m "build: update bundle with EPG presets feature"
git push origin main
```
