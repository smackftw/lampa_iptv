import { normalizeName, detectCountries, buildChannelMapping, resolveEpgUrls, EPG_PRESETS } from '../src/epg-sources.js';

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------
describe('normalizeName', () => {
  test('lowercases and trims', () => {
    expect(normalizeName('  НТВ  ')).toBe('нтв');
  });

  test('strips trailing HD/SD/FHD/UHD/4K (case-insensitive)', () => {
    expect(normalizeName('Первый канал HD')).toBe('первый канал');
    expect(normalizeName('Russia SD')).toBe('russia');
    expect(normalizeName('Channel FHD')).toBe('channel');
    expect(normalizeName('Movie UHD')).toBe('movie');
    expect(normalizeName('Sport 4K')).toBe('sport');
  });

  test('HD in the middle of name is preserved', () => {
    expect(normalizeName('HD Cinema Extra')).toBe('hd cinema extra');
  });

  test('removes parentheses content', () => {
    expect(normalizeName('BBC (UK)')).toBe('bbc');
  });

  test('removes brackets content', () => {
    expect(normalizeName('CNN [News]')).toBe('cnn');
  });

  test('collapses multiple spaces', () => {
    expect(normalizeName('Первый   Канал')).toBe('первый   канал'.replace(/\s+/g, ' '));
  });

  test('returns empty string for falsy input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// detectCountries
// ---------------------------------------------------------------------------
describe('detectCountries', () => {
  test('extracts country codes from tvgId', () => {
    const channels = [
      { tvgId: 'channel1.ru' },
      { tvgId: 'channel2.ru' },
      { tvgId: 'channel3.ua' },
    ];
    const result = detectCountries(channels, 5);
    expect(result).toEqual(['RU', 'UA']);
  });

  test('strips @Quality suffix before matching', () => {
    const channels = [
      { tvgId: 'perviy.ru@HD' },
      { tvgId: 'ntv.ru@SD' },
      { tvgId: 'bbc.gb@FHD' },
    ];
    const result = detectCountries(channels, 5);
    expect(result).toContain('RU');
    expect(result).toContain('GB');
  });

  test('respects maxCount limit', () => {
    const channels = [
      { tvgId: 'a.ru' }, { tvgId: 'b.ru' },
      { tvgId: 'a.ua' }, { tvgId: 'b.ua' },
      { tvgId: 'a.de' }, { tvgId: 'b.de' },
      { tvgId: 'a.gb' },
    ];
    const result = detectCountries(channels, 2);
    expect(result).toHaveLength(2);
  });

  test('skips channels with no tvgId', () => {
    const channels = [
      { tvgId: null },
      { tvgId: '' },
      { tvgId: 'channel.ru' },
    ];
    const result = detectCountries(channels, 5);
    expect(result).toEqual(['RU']);
  });

  test('returns empty array when all tvgIds are absent', () => {
    const channels = [{ tvgId: null }, {}];
    expect(detectCountries(channels, 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildChannelMapping
// ---------------------------------------------------------------------------
describe('buildChannelMapping', () => {
  test('matches by exact tvgId', () => {
    const epgChannels = [{ id: 'ntv.ru', displayName: 'НТВ' }];
    const playlistChannels = [{ id: 'pl-1', tvgId: 'ntv.ru', name: 'НТВ' }];
    const map = buildChannelMapping(epgChannels, playlistChannels);
    expect(map.get('ntv.ru')).toBe('pl-1');
  });

  test('falls back to normalized name when tvgId not in playlist', () => {
    const epgChannels = [{ id: 'epg-99', displayName: 'Первый Канал HD' }];
    const playlistChannels = [{ id: 'pl-2', tvgId: 'some.other.id', name: 'Первый канал' }];
    const map = buildChannelMapping(epgChannels, playlistChannels);
    expect(map.get('epg-99')).toBe('pl-2');
  });

  test('returns empty map when nothing matches', () => {
    const epgChannels = [{ id: 'xyz', displayName: 'Unknown Channel' }];
    const playlistChannels = [{ id: 'pl-3', tvgId: 'abc.ru', name: 'Другой канал' }];
    const map = buildChannelMapping(epgChannels, playlistChannels);
    expect(map.size).toBe(0);
  });

  test('tvgId match takes priority over name match', () => {
    const epgChannels = [{ id: 'bbc.gb', displayName: 'BBC' }];
    const playlistChannels = [
      { id: 'id-by-tvgid', tvgId: 'bbc.gb', name: 'BBC Extra' },
      { id: 'id-by-name',  tvgId: 'other.xx', name: 'BBC' },
    ];
    const map = buildChannelMapping(epgChannels, playlistChannels);
    expect(map.get('bbc.gb')).toBe('id-by-tvgid');
  });

  test('handles playlist channels with numeric/hash ids', () => {
    const epgChannels = [{ id: 'russia1.ru', displayName: 'Россия 1' }];
    const playlistChannels = [{ id: 12345, tvgId: 'russia1.ru', name: 'Россия 1' }];
    const map = buildChannelMapping(epgChannels, playlistChannels);
    expect(map.get('russia1.ru')).toBe(12345);
  });
});

// ---------------------------------------------------------------------------
// resolveEpgUrls
// ---------------------------------------------------------------------------
describe('resolveEpgUrls', () => {
  const channelsWithCountries = [
    { tvgId: 'ch1.ru' }, { tvgId: 'ch2.ru' }, { tvgId: 'ch3.ru' },
    { tvgId: 'ch4.ua' }, { tvgId: 'ch5.ua' },
    { tvgId: 'ch6.de' },
  ];

  test('auto + playlistEpgUrl: returns playlist url, needsMapping=false', () => {
    const result = resolveEpgUrls('auto', channelsWithCountries, 'http://my-epg.com/epg.xml', null);
    expect(result).toEqual({ urls: ['http://my-epg.com/epg.xml'], needsMapping: false });
  });

  test('auto + no playlist url: detects countries and builds epg.pw urls', () => {
    const result = resolveEpgUrls('auto', channelsWithCountries, '', null);
    expect(result.needsMapping).toBe(true);
    expect(result.urls).toContain('https://epg.pw/xmltv/epg_RU.xml.gz');
    expect(result.urls).toContain('https://epg.pw/xmltv/epg_UA.xml.gz');
    expect(result.urls.length).toBeLessThanOrEqual(3);
  });

  test('playlist + url: returns playlist url, needsMapping=false', () => {
    const result = resolveEpgUrls('playlist', [], 'http://playlist-epg.com/epg.xml', null);
    expect(result).toEqual({ urls: ['http://playlist-epg.com/epg.xml'], needsMapping: false });
  });

  test('playlist + no url: returns empty urls', () => {
    const result = resolveEpgUrls('playlist', [], '', null);
    expect(result).toEqual({ urls: [], needsMapping: false });
  });

  test('preset key (epgpw_ru): returns preset url, needsMapping=true', () => {
    const result = resolveEpgUrls('epgpw_ru', [], '', null);
    expect(result).toEqual({
      urls: [EPG_PRESETS.epgpw_ru.url],
      needsMapping: true,
    });
  });

  test('custom + url: returns custom url, needsMapping=false', () => {
    const result = resolveEpgUrls('custom', [], '', 'http://my-custom-epg.com/epg.xml.gz');
    expect(result).toEqual({ urls: ['http://my-custom-epg.com/epg.xml.gz'], needsMapping: false });
  });

  test('custom + no url: returns empty urls', () => {
    const result = resolveEpgUrls('custom', [], '', '');
    expect(result).toEqual({ urls: [], needsMapping: false });
  });

  test('auto + mostly channels without country suffix: returns empty urls, needsMapping=true', () => {
    const channelsNoCountry = [
      { tvgId: 'channel-without-cc' },
      { tvgId: 'another-channel' },
      { tvgId: 'third-channel' },
      { tvgId: 'fourth' },
      { tvgId: 'ch.ru' }, // only 1 of 5 has country — 20% < 30%
    ];
    const result = resolveEpgUrls('auto', channelsNoCountry, '', null);
    expect(result).toEqual({ urls: [], needsMapping: true });
  });
});
