// Lampa.Storage is set up in tests/setup-globals.js (runs before module load)
import { storage } from '../src/storage.js';

beforeEach(() => {
  // Clear the shared store (exposed by setup-globals.js)
  Object.keys(global.__store__).forEach(k => delete global.__store__[k]);
});

describe('viewMode', () => {
  test('defaults to list', () => {
    expect(storage.getViewMode()).toBe('list');
  });
  test('persists grid', () => {
    storage.setViewMode('grid');
    expect(storage.getViewMode()).toBe('grid');
  });
});

describe('favorites', () => {
  test('add and check', () => {
    storage.addFavorite('ch1');
    expect(storage.isFavorite('ch1')).toBe(true);
    expect(storage.isFavorite('ch2')).toBe(false);
  });
  test('remove favorite', () => {
    storage.addFavorite('ch1');
    storage.removeFavorite('ch1');
    expect(storage.isFavorite('ch1')).toBe(false);
  });
  test('no duplicates', () => {
    storage.addFavorite('ch1');
    storage.addFavorite('ch1');
    expect(storage.getFavorites()).toHaveLength(1);
  });
});

describe('history', () => {
  test('adds to history', () => {
    storage.addHistory('ch1');
    expect(storage.getHistory()[0].id).toBe('ch1');
  });
  test('updates ts on repeat, no duplicate entry', () => {
    storage.addHistory('ch1');
    const ts1 = storage.getHistory()[0].ts;
    storage.addHistory('ch1');
    expect(storage.getHistory()).toHaveLength(1);
    expect(storage.getHistory()[0].ts).toBeGreaterThanOrEqual(ts1);
  });
  test('caps at 100 entries FIFO, oldest evicted', () => {
    for (let i = 0; i < 105; i++) storage.addHistory(`ch${i}`);
    const h = storage.getHistory();
    expect(h).toHaveLength(100);
    expect(h[0].id).toBe('ch104'); // newest first
    // ch0..ch4 must have been evicted
    expect(h.find(x => x.id === 'ch4')).toBeUndefined();
    expect(h.find(x => x.id === 'ch5')).toBeDefined();
  });
  test('clearHistory empties', () => {
    storage.addHistory('ch1');
    storage.clearHistory();
    expect(storage.getHistory()).toHaveLength(0);
  });
});

describe('blacklist', () => {
  test('add and check', () => {
    storage.addBlacklist('ch1');
    expect(storage.isBlacklisted('ch1')).toBe(true);
    expect(storage.isBlacklisted('ch2')).toBe(false);
  });
  test('remove from blacklist', () => {
    storage.addBlacklist('ch1');
    storage.removeBlacklist('ch1');
    expect(storage.isBlacklisted('ch1')).toBe(false);
  });
  test('no duplicates', () => {
    storage.addBlacklist('ch1');
    storage.addBlacklist('ch1');
    expect(storage.getBlacklist()).toHaveLength(1);
  });
});
