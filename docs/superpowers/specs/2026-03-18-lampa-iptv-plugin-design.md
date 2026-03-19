# Lampa IPTV Plugin — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Lampa TV plugin that replicates the core experience of OTT Navigator: loading IPTV channels from an M3U URL, displaying EPG (electronic program guide), organizing channels by groups, and letting users manage their channel list (favorites, history, blacklist).

---

## Goals

- Load and parse M3U playlists from a user-provided URL
- Display channels in list or grid mode with EPG info (current/next program)
- Support EPG from two sources: `tvg-url` tags inside M3U and a separate XMLTV URL
- Allow users to hide unwanted channels (duplicates, low quality, broken) permanently
- Provide favorites, watch history, and search across channels and programs
- Distribute as a single bundled JS file loadable via URL in Lampa

---

## Out of Scope

- Xtream Codes / IPTV portal login
- Catch-up / timeshift
- Local file upload
- Recording
- Multi-screen / PiP

---

## Architecture

### Build

- **Toolchain:** Node.js + Rollup (or esbuild)
- **Input:** `src/index.js`
- **Output:** `dist/lampa-iptv.js` — single self-contained JS file
- **No external runtime dependencies** — uses native browser `fetch`, `DOMParser`, `Lampa.*` API only

### Project Structure

```
lampa-iptv/
├── src/
│   ├── index.js          # plugin entry point, Lampa.Plugin registration
│   ├── parser.js         # M3U parser
│   ├── epg.js            # XMLTV fetcher + parser + channel mapper
│   ├── storage.js        # Lampa.Storage wrapper
│   └── ui/
│       ├── main.js       # main screen: groups sidebar + channel list/grid
│       ├── card.js       # channel action card (play, favorite, hide, EPG)
│       ├── epg.js        # full EPG screen for a channel
│       ├── search.js     # search screen
│       └── settings.js   # settings screen
├── dist/
│   └── lampa-iptv.js     # built bundle
├── package.json
└── rollup.config.js
```

---

## Modules

### `parser.js` — M3U Parser

Fetches and parses M3U playlist from a URL.

**Output — Channel object:**
```js
{
  id: string,       // tvg-id if present, else djb2hash(name + url)
  name: string,
  url: string,
  logo: string,     // tvg-logo
  group: string,    // group-title
  tvgId: string,    // tvg-id (for EPG mapping)
}
```

**Behavior:**
- Skips malformed entries, logs to console
- Collects unique groups from `group-title` tags
- Channels without `tvg-id` get id = `djb2hash(name + url)` (simple JS-compatible hash, no crypto API needed); EPG is not attempted for them
- `tvg-url` is a playlist-level attribute on the `#EXTM3U` line (not per-channel). Parser extracts it once and passes it to `epg.js` separately as `playlistEpgUrl`

**Parser output:**
```js
{
  channels: Channel[],
  groups: string[],
  playlistEpgUrl: string | null  // from #EXTM3U tvg-url attribute
}
```

---

### `epg.js` — EPG Manager

Fetches XMLTV and maps programs to channels by `tvg-id`.

**EPG Program object:**
```js
{
  channelId: string,
  title: string,
  start: Date,
  stop: Date,
  desc: string
}
```

**Public interface:**
```js
// Call once after channels are rendered. Returns immediately (non-blocking).
epg.init(channels, playlistEpgUrl, settingsEpgUrl)

// Called internally by init(). Exposed for testing.
epg.fetchInBackground()

// Returns program currently airing for channelId, or null
epg.getCurrent(channelId): Program | null

// Returns next program after current, or null
epg.getNext(channelId): Program | null
```

**EPG source priority:**
1. `settingsEpgUrl` (user-configured XMLTV URL) — highest priority
2. `playlistEpgUrl` (from `#EXTM3U tvg-url` in M3U) — fallback

Only one EPG source is used. If `settingsEpgUrl` is set, `playlistEpgUrl` is ignored.

**UI notification on EPG load:**
When background fetch completes, `epg.js` fires `Lampa.Listener.send('liptv:epg_loaded', {})`. `ui/main.js` listens for this event and refreshes program labels on visible channel items.

**EPG data scope:**
All programs from the loaded XMLTV are kept in memory (mapped by channelId). Search and EPG screen operate on this full dataset regardless of air time. Memory is released when the plugin is closed.

**Behavior:**
- Fetches in background after channels are displayed — does not block UI
- Parses with `DOMParser`
- Channels with no EPG match display empty program fields — not an error state

---

### `storage.js` — Storage Wrapper

Thin wrapper over `Lampa.Storage` with typed accessors.

| Key | Type | Description |
|---|---|---|
| `liptv_m3u_url` | string | M3U playlist URL |
| `liptv_epg_url` | string | XMLTV EPG URL (optional) |
| `liptv_view_mode` | `"list"` \| `"grid"` | Display mode |
| `liptv_favorites` | string[] | Favorited channel ids |
| `liptv_history` | `{id, ts}[]` | Watch history (newest first), max 100 entries, FIFO eviction, repeat views update `ts` in place |
| `liptv_blacklist` | string[] | Hidden channel ids |

---

## UI Screens

### Main Screen (`ui/main.js`)

```
┌─────────────────────────────────────────────┐
│ [🔍 Поиск]              [☰ Список / ⊞ Сетка] │
├──────────────┬──────────────────────────────┤
│ ВСЕ КАНАЛЫ  │  [лого] Первый канал          │
│ Россия       │         Вечерние новости 21:00│
│ Спорт        │  [лого] НТВ                   │
│ Кино         │         Следствие вели...     │
│ Новости      │  [лого] Матч ТВ               │
│ Избранное    │         Футбол. Россия-...    │
│ История      │                               │
└──────────────┴──────────────────────────────┘
```

- Left sidebar: groups extracted from M3U + virtual groups "Все", "Избранное", "История"
- Right panel: channel list (rows with logo + name + current program) or grid (logo tiles)
- View mode toggle in header, persisted to storage
- Blacklisted channels are filtered out before rendering

### Channel Card (`ui/card.js`)

Opens on Enter / click on a channel item.

```
┌──────────────────────────────┐
│  [ЛОГО]  Первый канал        │
│  Сейчас:  Вечерние новости   │
│  Далее:   Пусть говорят      │
│                              │
│  [▶ Смотреть]  [★ Избранное] │
│  [📋 Программа] [🚫 Скрыть]  │
└──────────────────────────────┘
```

- "Скрыть" adds channel id to blacklist and immediately removes it from main screen (no M3U reload)
- "Программа" opens full EPG screen for this channel
- Card layout is identical regardless of whether main screen is in list or grid mode

### EPG Screen (`ui/epg.js`)

Full program guide for a selected channel: scrollable list of programs for the day with start/end times and descriptions.

### Search Screen (`ui/search.js`)

- Text input with Lampa keyboard
- Searches channel names (always available)
- Searches program titles (when EPG is loaded)
- Results use the same list/grid component as main screen

### Settings Screen (`ui/settings.js`)

Integrated into Lampa's standard settings menu under a "IPTV" section.

Fields:
- M3U URL (text input)
- EPG URL (text input, optional)
- Display mode: List / Grid (select)
- Button "Скрытые каналы" → sub-screen with list of hidden channels, each with "Восстановить" action (restores immediately to main screen, no reload)
- Button "Очистить историю" → clears `liptv_history` immediately

---

## Data Flow

```
User opens plugin
  └─ storage.load()                    load settings, blacklist, favorites
  └─ parser.fetchM3U(m3u_url)          fetch + parse → channels[], groups[]
  └─ filter(blacklist)                 remove hidden channels
  └─ ui/main.show(channels, groups)    render immediately
  └─ epg.init(channels, playlistEpgUrl, settingsEpgUrl)   collect EPG sources
  └─ epg.fetchInBackground()                               fetch XMLTV async
       └─ fires Lampa.Listener 'liptv:epg_loaded'
            └─ ui/main.js refreshes program labels on visible items
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| M3U URL unreachable | Show error screen with "Повторить" button and URL change option |
| Malformed M3U lines | Skip silently, log to console, show count of successfully parsed channels |
| EPG unavailable | UI works without EPG; program fields show empty — not an error |
| EPG channel id mismatch | Channel displays without EPG data |
| Stream fails to open | Lampa's built-in player error handling covers this |
| No M3U URL configured | Show settings screen immediately on first launch |
| M3U URL was cleared by user | Show error screen with prompt to configure URL; existing favorites/history/blacklist are preserved in storage |

**Watch history recording:** a channel is added to history only after >10 seconds of playback. Implementation: start a `setTimeout(10000)` when `Lampa.Listener` fires the player start event; cancel it on stop/error. If the timeout fires, write to history. Exact Lampa player event names (`player:started`, `player:stopped`) to be confirmed during implementation by inspecting Lampa source.

---

## Lampa Plugin Integration

```js
// src/index.js — typical Lampa plugin registration pattern
(function() {
  'use strict';

  function startPlugin() {
    // register settings section via Lampa.Settings.listener
    // register main component via Lampa.Component
    // add entry to Lampa catalog/home via Lampa.Listener or Lampa.Params
  }

  if (window.Lampa) startPlugin();
  else window.addEventListener('lampa:ready', startPlugin);
})();
```

**Note:** Exact Lampa registration API (component hooks, settings integration) must be verified against a reference plugin (e.g., existing open-source Lampa plugins on GitHub) at implementation start, as API details are not formally documented.

Uses only public Lampa APIs:
- `Lampa.Plugin` — registration
- `Lampa.Storage` — persistence
- `Lampa.Player` — playback
- `Lampa.Lang` — localization strings
- `Lampa.Listener` — event bus
- `Lampa.Utils` — helpers
