/**
 * Full smoke-test suite for the Lampa IPTV plugin.
 * Loads Lampa in headless Chromium, injects the plugin, and verifies
 * all major features work without crashes.
 *
 * Run:  node tests/smoke-lampa.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE    = readFileSync(join(__dirname, '..', 'dist', 'lampa-iptv.js'), 'utf8');
const LAMPA_URL = 'http://lampa.mx';
const TEST_M3U  = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
const SHOTS_DIR = join(__dirname, '..', 'smoke-shots');

let passed  = 0;
let failed  = 0;
let skipped = 0;
const jsErrors = [];

function ok(name)   { passed++;  console.log('  \x1b[32m✓\x1b[0m ' + name); }
function fail(name, reason) { failed++; console.log('  \x1b[31m✗\x1b[0m ' + name + (reason ? ' — ' + reason : '')); }
function skip(name, reason) { skipped++; console.log('  \x1b[33m⊘\x1b[0m ' + name + ' (skip: ' + reason + ')'); }

async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS_DIR, name + '.png') });
}

async function run() {
  // Ensure screenshots dir
  const fs = await import('fs');
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', err => jsErrors.push(err.message));

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[1] Загрузка Lampa\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  try {
    await page.goto(LAMPA_URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const ready = await page.evaluate(() => window.appready === true);
    if (ready) ok('Lampa загружена, appready=true');
    else       fail('appready не установлен');
  } catch (e) {
    fail('Загрузка Lampa', e.message);
    await browser.close();
    printSummary();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[2] Инъекция плагина\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  const errsBefore = jsErrors.length;
  const injectErr = await page.evaluate(code => {
    try { eval(code); return null; } catch(e) { return e.message; }
  }, BUNDLE);
  await page.waitForTimeout(1000);

  if (injectErr) fail('eval() бросил исключение', injectErr);
  else           ok('Плагин загружен без исключений');

  const hasStyles = await page.evaluate(() => !!document.getElementById('liptv-styles'));
  hasStyles ? ok('CSS стили инжектированы') : fail('CSS стили не найдены');

  const hasComponent = await page.evaluate(() =>
    !!(Lampa.Component && Lampa.Component.get && Lampa.Component.get('liptv_main'))
  );
  hasComponent ? ok('Компонент liptv_main зарегистрирован') : fail('Компонент не зарегистрирован');

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[3] Пункт IPTV в боковом меню\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  const menuItem = await page.evaluate(() => {
    const el = document.querySelector('.menu__item[data-action="liptv"]');
    return el ? el.textContent.trim() : null;
  });
  menuItem ? ok('Пункт «' + menuItem + '» в меню') : fail('Пункт IPTV отсутствует в меню');

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[4] Загрузка M3U плейлиста\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  await page.evaluate((url) => {
    Lampa.Storage.set('liptv_m3u_url', url);
    Lampa.Activity.push({ component: 'liptv_main', url: '', title: 'IPTV' });
  }, TEST_M3U);
  await page.waitForTimeout(6000);
  await shot(page, '01-channels-loaded');

  const channelCount = await page.evaluate(() =>
    document.querySelectorAll('.liptv-row[data-id], .liptv-tile[data-id]').length
  );
  channelCount > 0
    ? ok('Каналы загружены: ' + channelCount + ' шт.')
    : fail('Каналы не отрисовались (0 элементов)');

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[5] Группы каналов\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  const groups = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.liptv-group')).map(el => el.textContent.trim())
  );
  groups.length > 3
    ? ok('Групп: ' + groups.length + ' (Все, Избранное, История + ' + (groups.length - 3) + ' из M3U)')
    : fail('Слишком мало групп: ' + groups.length);

  // Кликнуть на вторую группу (не «Все»)
  if (groups.length > 3) {
    const targetGroup = groups[3]; // первая реальная группа из M3U
    await page.evaluate(g => {
      const el = Array.from(document.querySelectorAll('.liptv-group'))
        .find(e => e.textContent.trim() === g);
      if (el) el.click();
    }, targetGroup);
    await page.waitForTimeout(1000);
    await shot(page, '02-group-selected');

    const activeGroup = await page.evaluate(() => {
      const el = document.querySelector('.liptv-group.active');
      return el ? el.textContent.trim() : null;
    });
    activeGroup === targetGroup
      ? ok('Группа «' + targetGroup + '» выбрана')
      : fail('Активная группа: ' + activeGroup + ', ожидали: ' + targetGroup);

    // Вернуться к «Все»
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.liptv-group'))
        .find(e => e.textContent.trim() === 'Все');
      if (el) el.click();
    });
    await page.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[6] Переключение сетка/список\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  const hasToggle = await page.evaluate(() => !!document.querySelector('.liptv-btn[data-action="toggle"]'));
  if (hasToggle) {
    // Use evaluate to avoid Lampa overlay intercepting pointer events
    await page.evaluate(() => {
      const btn = document.querySelector('.liptv-btn[data-action="toggle"]');
      if (btn) $(btn).trigger('hover:enter');
    });
    await page.waitForTimeout(1500);
    await shot(page, '03-grid-mode');

    const isGrid = await page.evaluate(() =>
      document.querySelector('.liptv-channels.grid') !== null
    );
    isGrid ? ok('Переключение в режим сетки') : fail('Класс .grid не добавлен');

    const tiles = await page.evaluate(() =>
      document.querySelectorAll('.liptv-tile[data-id]').length
    );
    tiles > 0 ? ok('Тайлы отрисованы: ' + tiles) : fail('Тайлы не отрисованы');

    // Переключить обратно
    await page.evaluate(() => {
      const btn = document.querySelector('.liptv-btn[data-action="toggle"]');
      if (btn) $(btn).trigger('hover:enter');
    });
    await page.waitForTimeout(500);
  } else {
    skip('Переключение режима', 'кнопка не найдена');
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[7] Клик → плеер, долгий клик → карточка\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  const hasChannel = await page.evaluate(() => !!document.querySelector('.liptv-row[data-id]'));
  if (hasChannel) {
    const chName = await page.evaluate(() => {
      const row = document.querySelector('.liptv-row[data-id]');
      const nameEl = row ? row.querySelector('.liptv-row-name') : null;
      return nameEl ? nameEl.textContent.trim() : '(без имени)';
    });

    // 7a: Short click → player should start (Lampa.Player.play called)
    const playerCalled = await page.evaluate(() => {
      let called = false;
      const origPlay = Lampa.Player.play;
      Lampa.Player.play = function(data) { called = data; };
      const row = document.querySelector('.liptv-row[data-id]');
      if (row) $(row).trigger('hover:enter');
      Lampa.Player.play = origPlay;
      return called;
    });
    playerCalled
      ? ok('Клик → плеер вызван для «' + chName + '»')
      : fail('Клик не вызвал Lampa.Player.play');

    // 7b: Long click → card with actions
    await page.evaluate(() => {
      const row = document.querySelector('.liptv-row[data-id]');
      if (row) $(row).trigger('hover:long');
    });
    await page.waitForTimeout(1500);
    await shot(page, '04-channel-card');

    const selectBox = await page.evaluate(() => {
      const box = document.querySelector('.selectbox');
      if (!box) return null;
      return {
        visible: box.style.display !== 'none',
        items: Array.from(box.querySelectorAll('.selectbox-item__title'))
          .map(el => el.textContent.trim())
      };
    });

    if (selectBox && selectBox.items.length > 0) {
      ok('Долгий клик → карточка: ' + selectBox.items.join(', '));
    } else {
      fail('Долгий клик не открыл карточку');
    }

    // Закрыть карточку
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    skip('Плеер/карточка', 'каналы не загружены');
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[8] Настройки → IPTV\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  const errsBefore8 = jsErrors.length;
  await page.evaluate(() => {
    Lampa.Activity.push({ component: 'settings', url: '', title: 'Настройки' });
  });
  await page.waitForTimeout(2000);

  // Ищем IPTV в DOM настроек
  const iptvSettingsFound = await page.evaluate(() => {
    const items = document.querySelectorAll('.settings-folder__item, [data-component="liptv"]');
    for (const el of items) {
      if (el.textContent.includes('IPTV') || el.getAttribute('data-component') === 'liptv') {
        el.click();
        return el.textContent.trim().substring(0, 40);
      }
    }
    return null;
  });
  await page.waitForTimeout(1500);
  await shot(page, '05-settings-iptv');

  const crashErrors8 = jsErrors.slice(errsBefore8).filter(e =>
    e.includes('update$3') || e.includes("reading ''") || e.includes('is not a function')
  );
  crashErrors8.length === 0
    ? ok('Настройки IPTV без краша update$3')
    : fail('Краш в настройках', crashErrors8[0]);

  if (iptvSettingsFound) ok('Раздел IPTV найден: «' + iptvSettingsFound + '»');
  else skip('Раздел IPTV в DOM настроек', 'не найден (может быть скрыт)');

  // Проверяем наличие параметров M3U URL, EPG URL
  const settingsParams = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.settings-param__name'))
      .map(el => el.textContent.trim())
  );
  const hasM3u = settingsParams.some(n => n.includes('M3U'));
  const hasEpg = settingsParams.some(n => n.includes('EPG'));
  hasM3u ? ok('Параметр «M3U URL» виден') : skip('M3U URL параметр', 'не виден (IPTV секция не открыта?)');
  hasEpg ? ok('Параметр «EPG URL» виден') : skip('EPG URL параметр', 'не виден');

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[9] Избранное\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  // Вернуться к IPTV
  await page.evaluate(() => {
    Lampa.Activity.push({ component: 'liptv_main', url: '', title: 'IPTV' });
  });
  await page.waitForTimeout(4000);

  // Кликнуть на группу «Избранное»
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.liptv-group'))
      .find(e => e.textContent.trim() === 'Избранное');
    if (el) el.click();
  });
  await page.waitForTimeout(1000);

  const emptyFavs = await page.evaluate(() => {
    const empty = document.querySelector('.liptv-empty');
    return empty ? empty.textContent.trim() : null;
  });
  emptyFavs
    ? ok('Избранное пустое: «' + emptyFavs + '»')
    : skip('Пустое избранное', 'текст не найден — возможно уже есть избранные');

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m[10] История\x1b[0m');
  // ═══════════════════════════════════════════════════════════════════
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.liptv-group'))
      .find(e => e.textContent.trim() === 'История');
    if (el) el.click();
  });
  await page.waitForTimeout(1000);
  await shot(page, '06-history');

  const emptyHist = await page.evaluate(() => {
    const empty = document.querySelector('.liptv-empty');
    return empty ? empty.textContent.trim() : null;
  });
  emptyHist
    ? ok('История пустая: «' + emptyHist + '»')
    : skip('Пустая история', 'текст не найден');

  // ═══════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════
  if (jsErrors.length > 0) {
    console.log('\n\x1b[33m--- JS ошибки в консоли браузера ---\x1b[0m');
    jsErrors.forEach((e, i) => console.log('  ' + (i + 1) + '. ' + e.substring(0, 150)));
  }

  console.log('\n══════════════════════════════════════');
  console.log('\x1b[1m  Пройдено: ' + passed + '  |  Провалено: ' + failed + '  |  Пропущено: ' + skipped + '\x1b[0m');
  console.log('  Скриншоты: ' + SHOTS_DIR);
  console.log('══════════════════════════════════════\n');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Ошибка запуска:', e.message);
  process.exit(1);
});
