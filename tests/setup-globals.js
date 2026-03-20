// tests/setup-globals.js
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const store = {};

global.Lampa = {
  Storage: {
    get: (key, def) => (key in store ? store[key] : def),
    set: (key, val) => { store[key] = val; }
  },
  Listener: {
    send: () => {},
    follow: () => {},
    remove: () => {}
  }
};

// Expose store so tests can clear it between runs
global.__store__ = store;

global.fetch = () => Promise.resolve({ ok: false, text: () => Promise.resolve('') });
