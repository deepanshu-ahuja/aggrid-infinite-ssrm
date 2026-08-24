import {
  AllCommunityModule,
  enableDevValidations,
  type Module,
} from 'ag-grid-community';
import {
  ServerSideRowModelApiModule,
  ServerSideRowModelModule,
} from 'ag-grid-enterprise';

if (import.meta.env.DEV) {
  enableDevValidations();
}

/**
 * AG Grid module registration is centralized here so feature grids can use native APIs without
 * registering Enterprise modules ad hoc in individual components.
 *
 * `ServerSideRowModelModule`
 *     enables the Server-Side Row Model itself.
 *
 * `ServerSideRowModelApiModule`
 *     enables SSRM-specific GridApi methods such as `getServerSideSelectionState()` and
 *     `setServerSideSelectionState()`.
 *
 * Rendering SSRM rows can work with only the row-model module, while SSRM API calls fail at runtime
 * if the API module is omitted. Keep both registered together.
 */
export const gridModules: Module[] = [
  AllCommunityModule,
  ServerSideRowModelModule,
  ServerSideRowModelApiModule,
];
