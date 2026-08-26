import { beforeEach, describe, expect, it } from 'vitest';
import type { GridState } from 'ag-grid-community';
import { browserGridStateStore, pickPersistedGridState } from './gridStatePersistence';

const KEY = 'test-grid';

/**
 * The application uses browser `localStorage`, but the test must not depend on Node's own Web
 * Storage implementation. Newer Node versions expose an experimental `localStorage` global that can
 * be unavailable unless Node is started with `--localstorage-file`, even while Vitest is using
 * jsdom. Installing a tiny standards-shaped in-memory store keeps this test focused on our
 * persistence contract instead of the host process configuration.
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

function createState(): GridState {
  return {
    version: '36.1.0',
    columnOrder: { orderedColIds: ['amount', 'status'] },
    columnVisibility: { hiddenColIds: ['status'] },
    columnSizing: {
      columnSizingModel: [
        { colId: 'amount', width: 180 },
        { colId: 'status', width: 140 },
      ],
    },
    filter: {
      filterModel: {
        status: { filterType: 'text', type: 'equals', filter: 'Completed' },
      },
    },
    sort: {
      sortModel: [{ colId: 'amount', sort: 'desc' }],
    },
    pagination: { page: 3, pageSize: 25 },
    rowSelection: ['txn-a'],
  } as unknown as GridState;
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
});

describe('gridStatePersistence', () => {
  it('keeps layout/filter/sort state while excluding pagination and selection', () => {
    const persisted = pickPersistedGridState(createState());

    expect(persisted.columnOrder).toEqual({ orderedColIds: ['amount', 'status'] });
    expect(persisted.columnVisibility).toEqual({ hiddenColIds: ['status'] });
    expect(persisted.filter).toBeDefined();
    expect(persisted.sort).toBeDefined();
    expect(persisted.pagination).toBeUndefined();
    expect(persisted.rowSelection).toBeUndefined();
    expect(persisted.partialColumnState).toBe(true);
  });

  it('round-trips native GridState through the browser store', () => {
    browserGridStateStore.save(KEY, createState());

    const restored = browserGridStateStore.load(KEY);

    expect(restored?.columnOrder).toEqual({ orderedColIds: ['amount', 'status'] });
    expect(restored?.pagination).toBeUndefined();
    expect(restored?.rowSelection).toBeUndefined();
  });

  it('treats invalid saved JSON as missing state', () => {
    window.localStorage.setItem('ag-grid-state:test-grid', '{broken');

    expect(browserGridStateStore.load(KEY)).toBeUndefined();
  });

  it('clears saved state by grid key', () => {
    browserGridStateStore.save(KEY, createState());
    browserGridStateStore.clear(KEY);

    expect(browserGridStateStore.load(KEY)).toBeUndefined();
  });
});
