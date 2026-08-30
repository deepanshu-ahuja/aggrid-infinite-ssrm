// GRIDCAP-COLUMNS | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-EDIT-SAVE-ROW
import type { ColDef, ICellEditorParams } from 'ag-grid-community';
import {
  serverDateFilterParams,
  serverNumberFilterParams,
  serverTextFilterParams,
} from '@/shared/grid/config/serverFilterParams';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionInteractionCell } from './TransactionInteractionCell';
import { TransactionNativeAccountEditor } from './TransactionNativeAccountEditor';
import { TransactionNativeDateEditor } from './TransactionNativeDateEditor';
import {
  TransactionNativeDraftRowActions,
  type TransactionNativeDraftContext,
} from './TransactionNativeDraftRowActions';
import type { TransactionEditableField, TransactionEditableValue } from './transactionEditing';
import { isTransactionCellEditable } from './transactionRowInteraction';
import { TransactionStatusCell } from './TransactionStatusCell';
import { TransactionStatusEditor } from './TransactionStatusEditor';
import { validateTransactionField } from './transactionValidation';

function getDraftContext(params: { context?: unknown }) {
  return params.context as TransactionNativeDraftContext | undefined;
}

function dirtyCellPresentation(field: TransactionEditableField): Pick<ColDef<Transaction>, 'cellClassRules'> {
  return {
    cellClassRules: {
      'grid-cell--draft-dirty': (params) =>
        Boolean(params.data && getDraftContext(params)?.isCellDirty(params.data.id, field)),
    },
  };
}

function getProvidedEditorValidation(field: TransactionEditableField) {
  return (params: ICellEditorParams<Transaction, TransactionEditableValue>) => {
    const errors = validateTransactionField(field, params.value);
    return errors.length > 0 ? errors.map((error) => error.message) : null;
  };
}

/** SSRM columns for the isolated native-editing spike. */
export const transactionNativeEditingColumns: ColDef<Transaction>[] = [
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
    cellEditor: TransactionNativeAccountEditor,
    cellEditorPopup: true,
    cellEditorPopupPosition: 'under',
    ...dirtyCellPresentation('account'),
  },
  {
    field: 'amount',
    headerName: 'Amount',
    type: 'numericColumn',
    cellDataType: 'number',
    minWidth: 140,
    filter: 'agNumberColumnFilter',
    filterParams: serverNumberFilterParams,
    editable: isTransactionCellEditable,
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      min: 0,
      max: 1_000_000,
      getValidationErrors: getProvidedEditorValidation('amount'),
    },
    valueFormatter: ({ value, data }) =>
      typeof value === 'number' ? formatCurrency(value, data?.currency ?? 'USD') : '',
    ...dirtyCellPresentation('amount'),
  },
  {
    field: 'currency',
    headerName: 'Currency',
    maxWidth: 120,
    filter: 'agTextColumnFilter',
    filterParams: serverTextFilterParams,
    editable: isTransactionCellEditable,
    cellEditor: 'agTextCellEditor',
    cellEditorParams: {
      maxLength: 3,
      getValidationErrors: getProvidedEditorValidation('currency'),
    },
    ...dirtyCellPresentation('currency'),
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
    ...dirtyCellPresentation('status'),
  },
  {
    field: 'transactionDate',
    headerName: 'Transaction date',
    minWidth: 180,
    filter: 'agDateColumnFilter',
    filterParams: serverDateFilterParams,
    editable: isTransactionCellEditable,
    cellEditor: TransactionNativeDateEditor,
    cellEditorPopup: true,
    cellEditorPopupPosition: 'under',
    valueFormatter: ({ value }) => (typeof value === 'string' ? formatDate(value) : ''),
    ...dirtyCellPresentation('transactionDate'),
  },
  {
    colId: 'editActions',
    headerName: 'Actions',
    minWidth: 160,
    maxWidth: 180,
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: TransactionNativeDraftRowActions,
  },
];
