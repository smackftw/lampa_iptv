/**
 * Injects IPTV plugin CSS into the page <head>.
 * Called once on plugin init.
 */
export function injectStyles() {
  if (document.getElementById('liptv-styles')) return;

  var style = document.createElement('style');
  style.id = 'liptv-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

var CSS = '\
/* ── Layout ───────────────────────────────────── */\
.liptv-container {\
  width: 100%;\
  height: 100%;\
  overflow: hidden;\
}\
.liptv-wrap {\
  display: flex;\
  flex-direction: column;\
  height: 100%;\
}\
\
/* ── Toolbar ──────────────────────────────────── */\
.liptv-toolbar {\
  display: flex;\
  gap: 1em;\
  padding: 1em 1.5em 0.5em;\
  flex-shrink: 0;\
}\
.liptv-btn {\
  padding: 0.5em 1.2em;\
  border-radius: 0.5em;\
  background: rgba(255,255,255,0.08);\
  color: #fff;\
  font-size: 1em;\
  cursor: pointer;\
  white-space: nowrap;\
}\
.liptv-btn.focus {\
  background: rgba(255,255,255,0.28);\
  color: #fff;\
}\
\
/* ── Body: sidebar + channels ─────────────────── */\
.liptv-body {\
  display: flex;\
  flex: 1;\
  overflow: hidden;\
}\
\
/* ── Sidebar (groups) ─────────────────────────── */\
.liptv-sidebar {\
  width: 15em;\
  flex-shrink: 0;\
  overflow-y: auto;\
  padding: 0.5em 0 0.5em 1.5em;\
}\
.liptv-group {\
  padding: 0.5em 1em;\
  margin-bottom: 0.2em;\
  border-radius: 0.4em;\
  color: rgba(255,255,255,0.6);\
  font-size: 0.95em;\
  cursor: pointer;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
.liptv-group.active {\
  color: #fff;\
  background: rgba(255,255,255,0.1);\
}\
.liptv-group.focus {\
  color: #fff;\
  background: rgba(255,255,255,0.22);\
}\
\
/* ── Channel list (list mode) ─────────────────── */\
.liptv-channels {\
  flex: 1;\
  overflow-y: auto;\
  padding: 0.5em 1.5em 2em 1em;\
}\
.liptv-row {\
  display: flex;\
  align-items: center;\
  gap: 1em;\
  padding: 0.6em 1em;\
  margin-bottom: 0.2em;\
  border-radius: 0.5em;\
  cursor: pointer;\
}\
.liptv-row.focus {\
  background: rgba(255,255,255,0.15);\
}\
.liptv-logo {\
  width: 3.5em;\
  height: 3.5em;\
  object-fit: contain;\
  flex-shrink: 0;\
  border-radius: 0.3em;\
}\
.liptv-no-logo {\
  background: rgba(255,255,255,0.05);\
}\
.liptv-row-info {\
  flex: 1;\
  min-width: 0;\
}\
.liptv-row-name {\
  color: #fff;\
  font-size: 1.05em;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
.liptv-row-prog {\
  color: rgba(255,255,255,0.45);\
  font-size: 0.85em;\
  margin-top: 0.15em;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
\
/* ── Channel grid (grid mode) ─────────────────── */\
.liptv-channels.grid {\
  display: flex;\
  flex-wrap: wrap;\
  gap: 1em;\
  align-content: flex-start;\
}\
.liptv-tile {\
  width: 8em;\
  display: flex;\
  flex-direction: column;\
  align-items: center;\
  padding: 0.8em;\
  border-radius: 0.5em;\
  cursor: pointer;\
}\
.liptv-tile.focus {\
  background: rgba(255,255,255,0.15);\
}\
.liptv-tile .liptv-logo {\
  width: 5em;\
  height: 5em;\
  margin-bottom: 0.4em;\
}\
.liptv-tile-name {\
  color: #fff;\
  font-size: 0.85em;\
  text-align: center;\
  max-width: 100%;\
  overflow: hidden;\
  text-overflow: ellipsis;\
  white-space: nowrap;\
}\
\
/* ── Empty state ──────────────────────────────── */\
.liptv-empty {\
  color: rgba(255,255,255,0.4);\
  font-size: 1.1em;\
  padding: 3em 1em;\
  text-align: center;\
}\
\
/* ── OSD mini-list (player overlay) ──────────── */\
.liptv-osd {\
  position: fixed;\
  bottom: 2em;\
  left: 2em;\
  z-index: 9999;\
  background: rgba(0,0,0,0.82);\
  -webkit-backdrop-filter: blur(10px);\
  backdrop-filter: blur(10px);\
  border-radius: 10px;\
  padding: 0.6em 0.8em;\
  min-width: 18em;\
  transform: translateX(-110%);\
  opacity: 0;\
  transition: transform 300ms ease-out, opacity 300ms ease-out;\
  pointer-events: none;\
}\
.liptv-osd.visible {\
  transform: translateX(0);\
  opacity: 1;\
  pointer-events: auto;\
}\
.liptv-osd.fade-out {\
  transform: translateX(0);\
  opacity: 0;\
  transition: opacity 300ms ease-in;\
}\
.liptv-osd-item {\
  display: flex;\
  align-items: center;\
  gap: 0.5em;\
  padding: 0.25em 0;\
  opacity: 0.4;\
}\
.liptv-osd-item.current {\
  opacity: 1;\
  background: rgba(255,255,255,0.1);\
  border-radius: 5px;\
  padding: 0.35em 0.5em;\
  margin: 0.15em -0.5em;\
}\
.liptv-osd-num {\
  color: #999;\
  font-size: 0.8em;\
  width: 2em;\
  text-align: right;\
  flex-shrink: 0;\
}\
.liptv-osd-item.current .liptv-osd-num {\
  background: #e63946;\
  color: #fff;\
  font-weight: bold;\
  font-size: 0.75em;\
  padding: 0.15em 0.35em;\
  border-radius: 3px;\
  width: auto;\
  text-align: center;\
}\
.liptv-osd-name {\
  color: #ccc;\
  font-size: 0.9em;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
.liptv-osd-item.current .liptv-osd-name {\
  color: #fff;\
  font-weight: 600;\
}\
.liptv-osd-prog {\
  color: rgba(255,255,255,0.5);\
  font-size: 0.72em;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
\
/* ── EPG sidebar ─────────────────────────────── */\
.liptv-epg {\
  position: fixed;\
  top: 0;\
  right: 0;\
  bottom: 0;\
  width: 40%;\
  z-index: 10000;\
  background: rgba(0,0,0,0.88);\
  -webkit-backdrop-filter: blur(12px);\
  backdrop-filter: blur(12px);\
  padding: 1.2em 1em;\
  overflow-y: auto;\
  transform: translateX(100%);\
  transition: transform 300ms ease-out;\
}\
.liptv-epg.visible {\
  transform: translateX(0);\
}\
.liptv-epg.hiding {\
  transform: translateX(100%);\
  transition: transform 250ms ease-in;\
}\
.liptv-epg-title {\
  color: #fff;\
  font-size: 1.05em;\
  font-weight: 600;\
  padding-bottom: 0.5em;\
  margin-bottom: 0.6em;\
  border-bottom: 1px solid rgba(255,255,255,0.1);\
}\
.liptv-epg-item {\
  padding: 0.4em 0.5em;\
  margin-bottom: 0.15em;\
  border-radius: 0 4px 4px 0;\
}\
.liptv-epg-item.past {\
  opacity: 0.35;\
}\
.liptv-epg-item.now {\
  background: rgba(230,57,70,0.2);\
  border-left: 3px solid #e63946;\
}\
.liptv-epg-item.focus {\
  background: rgba(255,255,255,0.1);\
}\
.liptv-epg-item.now.focus {\
  background: rgba(230,57,70,0.35);\
}\
.liptv-epg-time {\
  font-size: 0.75em;\
  color: rgba(255,255,255,0.4);\
}\
.liptv-epg-item.now .liptv-epg-time {\
  color: #e63946;\
  font-weight: 500;\
}\
.liptv-epg-prog-title {\
  font-size: 0.88em;\
  color: rgba(255,255,255,0.7);\
  margin-top: 0.1em;\
}\
.liptv-epg-item.now .liptv-epg-prog-title {\
  color: #fff;\
  font-weight: 500;\
}\
.liptv-epg-progress {\
  height: 2px;\
  background: rgba(255,255,255,0.15);\
  border-radius: 1px;\
  margin-top: 0.3em;\
  overflow: hidden;\
}\
.liptv-epg-progress-fill {\
  height: 100%;\
  background: #e63946;\
}\
.liptv-epg-empty {\
  color: rgba(255,255,255,0.4);\
  text-align: center;\
  padding: 3em 1em;\
  font-size: 0.95em;\
}\
';
