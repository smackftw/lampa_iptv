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

**Вход:** массив каналов из плейлиста (после парсинга M3U).

**Алгоритм:**
1. Если M3U содержит `tvg-url` — использовать его (приоритет), name matching не нужен
2. Иначе — извлечь коды стран из `tvg-id` каналов. Формат tvg-id: `ChannelName.cc` или `ChannelName.cc@Quality`. Код страны — последний сегмент перед `@` (или конец строки), 2 символа после последней точки
3. Если tvg-id пустые у большинства каналов — режим «Авто» не может определить страну, показать нотификацию «Не удалось определить EPG автоматически, выберите источник в настройках»
4. Подсчитать количество каналов по странам, взять топ-3 по количеству
5. Для каждой страны сформировать URL: `https://epg.pw/xmltv/epg_{CC}.xml.gz` (CC — uppercase)
6. Если код страны не поддерживается epg.pw — пропустить

**Ограничение:** максимум 3 EPG-файла в режиме «Авто» для ограничения трафика и времени загрузки.

### 3. Name matching — сопоставление каналов

Проблема: EPG-источники (epg.pw, epgshare01) используют свои ID каналов, не совпадающие с tvg-id плейлиста. Необходимо сопоставить каналы по человекочитаемому названию.

**Источники названий:**
- Плейлист: поле `name` из `#EXTINF:... ,Channel Name`
- EPG XML: элемент `<display-name>` внутри `<channel>`

**Алгоритм нормализации `normalizeName(name)`:**
1. Привести к lowercase
2. Убрать суффиксы качества: `hd`, `sd`, `fhd`, `uhd`, `4k`
3. Убрать разрешения в скобках: `(720p)`, `(1080p)`, `[not 24/7]`
4. Убрать множественные пробелы, trim
5. Результат — строка для сравнения

**Алгоритм `buildChannelMapping(epgChannels, playlistChannels)`:**
1. Для каждого канала в EPG — нормализовать `display-name`
2. Для каждого канала в плейлисте — нормализовать `name`
3. Сначала попробовать точное совпадение tvg-id ↔ epg channel id
4. Затем — совпадение нормализованных названий
5. Результат: `Map<epgChannelId, playlistChannelId>`

### 4. Модификация epg.js

Текущий `epg.js` хранит программы в `_programs` с ключами — channel id из EPG XML (`node.getAttribute('channel')`). При поиске по `getCurrent(channelId)` используется playlist channel id (tvg-id или хэш). Если EPG channel id ≠ playlist channel id — ничего не находится.

**Изменение:** после парсинга XMLTV и получения маппинга — перекладывать программы из EPG channel id в playlist channel id:

```javascript
// До: _programs['5755'] = [...]  (epg.pw числовой ID)
// После ремаппинга: _programs['MatchHD.ru'] = [...]  (playlist tvg-id)
```

Метод `init()` принимает дополнительный параметр — маппинг. Метод `fetchInBackground()` применяет маппинг после парсинга.

### 5. Настройки UI

**Замена текущего поля «EPG URL»** на:

1. **Select «Источник EPG»** (тип `select` в Lampa.SettingsApi):
   - Значения из `EPG_PRESETS` (ключ → label)
   - Default: `'auto'`
   - Хранится в `liptv_epg_source`
   - При изменении — перезагрузить EPG

2. **Поле «EPG URL»** (тип `trigger`, как сейчас):
   - Показывается только если `liptv_epg_source === 'custom'`
   - Поведение как у текущего поля

**Ключ в storage:** `liptv_epg_source` (строка, ключ пресета). Текущий `liptv_epg_url` остаётся для режима «Свой URL».

### 6. Обработка gzip

epg.pw отдаёт `.xml.gz` файлы. Поведение:
1. Выполнить `fetch(url)` — браузер автоматически распакует если сервер отдаёт `Content-Encoding: gzip`
2. Если ответ всё ещё gzip (бинарные данные, не начинаются с `<?xml` или `<tv`) — использовать `DecompressionStream` API для ручной распаковки
3. Fallback: запросить URL без `.gz` (убрать суффикс)

## Архитектура файлов

| Файл | Изменение | Описание |
|------|-----------|----------|
| `src/epg-sources.js` | **Новый** | `EPG_PRESETS`, `resolveEpgUrls()`, `normalizeName()`, `buildChannelMapping()`, `detectCountries()` |
| `src/epg.js` | Модифицировать | `init()` принимает маппинг, `parseXMLTV()` возвращает также `channels` (id→display-name), `fetchInBackground()` применяет маппинг |
| `src/ui/settings.js` | Модифицировать | Заменить поле «EPG URL» на select + условное поле URL. Callback при изменении источника |
| `src/storage.js` | Модифицировать | Добавить `liptv_epg_source` (default: `'auto'`) с get/set |
| `src/index.js` | Модифицировать | Вызывать `resolveEpgUrls()` для получения URL(ов), передавать каналы для автоопределения |

### API модуля `src/epg-sources.js`

```javascript
export const EPG_PRESETS;

// Определяет URL(ы) для загрузки EPG
// sourceKey — ключ из EPG_PRESETS
// channels — массив каналов из плейлиста
// playlistEpgUrl — tvg-url из заголовка M3U (может быть null)
// customUrl — пользовательский URL из настроек (может быть null)
// Возвращает: { urls: string[], needsMapping: boolean }
//   needsMapping=false если используется tvg-url из плейлиста или свой URL
//   needsMapping=true если используется пресет или авто (ID не совпадают)
export function resolveEpgUrls(sourceKey, channels, playlistEpgUrl, customUrl)

// Извлекает коды стран из tvg-id каналов, возвращает топ-N
export function detectCountries(channels, maxCount)

// Нормализует название канала для сравнения
export function normalizeName(name)

// Строит маппинг epgChannelId → playlistChannelId
// epgChannels — массив { id, displayName } из парсинга XMLTV
// playlistChannels — массив каналов из плейлиста
export function buildChannelMapping(epgChannels, playlistChannels)
```

## Поток данных (жизненный цикл)

1. Пользователь выбирает «Авто» (или пресет) в настройках
2. `index.js` вызывает `resolveEpgUrls('auto', channels, playlistEpgUrl, null)`
3. `resolveEpgUrls` вызывает `detectCountries(channels, 3)` → `['ru', 'ua']`
4. Возвращает `{ urls: ['https://epg.pw/xmltv/epg_RU.xml.gz', '...epg_UA.xml.gz'], needsMapping: true }`
5. `epg.js` скачивает каждый URL, парсит XMLTV
6. Если `needsMapping` — `buildChannelMapping()` строит маппинг по названиям
7. Программы перекладываются из EPG channel id в playlist channel id
8. `getCurrent()` / `getAll()` работают как раньше

## Обработка ошибок

- EPG URL недоступен — `console.warn`, EPG просто не загружается (как сейчас)
- Режим «Авто» не смог определить страны — `Lampa.Noty.show('Не удалось определить EPG автоматически')`
- gzip-распаковка не поддерживается — fallback на URL без .gz
- Несколько EPG-файлов — грузятся последовательно, результаты объединяются

## Вне скоупа

- Кэширование EPG между сессиями (EPG актуален на день)
- Fuzzy matching (Levenshtein distance) — используем только точное совпадение нормализованных названий
- Добавление новых стран через UI — пресеты захардкожены
- epgshare01 как источник — только epg.pw (единый формат URL, есть Россию)
