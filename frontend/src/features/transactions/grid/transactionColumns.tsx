import type { ColDef } from 'ag-grid-community';
import {
  serverDateFilterParams,
  serverNumberFilterParams,
  serverTextFilterParams,
} from '@/shared/grid/config/serverFilterParams';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionStatusCell } from './TransactionStatusCell';
import { TransactionStatusEditor } from './TransactionStatusEditor';

/**
 * Column definitions for the Transactions feature.
 *
 * Editing is deliberately feature-owned. This prototype keeps reference/date read-only while
 * allowing several representative editable fields so we can exercise normal AG Grid editors plus
 * one custom MUI editor without inventing a generic editing wrapper.
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
];
