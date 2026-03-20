import { buildChannelMapping } from './epg-sources.js';

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

async function fetchXmlText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const stream = new Response(new Blob([buf]).stream().pipeThrough(ds));
      return await stream.text();
    }
    var fallbackUrl = url.replace(/\.gz$/, '');
    if (fallbackUrl !== url) {
      var res2 = await fetch(fallbackUrl);
      if (res2.ok) return await res2.text();
    }
    return null;
  }
  return new TextDecoder().decode(buf);
}

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

  async fetchInBackground() {
    if (_urls.length === 0) return;
    for (var i = 0; i < _urls.length; i++) {
      try {
        var text = await fetchXmlText(_urls[i]);
        if (!text) continue;
        var parsed = parseXMLTV(text);

        if (_needsMapping && _playlistChannels.length > 0) {
          var mapping = buildChannelMapping(parsed.channels, _playlistChannels);
          mapping.forEach(function(playlistId, epgId) {
            if (parsed.programs[epgId] && !_programs[playlistId]) {
              _programs[playlistId] = parsed.programs[epgId];
            }
          });
          Object.keys(parsed.programs).forEach(function(epgId) {
            if (!_programs[epgId]) _programs[epgId] = parsed.programs[epgId];
          });
        } else {
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
