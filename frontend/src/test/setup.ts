import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

/**
 * Small standards-shaped in-memory Storage used by frontend tests.
 *
 * WHY THIS LIVES IN GLOBAL TEST SETUP
 * -----------------------------------
 * The application legitimately uses `window.localStorage` for replaceable AG Grid preference
 * persistence. Some Node versions expose an experimental Web Storage implementation that is
 * unavailable unless Node is started with `--localstorage-file`, even while Vitest runs in jsdom.
 *
 * Installing a fresh browser-shaped store before every test keeps tests deterministic and prevents
 * host-process configuration from breaking cleanup or leaking rendered components into later tests.
 * Production code is unaffected because this file is loaded only by Vitest.
 */
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
});
