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
