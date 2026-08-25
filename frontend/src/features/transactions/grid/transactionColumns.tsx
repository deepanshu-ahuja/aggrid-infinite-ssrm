import type { ColDef } from 'ag-grid-community';
import {
  serverDateFilterParams,
  serverNumberFilterParams,
  serverTextFilterParams,
} from '@/shared/grid/config/serverFilterParams';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionRowEditActions } from './TransactionRowEditActions';
import { TransactionStatusCell } from './TransactionStatusCell';
import { TransactionStatusEditor } from './TransactionStatusEditor';

/**
 * Column definitions for the Transactions feature.
 *
 * Editing is feature-owned. Reference/date remain read-only; account/amount/currency/status are
 * editable. Single-row Save/Discard lives in the Actions column beside the row rather than in an
 * external dirty-row list.
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
    field: 'account',
    headerName: 'Account',
    minWidth: 150,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    editable: true,
  },
  {
    field: 'amount',
    headerName: 'Amount',
    type: 'numericColumn',
    minWidth: 140,
    filter: 'agNumberColumnFilter',
    filterParams: serverNumberFilterParams,
    editable: true,
    cellEditor: 'agNumberCellEditor',
    valueFormatter: ({ value, data }) =>
      typeof value === 'number' ? formatCurrency(value, data?.currency ?? 'USD') : '',
  },
  {
    field: 'currency',
    headerName: 'Currency',
    maxWidth: 120,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    editable: true,
  },
  {
    field: 'status',
    headerName: 'Status',
    minWidth: 130,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    cellRenderer: TransactionStatusCell,
    editable: true,
    cellEditor: TransactionStatusEditor,
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
