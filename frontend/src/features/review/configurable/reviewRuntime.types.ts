import type { ConfigurableGridRegistries } from '@/shared/grid/configurable/configuration.registries';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';

/**
 * Runtime row shape at the generic Review boundary.
 *
 * Feature-owned adapters stay strongly typed against Loan/Finance/Transaction contracts, then erase
 * the concrete row type only when registering with the dynamic Review runtime. This is the same
 * boundary a future backend-configured entity would cross: the generic grid knows configured field
 * paths, not a compile-time business interface.
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
 * Entity-owned adapter for the Review feature's common primary action.
 *
 * The Review component owns one mutation/button lifecycle. This adapter owns everything that can vary
 * by business entity: endpoint, request mapping, response normalization, and backend semantics.
 */
export interface ReviewPrimaryActionAdapter {
  label: string;
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
  primaryAction?: ReviewPrimaryActionAdapter;
}
