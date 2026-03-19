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
';
