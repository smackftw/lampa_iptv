# EPG пресеты + автоопределение — Design Spec

## Цель

Добавить выпадающий список готовых EPG-источников по странам и режим «Авто», который определяет страны каналов из tvg-id плейлиста и скачивает нужные EPG автоматически. Сопоставление каналов между EPG и плейлистом — по нормализованному названию.

## Контекст

Текущее состояние: EPG работает если (a) M3U содержит `tvg-url` в заголовке, или (b) пользователь вручную указал EPG URL в настройках. Многие плейлисты (включая iptv-org/iptv) не имеют `tvg-url`, и пользователь не знает, где искать EPG. ID каналов в разных EPG-источниках не совпадают с tvg-id плейлиста — необходим matching по названию.

## Компоненты

### 1. EPG-пресеты

Объект-маппинг ключей к URL-адресам EPG-источников. Хранится в коде, не в storage.

```javascript
EPG_PRESETS = {
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
}
```

### 2. Автоопределение стран (режим «Авто»)

**Вход:** массив каналов из плейлиста (после парсинга M3U), `playlistEpgUrl` из заголовка M3U.

**Алгоритм:**
1. Если M3U содержит `tvg-url` (playlistEpgUrl не пуст) — использовать его, name matching не нужен. Вернуть `{ urls: [playlistEpgUrl], needsMapping: false }`
2. Иначе — извлечь коды стран из `tvg-id` каналов. Формат tvg-id: `ChannelName.cc` или `ChannelName.cc@Quality`. Код страны — 2 символа после последней точки (перед `@` если есть)
3. Порог: если менее 30% каналов имеют непустой `tvgId` с парсируемым кодом страны — режим «Авто» не может определить страну, показать `Lampa.Noty.show('Не удалось определить EPG автоматически, выберите источник в настройках')`
4. Подсчитать количество каналов по странам, взять топ-3 по количеству
5. Для каждой страны сформировать URL: `https://epg.pw/xmltv/epg_{CC}.xml.gz` (CC — uppercase)
6. Если код страны не поддерживается epg.pw — пропустить

**Ограничение:** максимум 3 EPG-файла в режиме «Авто» для ограничения трафика и времени загрузки.

### 3. Name matching — сопоставление каналов

Проблема: EPG-источники (epg.pw) используют свои ID каналов (числовые, например `5755`), не совпадающие с tvg-id плейлиста (например `MatchHD.ru`). Необходимо сопоставить каналы по человекочитаемому названию.

**Источники названий:**
- Плейлист: поле `name` из `#EXTINF:... ,Channel Name`
- EPG XML: элемент `<display-name>` внутри `<channel>`

**Алгоритм нормализации `normalizeName(name)`:**
1. Привести к lowercase
2. Убрать суффиксы качества как отдельные слова в конце: `\b(hd|sd|fhd|uhd|4k)\s*$`
3. Убрать содержимое в скобках: `(720p)`, `(1080p)`, `[not 24/7]` и т.п.
4. Убрать множественные пробелы, trim
5. Результат — строка для сравнения

**Алгоритм `buildChannelMapping(epgChannels, playlistChannels)`:**

Входные данные:
- `epgChannels` — массив `{ id, displayName }` из парсинга XMLTV (элементы `<channel>`)
- `playlistChannels` — массив каналов из плейлиста (имеют поля `id`, `tvgId`, `name`)

Алгоритм:
1. Для каждого канала в EPG — нормализовать `displayName`
2. Для каждого канала в плейлисте — нормализовать `name`
3. Сначала попробовать точное совпадение `channel.tvgId` (поле из парсера, может быть пустой строкой) ↔ `epgChannel.id`
4. Затем — совпадение нормализованных названий
5. Результат: `Map<epgChannelId, playlistChannelId>` — где `playlistChannelId` это `channel.id` (tvgId или djb2-хэш, используется как ключ в `_programs`)

**Ремаппинг программ** в `epg.js` после парсинга:
```javascript
for (const [epgId, playlistId] of mapping) {
  if (_programs[epgId] && !_programs[playlistId]) {
    _programs[playlistId] = _programs[epgId];
    delete _programs[epgId];
  }
}
```
При конфликтах (программы уже есть для `playlistId`) — не перезаписывать.

### 4. Модификация epg.js

**Текущий API:**
```javascript
init(channels, playlistEpgUrl, settingsEpgUrl)  // сохраняет один _epgUrl
fetchInBackground()                              // fetch(_epgUrl), parseXMLTV(text) → _programs
parseXMLTV(xmlText)                              // возвращает { [channelId]: Programme[] }
```

**Новый API:**
```javascript
init(urls, playlistChannels, needsMapping)
// urls: string[] — один или несколько EPG URL
// playlistChannels: Channel[] — каналы из плейлиста (для buildChannelMapping)
// needsMapping: boolean — нужен ли ремаппинг по названиям

fetchInBackground()
// Скачивает каждый URL последовательно, парсит XMLTV
// Если needsMapping — вызывает buildChannelMapping() и ремаппит программы
// Результаты объединяются: программы из второго файла добавляются к первому, без перезаписи

parseXMLTV(xmlText)
// Возвращает: { programs: { [channelId]: Programme[] }, channels: { id, displayName }[] }
// Новое: парсит <channel> элементы и извлекает id + <display-name>
```

### 5. Настройки UI

**Замена текущего поля «EPG URL»** на:

1. **Select «Источник EPG»** (тип `select` в Lampa.SettingsApi):
   - Значения из `EPG_PRESETS` (ключ → label)
   - Default: `'auto'`
   - Хранится в `liptv_epg_source`
   - При изменении — вызвать callback `onEpgChange`

2. **Поле «EPG URL»** (тип `trigger`, как сейчас):
   - Регистрируется всегда, но работает только при `liptv_epg_source === 'custom'`
   - При других значениях `liptv_epg_source` клик по полю показывает Noty «Выберите "Свой URL" в источнике EPG»
   - Поведение при `custom`: как у текущего поля (Keypad → ввод URL)

**`registerSettings` принимает два callback:**
```javascript
registerSettings(onM3uChange, onEpgChange)
```
`onEpgChange` вызывается при изменении источника EPG или при вводе custom URL.

**Ключ в storage:** `liptv_epg_source` (строка, ключ пресета). Текущий `liptv_epg_url` остаётся для режима «Свой URL».

### 6. Обработка gzip

epg.pw отдаёт `.xml.gz` файлы. Сервер отдаёт `Content-Type: application/gzip`, НЕ `Content-Encoding: gzip` — браузер не распакует автоматически.

**Алгоритм:**
1. `fetch(url)` → `response.arrayBuffer()`
2. Проверить первые 2 байта: если `0x1f 0x8b` (gzip magic number) — нужна распаковка
3. Если `DecompressionStream` API доступен — использовать его:
   ```javascript
   const ds = new DecompressionStream('gzip');
   const stream = new Response(new Blob([arrayBuffer]).stream().pipeThrough(ds));
   const text = await stream.text();
   ```
4. Если `DecompressionStream` недоступен — попробовать запросить URL без `.gz` суффикса
5. Если и это не работает — `console.warn`, EPG не загружается

**Known limitation:** на старых Android WebView (< Chrome 80) `DecompressionStream` может не поддерживаться. В этом случае пользователь может указать URL без `.gz` через «Свой URL».

### 7. Таблица `needsMapping` по режимам

| sourceKey | Условие | needsMapping | urls |
|-----------|---------|--------------|------|
| `auto` | есть `playlistEpgUrl` | `false` | `[playlistEpgUrl]` |
| `auto` | нет `playlistEpgUrl` | `true` | `[epg.pw URLs по странам]` |
| `playlist` | `playlistEpgUrl` не пуст | `false` | `[playlistEpgUrl]` |
| `playlist` | `playlistEpgUrl` пуст | — | `[]`, показать Noty |
| `epgpw_*` | всегда | `true` | `[preset.url]` |
| `custom` | всегда | `false` | `[customUrl]` |

`custom` → `needsMapping: false` потому что пользователь, указывающий свой URL, скорее всего имеет совместимый EPG (с совпадающими ID каналов).

## Архитектура файлов

| Файл | Изменение | Описание |
|------|-----------|----------|
| `src/epg-sources.js` | **Новый** | `EPG_PRESETS`, `resolveEpgUrls()`, `normalizeName()`, `buildChannelMapping()`, `detectCountries()` |
| `src/epg.js` | Модифицировать | Новая сигнатура `init(urls, playlistChannels, needsMapping)`, `parseXMLTV()` возвращает `{ programs, channels }`, `fetchInBackground()` грузит несколько URL и применяет маппинг |
| `src/ui/settings.js` | Модифицировать | Заменить поле «EPG URL» на select + условное поле URL. `registerSettings(onM3uChange, onEpgChange)` |
| `src/storage.js` | Модифицировать | Добавить `liptv_epg_source` (default: `'auto'`) с get/set |
| `src/index.js` | Модифицировать | Вызывать `resolveEpgUrls()` для получения URL(ов), передавать каналы и результат в `epg.init()` |

### API модуля `src/epg-sources.js`

```javascript
export const EPG_PRESETS;

// Определяет URL(ы) для загрузки EPG
// sourceKey — ключ из EPG_PRESETS ('auto', 'playlist', 'epgpw_ru', 'custom', ...)
// channels — массив каналов из плейлиста (каждый имеет .tvgId, .name, .id)
// playlistEpgUrl — tvg-url из заголовка M3U (может быть null)
// customUrl — пользовательский URL из настроек (может быть null)
// Возвращает: { urls: string[], needsMapping: boolean }
export function resolveEpgUrls(sourceKey, channels, playlistEpgUrl, customUrl)

// Извлекает коды стран из tvg-id каналов, возвращает топ-N
// Использует channel.tvgId (не channel.id — тот может быть djb2-хэшем)
// Возвращает: string[] — коды стран в uppercase, например ['RU', 'UA']
export function detectCountries(channels, maxCount)

// Нормализует название канала для сравнения
// Возвращает: string — lowercase, без суффиксов качества и скобок
export function normalizeName(name)

// Строит маппинг epgChannelId → playlistChannelId
// epgChannels — массив { id, displayName } из parseXMLTV().channels
// playlistChannels — массив каналов из плейлиста (.id, .tvgId, .name)
// Возвращает: Map<string, string> — epgChannelId → channel.id (ключ для _programs)
export function buildChannelMapping(epgChannels, playlistChannels)
```

## Поток данных (жизненный цикл)

1. Пользователь выбирает «Авто» (или пресет) в настройках → `liptv_epg_source` сохраняется
2. `index.js` вызывает `resolveEpgUrls(sourceKey, channels, playlistEpgUrl, customUrl)`
3. Для `auto` без `tvg-url`: `detectCountries(channels, 3)` → `['RU', 'UA']` → формирует URLs
4. Возвращает `{ urls: ['https://epg.pw/xmltv/epg_RU.xml.gz', '...'], needsMapping: true }`
5. `index.js` вызывает `epg.init(urls, channels, needsMapping)`
6. `epg.fetchInBackground()`:
   a. Скачивает каждый URL (с обработкой gzip)
   b. Парсит XMLTV → `{ programs, channels: epgChannels }`
   c. Если `needsMapping` — `buildChannelMapping(epgChannels, playlistChannels)` → маппинг
   d. Ремаппит `_programs` из EPG channel id в playlist channel id
   e. Программы из последующих файлов добавляются без перезаписи существующих
7. `getCurrent()` / `getAll()` работают как раньше — по playlist channel id

## Обработка ошибок

- EPG URL недоступен — `console.warn`, EPG просто не загружается (как сейчас)
- Режим «Авто» не смог определить страны (< 30% каналов с tvg-id) — `Lampa.Noty.show('Не удалось определить EPG автоматически, выберите источник в настройках')`
- Режим `playlist` при пустом `playlistEpgUrl` — `Lampa.Noty.show('Плейлист не содержит EPG URL')`
- gzip-распаковка не поддерживается — fallback на URL без .gz
- Несколько EPG-файлов — грузятся последовательно, результаты объединяются без перезаписи

## Known limitations

- На старых Android WebView `DecompressionStream` может не работать — пользователю придётся указать URL без .gz через «Свой URL»
- EPG-файлы epg.pw могут быть 10-50 МБ в распакованном виде; парсинг через `DOMParser` на слабых устройствах может быть медленным
- Name matching не покроет 100% каналов — только те, чьи названия совпадают после нормализации

## Вне скоупа

- Кэширование EPG между сессиями (EPG актуален на день)
- Fuzzy matching (Levenshtein distance) — используем только точное совпадение нормализованных названий
- Добавление новых стран через UI — пресеты захардкожены
- epgshare01 как источник — только epg.pw (единый формат URL, покрывает Россию)
- SAX-парсинг для больших файлов — DOMParser достаточен для текущих размеров
