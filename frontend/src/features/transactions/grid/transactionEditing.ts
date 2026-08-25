import { useCallback, useMemo, useRef, useState } from 'react';
import type { CellValueChangedEvent, GridApi, IRowNode } from 'ag-grid-community';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type { Transaction } from '../api/transactions.contracts';

/**
 * Fields that the current Transactions editing prototype intentionally allows users to change.
 *
 * Keep this feature-specific. A later table may have completely different editable fields and
 * validation rules, so this must not become a generic grid-level editable-field registry.
 */
export const TRANSACTION_EDITABLE_FIELDS = [
  'account',
  'amount',
  'currency',
  'status',
] as const;

export type TransactionEditableField =
  (typeof TRANSACTION_EDITABLE_FIELDS)[number];

export type TransactionEditableValue = Transaction[TransactionEditableField];

/** Only fields that actually changed are present for a row. */
export type TransactionChanges = Partial<
  Record<TransactionEditableField, TransactionEditableValue>
>;

export interface TransactionLastEdit {
  field: TransactionEditableField;
  value: TransactionEditableValue;
}

export interface TransactionUpdatePayload {
  updates: Array<{
    id: string;
    changes: TransactionChanges;
  }>;
}

export interface TransactionEditingState {
  /** Current changed values grouped by stable backend row ID. */
  changesById: Record<string, TransactionChanges>;

  /**
   * Original values captured on the first change to each row/field.
   *
   * This lets a user change a value several times and eventually return it to its original value.
   * When that happens the field disappears from the eventual update payload instead of being sent
   * as a fake change.
   */
  originalsById: Record<string, TransactionChanges>;
}

/**
 * Flow 1 / Flow 2 target within the CURRENT pagination page.
 *
 * `page` and `selected` affect only those two UI-propagation flows. They do not define the eventual
 * backend bulk-edit scope; that later payload is derived separately from accumulated edits and the
 * current logical row selection.
 */
export type TransactionEditTarget = 'page' | 'selected';

export function createEmptyTransactionEditingState(): TransactionEditingState {
  return {
    changesById: {},
    originalsById: {},
  };
}

function hasOwnField(
  values: TransactionChanges,
  field: TransactionEditableField,
) {
  return Object.prototype.hasOwnProperty.call(values, field);
}

export function isTransactionEditableField(
  field: string | undefined,
): field is TransactionEditableField {
  return TRANSACTION_EDITABLE_FIELDS.includes(
    field as TransactionEditableField,
  );
}

/**
 * Records one concrete row/field value transition.
 *
 * ALL EDITING PATHS CONVERGE HERE
 * -------------------------------
 * - ordinary row/cell editing;
 * - Flow 1: propagate one latest field/value;
 * - Flow 2: propagate one or many explicitly chosen fields.
 *
 * The function intentionally does not know which UI produced the change. That keeps today's
 * prototype controls replaceable by a completely different client UI without changing the actual
 * change-tracking contract.
 *
 * Because state is keyed by stable backend row ID rather than RowNode/cache position, edits remain
 * represented even after pagination or cache eviction removes the original RowNode from memory.
 */
export function recordTransactionCellChange(
  state: TransactionEditingState,
  rowId: string,
  field: TransactionEditableField,
  oldValue: TransactionEditableValue,
  newValue: TransactionEditableValue,
): TransactionEditingState {
  if (Object.is(oldValue, newValue)) return state;

  const currentChanges = state.changesById[rowId] ?? {};
  const currentOriginals = state.originalsById[rowId] ?? {};

  if (
    hasOwnField(currentChanges, field) &&
    Object.is(currentChanges[field], newValue)
  ) {
    return state;
  }

  const nextChanges = { ...currentChanges };
  const nextOriginals = { ...currentOriginals };

  const originalValue = hasOwnField(currentOriginals, field)
    ? currentOriginals[field]
    : oldValue;

  if (!hasOwnField(currentOriginals, field)) {
    nextOriginals[field] = oldValue;
  }

  if (Object.is(originalValue, newValue)) {
    delete nextChanges[field];
    delete nextOriginals[field];
  } else {
    nextChanges[field] = newValue;
  }

  const nextChangesById = { ...state.changesById };
  const nextOriginalsById = { ...state.originalsById };

  if (Object.keys(nextChanges).length === 0) {
    delete nextChangesById[rowId];
    delete nextOriginalsById[rowId];
  } else {
    nextChangesById[rowId] = nextChanges;
    nextOriginalsById[rowId] = nextOriginals;
  }

  return {
    changesById: nextChangesById,
    originalsById: nextOriginalsById,
  };
}

/**
 * DEVELOPMENT / LOCAL-EDIT VIEW
 * -----------------------------
 * Returns every row that currently has a real local change, regardless of whether that row is
 * selected. This is useful for debugging the accumulated UI editing state.
 *
 * This is NOT the eventual backend bulk-edit payload when the product rule is "only selected rows
 * participate in Bulk Update". Use `buildSelectedTransactionUpdatePayload` for that rule.
 */
export function buildTransactionUpdatePayload(
  state: TransactionEditingState,
): TransactionUpdatePayload {
  return {
    updates: Object.entries(state.changesById).map(([id, changes]) => ({
      id,
      changes,
    })),
  };
}

/** Returns whether a concrete row ID belongs to the current logical selection. */
export function isTransactionIdSelected(
  selection: ServerSelectionIntent<string>,
  id: string,
) {
  const ids = new Set(selection.ids);

  return selection.mode === 'include' ? ids.has(id) : !ids.has(id);
}

/**
 * BACKEND BULK-EDIT VIEW
 * ----------------------
 * Builds the exact intersection discussed for a future Bulk Update API:
 *
 *     rows with accumulated changes
 *              ∩
 *     rows currently logically selected
 *              ↓
 *     concrete `{ id, changes }` updates
 *
 * Important consequences:
 * - selected but untouched row -> omitted;
 * - edited but currently unselected row -> omitted;
 * - edited + selected row from Page 1, 3 or 5 -> included by stable ID;
 * - `include` and `exclude` logical selection both work without materialising every server row;
 * - Select All alone never manufactures edits for unloaded/untouched records.
 *
 * This is deliberately a PURE helper. A future Save/Bulk Update button, API layer, test or totally
 * different UI can call it without importing React, MUI or AG Grid RowNodes.
 */
export function buildSelectedTransactionUpdatePayload(
  state: TransactionEditingState,
  selection: ServerSelectionIntent<string>,
): TransactionUpdatePayload {
  return {
    updates: Object.entries(state.changesById)
      .filter(([id]) => isTransactionIdSelected(selection, id))
      .map(([id, changes]) => ({ id, changes })),
  };
}

/**
 * Core reusable transaction edit engine.
 *
 * RESPONSIBILITY
 * --------------
 * Own the accumulated row-ID -> changed-fields state and bridge native AG Grid cell value events to
 * that state. It intentionally does NOT own Flow 1/Flow 2 buttons, target UI, current-page lookup or
 * final backend selection rules.
 *
 * Those concerns are separate because the real UI may change while this underlying editing contract
 * should remain reusable.
 */
export function useTransactionEditing() {
  const [state, setState] = useState<TransactionEditingState>(() =>
    createEmptyTransactionEditingState(),
  );
  const [lastEdit, setLastEdit] = useState<TransactionLastEdit>();

  /**
   * Programmatic Flow 1/2 changes also fire AG Grid value-change events. Record those changes, but
   * do not let them replace Flow 1's notion of the user's most recent DIRECT cell edit.
   */
  const applyingProgrammaticChange = useRef(false);

  /** Native manual-cell edit bridge. */
  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<Transaction>) => {
      if (!event.data || !isTransactionEditableField(event.colDef.field)) return;

      const field = event.colDef.field;
      const oldValue = event.oldValue as TransactionEditableValue;
      const newValue = event.newValue as TransactionEditableValue;

      setState((current) =>
        recordTransactionCellChange(
          current,
          event.data!.id,
          field,
          oldValue,
          newValue,
        ),
      );

      if (!applyingProgrammaticChange.current) {
        setLastEdit({ field, value: newValue });
      }
    },
    [],
  );

  /**
   * Shared mutation primitive used by BOTH Flow 1 and Flow 2 after their target rows are resolved.
   * It records each resulting row/field change individually, then updates currently loaded RowNodes
   * so the user immediately sees the same values in the grid.
   */
  const applyChangesToNodes = useCallback(
    (nodes: readonly IRowNode<Transaction>[], changes: TransactionChanges) => {
      setState((current) => {
        let next = current;

        for (const node of nodes) {
          if (!node.data) continue;

          for (const field of TRANSACTION_EDITABLE_FIELDS) {
            if (!hasOwnField(changes, field)) continue;

            next = recordTransactionCellChange(
              next,
              node.data.id,
              field,
              node.data[field],
              changes[field] as TransactionEditableValue,
            );
          }
        }

        return next;
      });

      applyingProgrammaticChange.current = true;

      try {
        for (const node of nodes) {
          if (!node.data) continue;

          for (const field of TRANSACTION_EDITABLE_FIELDS) {
            if (!hasOwnField(changes, field)) continue;

            const nextValue = changes[field] as TransactionEditableValue;

            if (!Object.is(node.data[field], nextValue)) {
              node.setDataValue(field, nextValue, 'data');
            }
          }
        }
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [],
  );

  /**
   * Re-applies accumulated edits when Infinite/SSRM creates a fresh RowNode for an already-edited
   * row. Until a real Save endpoint exists the backend still returns its old value, so navigation or
   * cache eviction must not make the user's local edit visually disappear.
   */
  const restoreTrackedEdits = useCallback(
    (api: GridApi<Transaction>) => {
      applyingProgrammaticChange.current = true;

      try {
        api.forEachNode((node) => {
          if (!node.data) return;

          const rowChanges = state.changesById[node.data.id];
          if (!rowChanges) return;

          for (const field of TRANSACTION_EDITABLE_FIELDS) {
            if (!hasOwnField(rowChanges, field)) continue;

            const trackedValue = rowChanges[field] as TransactionEditableValue;

            if (!Object.is(node.data[field], trackedValue)) {
              node.setDataValue(field, trackedValue, 'data');
            }
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [state.changesById],
  );

  /** All local UI edits, selected or not. */
  const payload = useMemo(() => buildTransactionUpdatePayload(state), [state]);

  return {
    state,
    editedRowCount: payload.updates.length,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    payload,
  };
}
