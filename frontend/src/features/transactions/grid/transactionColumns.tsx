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

/**
 * Column definitions for the Transactions feature.
 *
 * RESPONSIBILITY BOUNDARY
 * -----------------------
 * Shared grid code owns behaviour expected to repeat across server-backed tables, such as the
 * standard Text / Number / Date filter presets.
 *
 * This file owns Transaction-specific decisions:
 * - which fields are displayed;
 * - headers and widths;
 * - which AG Grid filter type each Transaction field uses;
 * - Transaction-specific formatting/rendering;
 * - any deliberate field-level override of a shared filter preset.
 *
 * FILTER CONTRACT
 * ---------------
 * The filter configuration in this file is one end of an end-to-end contract:
 *
 * AG Grid column/filter UI
 *      ↓
 * AG Grid filter model
 *      ↓
 * `transactionRequest.mapper.ts`
 *      ↓
 * shared `GridListRequest<TransactionField>`
 *      ↓
 * backend
 *
 * If a field starts exposing a new operator or filter model shape, update/review the mapper, shared
 * query contract, backend implementation, and tests together. Do not expose an AG Grid capability
 * that the backend cannot execute correctly.
 *
 * OVERRIDING A SHARED FILTER PRESET
 * ---------------------------------
 * A field may deliberately narrow or alter a shared preset:
 *
 * ```ts
 * filterParams: {
 *   ...serverTextFilterParams,
 *   filterOptions: ['equals', 'notEqual'],
 * }
 * ```
 *
 * Keep overrides visible in this feature file and document why that field differs.
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
  },
  {
    field: 'amount',
    headerName: 'Amount',
    type: 'numericColumn',
    minWidth: 140,
    filter: 'agNumberColumnFilter',
    filterParams: serverNumberFilterParams,

    /**
     * `valueFormatter` changes presentation only. AG Grid still sorts/filters this column using the
     * underlying numeric `amount` value, which is what our server-side mapper/backend contract
     * expects.
     */
    valueFormatter: ({ value, data }) =>
      typeof value === 'number' ? formatCurrency(value, data?.currency ?? 'USD') : '',
  },
  {
    field: 'currency',
    headerName: 'Currency',
    maxWidth: 120,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
  },
  {
    field: 'status',
    headerName: 'Status',
    minWidth: 130,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    cellRenderer: TransactionStatusCell,
  },
  {
    field: 'transactionDate',
    headerName: 'Transaction date',
    minWidth: 180,
    filter: 'agDateColumnFilter',
    filterParams: serverDateFilterParams,

    /**
     * Display formatting is intentionally separate from filtering. The mapper normalises AG Grid's
     * Date Filter value for the backend; this formatter only controls what the user sees in the cell.
     */
    valueFormatter: ({ value }) => (typeof value === 'string' ? formatDate(value) : ''),
  },
];
