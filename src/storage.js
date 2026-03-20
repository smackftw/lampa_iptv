const DEFAULTS = {
  liptv_m3u_url:    '',
  liptv_epg_url:    '',
  liptv_epg_source: 'auto',
  liptv_view_mode:  'list',
  liptv_favorites:  [],
  liptv_history:    [],
  liptv_blacklist:  []
};

function get(key) { return Lampa.Storage.get(key, DEFAULTS[key]); }
function set(key, val) { Lampa.Storage.set(key, val); }

export const storage = {
  getM3uUrl:  () => get('liptv_m3u_url'),
  setM3uUrl:  (v) => set('liptv_m3u_url', v),
  getEpgUrl:    () => get('liptv_epg_url'),
  setEpgUrl:    (v) => set('liptv_epg_url', v),
  getEpgSource: () => get('liptv_epg_source'),
  setEpgSource: (v) => set('liptv_epg_source', v),
  getViewMode:  () => get('liptv_view_mode'),
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
