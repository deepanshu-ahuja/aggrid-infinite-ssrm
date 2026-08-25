import type {
  SelectionHeaderState,
  ServerSelectionIntent,
} from '../serverSelection';

/**
 * Small contract for Infinite Row Model behavior AG Grid cannot fully own: dataset-wide Select All
 * across unloaded rows.
 *
 * Ordinary/manual/current-page Infinite selection is intentionally NOT represented here; AG Grid
 * owns that natively through stable row IDs and Grid State.
 */
export interface InfiniteSelectionController {
  /** Current JSON-safe logical include/exclude selection. */
  intent: ServerSelectionIntent<string>;

  /** State rendered by the custom Infinite dataset header checkbox. */
  headerState: SelectionHeaderState;

  /** Accessible label explaining the dataset scope of the custom header checkbox. */
  headerLabel: string;

  /** Returns whether a currently materialised row should appear selected. */
  isRowSelected: (rowId: string) => boolean;

  /** Receives a user-originated row checkbox change while dataset Select-All semantics are active. */
  setRowSelected: (rowId: string, selected: boolean) => void;

  /** Applies/clears dataset-wide Select All. */
  setHeaderSelected: (checked: boolean) => void;

  /** Explicit application/user reset. */
  clearSelection: () => void;

  /** Optional lifecycle reset required only by Select All Filtered. */
  onFilterChanged?: () => void;
}
