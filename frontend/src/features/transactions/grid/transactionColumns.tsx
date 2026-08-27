import type { ColDef, EditableCallbackParams } from 'ag-grid-community';
import {
  serverDateFilterParams,
  serverNumberFilterParams,
  serverTextFilterParams,
} from '@/shared/grid/config/serverFilterParams';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionInteractionCell } from './TransactionInteractionCell';
import {
  TransactionRowEditActions,
  type TransactionRowEditActionsContext,
} from './TransactionRowEditActions';
import type { TransactionEditableField } from './transactionEditing';
import { isTransactionCellEditable } from './transactionRowInteraction';
import { TransactionStatusCell } from './TransactionStatusCell';
import { TransactionStatusEditor } from './TransactionStatusEditor';

function getConflictContext(params: { context?: unknown }) {
  return params.context as TransactionRowEditActionsContext | undefined;
}

/**
 * Compose the normal row editability rule with conflict state. A conflicted field cannot open its editor
 * until the user explicitly chooses the server value or keeps the local value from the conflict popover.
 */
function isConflictAwareEditable(
  params: EditableCallbackParams<Transaction>,
  field: TransactionEditableField,
) {
  if (!isTransactionCellEditable(params) || !params.data) return false;
  return !getConflictContext(params)?.isCellConflicted(params.data.id, field);
}

/** Shared presentation callbacks for the four Transaction fields that participate in tracked editing. */
function conflictPresentation(field: TransactionEditableField): Pick<
  ColDef<Transaction>,
  'cellClassRules' | 'tooltipValueGetter'
> {
  return {
    cellClassRules: {
      'grid-cell--edit-conflict': (params) =>
        Boolean(params.data && getConflictContext(params)?.isCellConflicted(params.data.id, field)),
    },
    tooltipValueGetter: (params) => {
      if (!params.data) return undefined;
      const conflict = getConflictContext(params)?.getCellConflict(params.data.id, field);
      if (!conflict) return undefined;
      return `Your edit: ${String(conflict.localValue)}. Server value: ${String(conflict.remoteValue)}. Click to resolve.`;
    },
  };
}

/**
 * Column definitions for the Transactions feature.
 *
 * Editing remains feature-owned. Conflict detection/state lives in shared tracked editing, while these
 * columns compose Transaction-specific editability and visual treatment without duplicating the state machine.
 */
export const transactionColumns: ColDef<Transaction>[] = [
  {
    field: 'reference',
    headerName: 'Reference',
    minWidth: 150,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
  },
  {
    colId: 'interaction',
    headerName: 'Access',
    minWidth: 135,
    maxWidth: 155,
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: TransactionInteractionCell,
  },
  {
    field: 'account',
    headerName: 'Account',
    minWidth: 150,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    editable: (params) => isConflictAwareEditable(params, 'account'),
    ...conflictPresentation('account'),
  },
  {
    field: 'amount',
    headerName: 'Amount',
    type: 'numericColumn',
    minWidth: 140,
    filter: 'agNumberColumnFilter',
    filterParams: serverNumberFilterParams,
    editable: (params) => isConflictAwareEditable(params, 'amount'),
    cellEditor: 'agNumberCellEditor',
    valueFormatter: ({ value, data }) =>
      typeof value === 'number' ? formatCurrency(value, data?.currency ?? 'USD') : '',
    ...conflictPresentation('amount'),
  },
  {
    field: 'currency',
    headerName: 'Currency',
    maxWidth: 120,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    editable: (params) => isConflictAwareEditable(params, 'currency'),
    ...conflictPresentation('currency'),
  },
  {
    field: 'status',
    headerName: 'Status',
    minWidth: 130,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    cellRenderer: TransactionStatusCell,
    editable: (params) => isConflictAwareEditable(params, 'status'),
    cellEditor: TransactionStatusEditor,
    ...conflictPresentation('status'),
  },
  {
    field: 'transactionDate',
    headerName: 'Transaction date',
    minWidth: 180,
    filter: 'agDateColumnFilter',
    filterParams: serverDateFilterParams,
    valueFormatter: ({ value }) => (typeof value === 'string' ? formatDate(value) : ''),
  },
  {
    colId: 'editActions',
    headerName: 'Actions',
    minWidth: 160,
    maxWidth: 180,
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: TransactionRowEditActions,
  },
];
