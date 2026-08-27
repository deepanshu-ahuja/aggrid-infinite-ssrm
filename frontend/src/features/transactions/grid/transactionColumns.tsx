import type { ColDef } from 'ag-grid-community';
import {
  serverDateFilterParams,
  serverNumberFilterParams,
  serverTextFilterParams,
} from '@/shared/grid/config/serverFilterParams';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionInteractionCell } from './TransactionInteractionCell';
import { TransactionRowEditActions } from './TransactionRowEditActions';
import { isTransactionCellEditable } from './transactionRowInteraction';
import { TransactionStatusCell } from './TransactionStatusCell';
import { TransactionStatusEditor } from './TransactionStatusEditor';

/**
 * Column definitions for the Transactions feature.
 *
 * Editing is feature-owned. Reference/date remain read-only; account/amount/currency/status are
 * editable only when the backend-provided row interaction policy allows editing. Selection-disabled
 * rows can still be edited; fully read-only rows cannot.
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
    editable: isTransactionCellEditable,
  },
  {
    field: 'amount',
    headerName: 'Amount',
    type: 'numericColumn',
    minWidth: 140,
    filter: 'agNumberColumnFilter',
    filterParams: serverNumberFilterParams,
    editable: isTransactionCellEditable,
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
    editable: isTransactionCellEditable,
  },
  {
    field: 'status',
    headerName: 'Status',
    minWidth: 130,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    cellRenderer: TransactionStatusCell,
    editable: isTransactionCellEditable,
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
