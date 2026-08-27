export type GridRowInteractionMode = 'enabled' | 'selectionDisabled' | 'readOnly';

/**
 * Selection eligibility is intentionally narrower than full row interactivity.
 *
 * `selectionDisabled` rows remain usable for row-level/editing flows but must never enter grid
 * selection or selection-based bulk actions. `readOnly` is the stronger state and is also excluded
 * from selection.
 */
export function isGridRowSelectable(mode: GridRowInteractionMode): boolean {
  return mode === 'enabled';
}

/** A fully read-only row cannot be edited, while selection-disabled rows may still be edited. */
export function isGridRowEditable(mode: GridRowInteractionMode): boolean {
  return mode !== 'readOnly';
}

/** Use this for row-level modifying controls that should be unavailable on fully read-only rows. */
export function isGridRowReadOnly(mode: GridRowInteractionMode): boolean {
  return mode === 'readOnly';
}
