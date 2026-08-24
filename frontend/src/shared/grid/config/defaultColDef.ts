import type { ColDef } from 'ag-grid-community';

// `satisfies` validates the shared defaults without widening generic fields such as `field`.
// That keeps AppGrid type-safe for each feature's row model when the definitions are merged.
export const baseDefaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
  minWidth: 120,
} satisfies ColDef;
