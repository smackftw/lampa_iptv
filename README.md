# Lampa IPTV Plugin

IPTV плагин для [Lampa TV](https://lampa.mx) — загрузка каналов из M3U плейлиста с поддержкой EPG (программа передач).

## Возможности

- Загрузка M3U плейлиста по URL
- Группы каналов из `group-title`
- Программа передач (XMLTV / EPG)
- Список и сетка каналов
- Избранное, история просмотров, поиск
- Скрытие ненужных каналов

## Установка

В Lampa: **Настройки → Плагины → Добавить плагин** → вставить ссылку:

```
https://cdn.jsdelivr.net/gh/smackftw/lampa_iptv@main/dist/lampa-iptv.js
```

## Настройка

После установки в **Настройки → IPTV**:
- **M3U URL** — ссылка на плейлист
- **EPG URL** — ссылка на XMLTV (необязательно)

## Сборка из исходников

```bash
npm install
npm run build   # → dist/lampa-iptv.js
npm test
```
