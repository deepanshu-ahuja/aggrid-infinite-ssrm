import type { GridState } from 'ag-grid-community';

/**
 * Persist only user preferences that are genuinely common to both Infinite Row Model and SSRM.
 *
 * We deliberately exclude pagination and row selection:
 * - restoring pagination requires row-model-specific initial-row-count configuration;
 * - SSRM selection is restorable by AG Grid, while Infinite selection is not;
 * - selection is transient business state in this application rather than a durable layout
 *   preference.
 *
 * Keeping the persisted shape as native `GridState` means AG Grid remains the source of truth and
 * can apply its own version migration when supported older state is restored.
 */
export function pickPersistedGridState(state: GridState): GridState {
  return {
    version: state.version,
    partialColumnState: true,
    columnOrder: state.columnOrder,
    columnPinning: state.columnPinning,
    columnSizing: state.columnSizing,
    columnVisibility: state.columnVisibility,
    filter: state.filter,
    sort: state.sort,
  };
}

/**
 * Storage boundary for saved AG Grid preferences.
 *
 * Grid composition code depends on this small contract rather than on `localStorage` directly. A
 * future user/profile API can replace the browser implementation without changing AG Grid lifecycle
 * wiring.
 */
export interface GridStateStore {
  load(key: string): GridState | undefined;
  save(key: string, state: GridState): void;
  clear(key: string): void;
}

const STORAGE_PREFIX = 'ag-grid-state:';

/**
 * Browser-backed implementation used by the current frontend-only preference flow.
 *
 * Invalid or unavailable storage is treated as missing state. Persistence is a convenience and must
 * never prevent the grid from rendering or responding to user interaction.
 */
export const browserGridStateStore: GridStateStore = {
  load(key) {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!raw) return undefined;

      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return undefined;

      return parsed as GridState;
    } catch {
      return undefined;
    }
  },

  save(key, state) {
    try {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${key}`,
        JSON.stringify(pickPersistedGridState(state)),
      );
    } catch {
      // Browser policy/quota can reject storage. Grid functionality must continue regardless.
    }
  },

  clear(key) {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      // Same best-effort rule as save/load.
    }
  },
};
