/**
 * Domain-neutral interaction levels for one server-backed grid row.
 *
 * A feature decides WHY a row has a mode (permissions, workflow state, lock state, validation, etc.).
 * Shared grid code only consumes the resulting capability:
 *
 * - enabled: normal selection and editing;
 * - selectionDisabled: excluded from checkbox/bulk selection, but otherwise still editable;
 * - readOnly: excluded from selection and not editable through modifying UI.
 *
 * This is intentionally not AG Grid state. It is application/business capability metadata that a
 * concrete grid maps onto native AG Grid callbacks such as `rowSelection.isRowSelectable` and
 * column `editable` callbacks.
 */
export type GridRowInteractionMode = 'enabled' | 'selectionDisabled' | 'readOnly';

/** A row participates in checkbox/logical bulk selection only in the fully enabled mode. */
export function isGridRowSelectable(mode: GridRowInteractionMode) {
  return mode === 'enabled';
}

/** Selection-disabled rows remain editable; only the stronger read-only mode blocks editing. */
export function isGridRowEditable(mode: GridRowInteractionMode) {
  return mode !== 'readOnly';
}

/** Convenience predicate for read-only presentation/action decisions. */
export function isGridRowReadOnly(mode: GridRowInteractionMode) {
  return mode === 'readOnly';
}
