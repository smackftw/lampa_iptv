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
