import type { ConfigurableGridRuntimePolicy } from '@/shared/grid/configurable/configuration.compiler';
import type { ConfigurableGridRegistries } from '@/shared/grid/configurable/configuration.registries';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';

/**
 * Runtime row shape at the generic Review boundary.
 *
 * Feature-owned adapters stay strongly typed against Loan/Finance contracts, then erase the concrete
 * row type only when registering with the dynamic Review runtime. The generic grid knows configured
 * field paths and stable row identity; it does not depend on one compile-time business row interface.
 */
export type ReviewRuntimeRow = Record<string, unknown>;

/** Input the common Review primary action can read from the active SSRM grid. */
export interface ReviewPrimaryActionContext {
  /** Compact SSRM selection intent; unloaded rows are represented without enumerating them. */
  selection: ServerSelectionIntent<string>;
  /** Complete applied AG Grid filter model. The active entity adapter owns translation to its API. */
  filterModel: object;
}

/** Small normalized result consumed by common Review UI regardless of backend response vocabulary. */
export interface ReviewPrimaryActionResult {
  affectedCount: number;
  message?: string;
}

/**
 * Entity-owned executable adapter for one configured Review primary action.
 *
 * `key` joins this executable behavior to the JSON-safe action definition/access projection. The Review
 * component renders the adapter only when the resolved current-user entity still contains that action.
 * Endpoint, payload mapping, response normalization and backend semantics remain entity-owned here.
 */
export interface ReviewPrimaryActionAdapter {
  key: string;
  execute: (
    context: ReviewPrimaryActionContext,
    signal?: AbortSignal,
  ) => Promise<ReviewPrimaryActionResult>;
}

/**
 * Executable runtime selected by EntityDefinition.dataAdapterKey.
 *
 * `EntityDefinition` remains JSON-safe/declarative. HTTP functions, mapper functions and executable
 * AG Grid registries stay in frontend code and are reached only through this registry key.
 */
export interface ReviewEntityRuntime {
  rowsLoader: GridRowsLoader<ReviewRuntimeRow>;
  registries: ConfigurableGridRegistries<ReviewRuntimeRow>;
  runtimePolicy?: ConfigurableGridRuntimePolicy<ReviewRuntimeRow>;
  primaryAction?: ReviewPrimaryActionAdapter;
}
