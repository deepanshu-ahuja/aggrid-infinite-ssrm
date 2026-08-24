import { AgGridReact } from 'ag-grid-react';

/**
 * Temporary compatibility export while feature grids move to importing `AgGridReact` directly.
 *
 * This is intentionally NOT a wrapper component: it adds no props, state, refs, lifecycle or
 * behaviour. Application-wide theme/default-column configuration now uses AG Grid's native
 * `provideGlobalGridOptions` bootstrap in `AppProviders`.
 *
 * Delete this compatibility export once the remaining feature/test imports use `ag-grid-react`
 * directly.
 */
export const AppGrid = AgGridReact;
