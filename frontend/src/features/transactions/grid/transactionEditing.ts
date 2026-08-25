import { useCallback, useMemo, useRef, useState } from 'react';
import type { CellValueChangedEvent, GridApi, IRowNode } from 'ag-grid-community';
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
 * All editing paths use this same function:
 * - ordinary AG Grid cell editing;
 * - Flow 1 (apply the last edited field/value to the current page);
 * - Flow 2 (apply one or more chosen fields to the current page).
 *
 * Because the state is keyed by backend row ID rather than RowNode/cache position, edits can remain
 * represented even after the user navigates to another pagination page and AG Grid evicts a block.
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

/** Builds the backend-shaped preview from only rows/fields that are still changed. */
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

/**
 * Small feature hook that connects AG Grid editing events to the row-ID change model above.
 *
 * It does not know whether the host grid is Infinite or SSRM. Row-model-specific code still owns
 * how current-page RowNodes are found and how selection narrows those nodes.
 */
export function useTransactionEditing() {
  const [state, setState] = useState<TransactionEditingState>(() =>
    createEmptyTransactionEditingState(),
  );
  const [lastEdit, setLastEdit] = useState<TransactionLastEdit>();

  /**
   * Programmatic page-level changes also fire AG Grid value-change events. We still record those
   * changes, but they must not replace Flow 1's notion of the user's last directly edited cell.
   */
  const applyingProgrammaticChange = useRef(false);

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
   * Applies changes to concrete loaded RowNodes and records exactly the same per-row changes that
   * ordinary one-by-one editing would create.
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
   * Re-applies tracked edits when Infinite/SSRM creates a fresh RowNode for a row that was edited on
   * another page earlier. The server still returns its persisted/original value until the future
   * Save action exists, so the UI needs this row-ID reconciliation after cache reloads.
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

  const payload = useMemo(() => buildTransactionUpdatePayload(state), [state]);

  return {
    editedRowCount: payload.updates.length,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    payload,
  };
}
