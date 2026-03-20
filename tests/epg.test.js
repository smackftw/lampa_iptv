// Lampa and fetch are set up in tests/setup-globals.js
import { epg } from '../src/epg.js';

let sendSpy, fetchSpy;

// XMLTV sample: two programs on perviy.ru
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

beforeEach(() => {
  sendSpy  = jest.spyOn(Lampa.Listener, 'send').mockImplementation(() => {});
  fetchSpy = jest.spyOn(global, 'fetch');
  epg.reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('epg source priority', () => {
  test('uses first URL when called with single URL array', async () => {
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV).buffer) });
    epg.init(['http://settings.com'], [], false);
    await epg.fetchInBackground();
    expect(fetchSpy).toHaveBeenCalledWith('http://settings.com');
  });

  test('fetches from provided URL', async () => {
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV).buffer) });
    epg.init(['http://playlist.com'], [], false);
    await epg.fetchInBackground();
    expect(fetchSpy).toHaveBeenCalledWith('http://playlist.com');
  });

  test('does nothing when no EPG URL configured', async () => {
    epg.init([], [], false);
    await epg.fetchInBackground();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

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

describe('getCurrent / getNext', () => {
  // NOW = 20:30 UTC — inside first program (20:00–21:00)
  const NOW = new Date('2026-03-18T20:30:00Z');

  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW.getTime() });
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV).buffer) });
    epg.init(['http://epg.com'], [], false);
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

describe('channel remapping with needsMapping', () => {
  const NOW = new Date('2026-03-18T20:30:00Z');
  beforeEach(() => jest.useFakeTimers({ now: NOW.getTime() }));
  afterEach(() => jest.useRealTimers());

  test('remaps EPG numeric ID to playlist tvgId via name match', async () => {
    fetchSpy.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(SAMPLE_XMLTV_NUMERIC).buffer) });
    var channels = [{ id: 'MatchTV.ru', tvgId: 'MatchTV.ru', name: 'Матч ТВ' }];
    epg.init(['http://epg.com'], channels, true);
    await epg.fetchInBackground();
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
