import { useCallback, useMemo } from 'react';
import type { StateUpdatedEvent } from 'ag-grid-community';
import {
  browserGridStateStore,
  type GridStateStore,
} from './gridStatePersistence';

interface UseGridStatePersistenceOptions {
  /** Stable preference key for one concrete grid/row-model instance. */
  key: string;
  /** Replaceable persistence boundary; browser storage is the current default. */
  store?: GridStateStore;
}

/**
 * Small bridge from native AG Grid Grid State events to the application's persistence boundary.
 *
 * It deliberately returns native `initialState` / `onStateUpdated` values instead of wrapping the
 * grid. The concrete feature root still renders `AgGridReact` directly and keeps lifecycle visible.
 */
export function useGridStatePersistence<TData>({
  key,
  store = browserGridStateStore,
}: UseGridStatePersistenceOptions) {
  /** AG Grid consumes initial state when the grid is created; ordinary renders should not reload it. */
  const initialState = useMemo(() => store.load(key), [key, store]);

  /** Save AG Grid's complete native event state through the store's persisted-state filter. */
  const onStateUpdated = useCallback(
    (event: StateUpdatedEvent<TData>) => {
      store.save(key, event.state);
    },
    [key, store],
  );

  return {
    initialState,
    onStateUpdated,
  };
}
