// GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-EDIT-TRACKED
export type GridRowInteractionMode = 'enabled' | 'selectionDisabled' | 'readOnly';

/**
 * Small, domain-neutral vocabulary used by every server-backed grid that needs row restrictions.
 *
 * IMPORTANT: these names describe GRID BEHAVIOUR, not the business reason.
 *
 * Examples of business reasons that must stay outside this shared file:
 * - a completed Transaction may be locked;
 * - a Payable may require approval before bulk actions;
 * - a row may be restricted by permissions or workflow state.
 *
 * Each feature/backend decides WHY a row has a mode. Shared grid code only translates that mode into
 * consistent selection/editing behaviour.
 */

/**
 * Can this row participate in AG Grid selection?
 *
 * Only `enabled` rows are selectable. This intentionally makes both restricted modes live outside the
 * selection universe instead of pretending they are user-created exclusions.
 */
export function isGridRowSelectable(mode: GridRowInteractionMode): boolean {
  // `selectionDisabled` means exactly what its name says: the row can still be used/edited, but the
  // checkbox and every selection-based bulk action must ignore it.
  //
  // `readOnly` is stronger, so it is also non-selectable.
  //
  // Do NOT change this to `mode !== 'readOnly'`; doing that would accidentally allow a
  // `selectionDisabled` row into Current Page / All Filtered / All Records selection flows.
  return mode === 'enabled';
}

/**
 * Can editable AG Grid columns (and our programmatic edit helpers) modify this row?
 */
export function isGridRowEditable(mode: GridRowInteractionMode): boolean {
  // Selection eligibility and edit eligibility are deliberately separate concepts.
  // `selectionDisabled` must remain editable for individual work, while only the stronger `readOnly`
  // mode blocks editing.
  return mode !== 'readOnly';
}

/**
 * Convenience predicate for feature row-actions/presentation that need to know the stronger state.
 */
export function isGridRowReadOnly(mode: GridRowInteractionMode): boolean {
  // Keep this explicit instead of deriving read-only from "not selectable". Both restricted modes are
  // non-selectable, but only one of them is actually read-only.
  return mode === 'readOnly';
}
