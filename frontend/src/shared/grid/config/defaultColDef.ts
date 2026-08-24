import type { ColDef } from 'ag-grid-community';

// `satisfies` validates the shared defaults without widening generic fields such as `field`.
// AG Grid applies this object globally while each feature retains the native typed grid/column API.
export const baseDefaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
  minWidth: 120,
} satisfies ColDef;
