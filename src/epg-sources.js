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
  s = s.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');
  s = s.replace(/\b(hd|sd|fhd|uhd|4k)\s*$/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function detectCountries(channels, maxCount) {
  var counts = {};
  channels.forEach(function(ch) {
    if (!ch.tvgId) return;
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

export function buildChannelMapping(epgChannels, playlistChannels) {
  var mapping = new Map();
  var tvgIdToId = {};
  playlistChannels.forEach(function(ch) {
    if (ch.tvgId) tvgIdToId[ch.tvgId] = ch.id;
  });
  var nameToId = {};
  playlistChannels.forEach(function(ch) {
    var norm = normalizeName(ch.name);
    if (norm && !nameToId[norm]) nameToId[norm] = ch.id;
  });
  epgChannels.forEach(function(epgCh) {
    if (tvgIdToId[epgCh.id] !== undefined) {
      mapping.set(epgCh.id, tvgIdToId[epgCh.id]);
      return;
    }
    var norm = normalizeName(epgCh.displayName);
    if (norm && nameToId[norm] !== undefined) {
      mapping.set(epgCh.id, nameToId[norm]);
    }
  });
  return mapping;
}

export function resolveEpgUrls(sourceKey, channels, playlistEpgUrl, customUrl) {
  if (sourceKey === 'auto') {
    if (playlistEpgUrl && playlistEpgUrl.trim()) {
      return { urls: [playlistEpgUrl.trim()], needsMapping: false };
    }
    var countries = detectCountries(channels, 3);
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
  if (sourceKey === 'playlist') {
    if (playlistEpgUrl && playlistEpgUrl.trim()) {
      return { urls: [playlistEpgUrl.trim()], needsMapping: false };
    }
    return { urls: [], needsMapping: false };
  }
  if (sourceKey === 'custom') {
    if (customUrl && customUrl.trim()) {
      return { urls: [customUrl.trim()], needsMapping: false };
    }
    return { urls: [], needsMapping: false };
  }
  var preset = EPG_PRESETS[sourceKey];
  if (preset && preset.url) {
    return { urls: [preset.url], needsMapping: true };
  }
  return { urls: [], needsMapping: false };
}
