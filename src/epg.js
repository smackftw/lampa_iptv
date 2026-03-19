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
  Object.keys(map).forEach(id => map[id].sort((a, b) => a.start - b.start));
  return map;
}

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
