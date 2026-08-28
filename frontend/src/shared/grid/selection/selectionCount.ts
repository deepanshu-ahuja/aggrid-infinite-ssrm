import type { GridSelectionId, ServerSelectionIntent } from './serverSelection';

/**
 * Count the rows represented by a compact logical selection.
 *
 * `include` is exact because every selected ID is explicit.
 * `exclude` represents dataset-wide Select All, so the caller supplies the authoritative size of the
 * selected universe (normal API `totalCount` for All Records, or the accepted filtered result count
 * for All Filtered) and the exception IDs are subtracted from it.
 *
 * IMPORTANT CURRENT LIMITATION
 * ----------------------------
 * The foundation currently uses the normal dataset/filter totals. Those totals can include rows that
 * the grid marks `selectionDisabled` / `readOnly`. We intentionally do not subtract only the disabled
 * rows currently loaded in the browser because that would produce a falsely precise count for unloaded
 * server rows. A production backend can later pass an eligibility-aware total here (for example,
 * `selectionEligibleTotalCount`) without changing the logical include/exclude selection model.
 */
export function getLogicalSelectedRowCount<TId extends GridSelectionId>(
  selection: ServerSelectionIntent<TId>,
  scopeTotal: number,
) {
  if (selection.mode === 'include') {
    return selection.ids.length;
  }

  // Defensive clamp protects presentation if a stale/invalid exception list is temporarily larger
  // than a newly returned scope total during a server refresh. It must never render a negative count.
  return Math.max(0, scopeTotal - selection.ids.length);
}
