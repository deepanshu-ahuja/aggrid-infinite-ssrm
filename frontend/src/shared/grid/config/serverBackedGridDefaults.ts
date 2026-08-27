import type { AgGridReactProps } from 'ag-grid-react';

/**
 * Native AG Grid options that our server-backed tables commonly configure.
 *
 * Both the Infinite Row Model and the Server-Side Row Model (SSRM) request data from the server in
 * blocks, so they currently share the same pagination/cache defaults.
 *
 * Important: this is NOT an application-specific replacement API for AG Grid. The property names
 * intentionally remain AG Grid's native names so a developer can look them up directly in the
 * AG Grid documentation.
 */
export type ServerBackedGridOptions<TData> = Pick<
  AgGridReactProps<TData>,
  | 'pagination'
  | 'paginationPageSize'
  | 'paginationPageSizeSelector'
  | 'cacheBlockSize'
  | 'maxBlocksInCache'
  | 'blockLoadDebounceMillis'
  | 'maxConcurrentDatasourceRequests'
>;

/**
 * Company/application defaults for server-backed AG Grid tables.
 *
 * These values are deliberately conservative defaults, not immutable rules. A feature may override
 * a value when its dataset, backend performance, or UX has a measured reason to behave differently.
 * Do not create a feature-level copy of this whole object just to change one setting.
 *
 * Pagination and server blocks are related but different concepts:
 * - `paginationPageSize` controls how many rows the user sees on one page.
 * - `cacheBlockSize` controls how many rows AG Grid asks the datasource/backend for in one block.
 *
 * With the defaults below, one 50-row block can satisfy two 25-row pages when the required rows are
 * already present in the cache.
 */
export const serverBackedGridDefaults = {
  pagination: true,
  paginationPageSize: 25,
  paginationPageSizeSelector: [10, 25, 50],

  // AG Grid fetches server-backed data in blocks. This does not have to equal the visible page size.
  cacheBlockSize: 50,

  /**
   * Bound browser memory by retaining only a limited number of server blocks.
   *
   * Cache residency follows what AG Grid recently/actively needed; it is not a business-selection
   * scope. For example, after sequentially visiting seven blocks with a five-block limit, early
   * blocks are normally evicted and will be fetched fresh if the user visits them again.
   *
   * Infinite `refreshInfiniteCache()` refreshes the blocks that are still resident. It does not load
   * every block in the backend dataset. Unloaded/evicted blocks naturally receive fresh backend data
   * when AG Grid requests them later.
   */
  maxBlocksInCache: 5,

  // Small debounce avoids immediately firing another block request during rapid scrolling.
  blockLoadDebounceMillis: 120,

  // Start conservatively with one in-flight datasource request. A table may override this only when
  // there is a deliberate, measured reason to allow more concurrent backend requests.
  maxConcurrentDatasourceRequests: 1,
} satisfies ServerBackedGridOptions<unknown>;
