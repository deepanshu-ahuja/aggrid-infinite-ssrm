import {
  buildGridSelectionActionTarget,
  hasGridSelection,
  type GridSelectionExcludeScope,
} from '@/shared/grid/selection/gridSelectionActionTarget';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type {
  TransactionSelectionActionRequest,
  TransactionSelectionTargetRequest,
  TransactionUpdateChanges,
} from '../api/transactions.contracts';
import { mapTransactionFilterModel } from './transactionRequest.mapper';

export type TransactionExcludeScope = GridSelectionExcludeScope;

/** Transactions exposes the shared empty-selection rule without creating a second implementation. */
export const hasTransactionSelection = hasGridSelection;

/**
 * Build the Transactions selection target independently from the business operation performed on it.
 *
 * The shared helper owns the row-model-neutral meaning of explicit / filtered / all selection. This
 * feature owns only the Transactions filter translation. A future Payables or other table can reuse
 * the same shared helper with its own filter mapper and its own business-action payload.
 *
 * Status updates and selected export must resolve the SAME rows. Keeping selection/filter composition
 * here prevents each action from reinterpreting `include` / filtered `exclude` / all-record `exclude`
 * differently as more selected-row operations are added.
 */
export function buildTransactionSelectionTarget(
  selection: ServerSelectionIntent<string>,
  excludeScope: TransactionExcludeScope,
  filterModel: object,
): TransactionSelectionTargetRequest {
  const filters =
    selection.mode === 'exclude' && excludeScope === 'filtered'
      ? mapTransactionFilterModel(filterModel)
      : [];

  return buildGridSelectionActionTarget(selection, excludeScope, filters);
}

/**
 * Transactions-specific mutation request around the shared selection target.
 *
 * The selection target builder above owns WHICH rows. This function adds only WHAT should change.
 * Keeping those responsibilities separate lets export reuse the target without inheriting mutation
 * fields, and lets future selected-row operations reuse the same row-resolution semantics.
 */
export function buildTransactionSelectionActionRequest(
  selection: ServerSelectionIntent<string>,
  excludeScope: TransactionExcludeScope,
  filterModel: object,
  changes: TransactionUpdateChanges,
): TransactionSelectionActionRequest {
  return {
    ...buildTransactionSelectionTarget(selection, excludeScope, filterModel),
    changes,
  };
}
