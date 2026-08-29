// GRIDCAP-COLUMNS | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION | GRIDCAP-EDIT-SAVE-ROW
import type { ColDef, EditableCallbackParams } from 'ag-grid-community';
import {
  serverDateFilterParams,
  serverNumberFilterParams,
  serverTextFilterParams,
} from '@/shared/grid/config/serverFilterParams';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionAccountEditor } from './TransactionAccountEditor';
import { TransactionDateEditor } from './TransactionDateEditor';
import { TransactionInteractionCell } from './TransactionInteractionCell';
import {
  TransactionRowEditActions,
  type TransactionRowEditActionsContext,
} from './TransactionRowEditActions';
import type { TransactionEditableField } from './transactionEditing';
import { isTransactionCellEditable } from './transactionRowInteraction';
import { TransactionStatusCell } from './TransactionStatusCell';
import { TransactionStatusEditor } from './TransactionStatusEditor';

function getEditContext(params: { context?: unknown }) {
  return params.context as TransactionRowEditActionsContext | undefined;
}

/**
 * Compose the normal row editability rule with conflict state. A conflicted field cannot open its editor
 * until the user explicitly chooses the server value or keeps the local value from the conflict popover.
 * Validation does not disable editing because correction must remain possible in-place.
 */
function isConflictAwareEditable(
  params: EditableCallbackParams<Transaction>,
  field: TransactionEditableField,
) {
  if (!isTransactionCellEditable(params) || !params.data) return false;
  return !getEditContext(params)?.isCellConflicted(params.data.id, field);
}

/** Shared presentation callbacks for fields participating in tracked editing, conflict and validation. */
function editStatePresentation(field: TransactionEditableField): Pick<
  ColDef<Transaction>,
  'cellClassRules' | 'tooltipValueGetter'
> {
  return {
    cellClassRules: {
      'grid-cell--edit-conflict': (params) =>
        Boolean(params.data && getEditContext(params)?.isCellConflicted(params.data.id, field)),
      'grid-cell--validation-error': (params) =>
        Boolean(params.data && getEditContext(params)?.isCellInvalid(params.data.id, field)),
    },
    tooltipValueGetter: (params) => {
      if (!params.data) return undefined;
      const context = getEditContext(params);
      const conflict = context?.getCellConflict(params.data.id, field);
      const validationMessages = context?.getCellValidationMessages(params.data.id, field) ?? [];

      const parts: string[] = [];
      if (validationMessages.length > 0) parts.push(`Validation: ${validationMessages.join(' ')}`);
      if (conflict) {
        parts.push(
          `Conflict — your edit: ${String(conflict.localValue)}. Server value: ${String(conflict.remoteValue)}. Click to resolve.`,
        );
      }
      return parts.length > 0 ? parts.join(' ') : undefined;
    },
  };
}

interface TransactionColumnFilterParams {
  text?: typeof serverTextFilterParams;
  number?: typeof serverNumberFilterParams;
  date?: typeof serverDateFilterParams;
}

/** Build Transaction columns while allowing each row model to supply only its filtering mechanics. */
function createTransactionColumns(filterParams: TransactionColumnFilterParams): ColDef<Transaction>[] {
  return [
    {
      field: 'reference',
      headerName: 'Reference',
      minWidth: 150,
      filter: 'agTextColumnFilter',
      ...(filterParams.text ? { filterParams: filterParams.text } : {}),
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
      ...(filterParams.text ? { filterParams: filterParams.text } : {}),
      editable: (params) => isConflictAwareEditable(params, 'account'),
      // One explicit MUI text-editor example. Popup space lets helper text explain the exact validation
      // failure without forcing AG Grid row height/column geometry to accommodate form-field chrome.
      cellEditor: TransactionAccountEditor,
      cellEditorPopup: true,
      cellEditorPopupPosition: 'under',
      ...editStatePresentation('account'),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      type: 'numericColumn',
      minWidth: 140,
      filter: 'agNumberColumnFilter',
      ...(filterParams.number ? { filterParams: filterParams.number } : {}),
      editable: (params) => isConflictAwareEditable(params, 'amount'),
      cellEditor: 'agNumberCellEditor',
      valueFormatter: ({ value, data }) =>
        typeof value === 'number' ? formatCurrency(value, data?.currency ?? 'USD') : '',
      ...editStatePresentation('amount'),
    },
    {
      field: 'currency',
      headerName: 'Currency',
      maxWidth: 120,
      filter: 'agTextColumnFilter',
      ...(filterParams.text ? { filterParams: filterParams.text } : {}),
      editable: (params) => isConflictAwareEditable(params, 'currency'),
      ...editStatePresentation('currency'),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 130,
      filter: 'agTextColumnFilter',
      ...(filterParams.text ? { filterParams: filterParams.text } : {}),
      cellRenderer: TransactionStatusCell,
      editable: (params) => isConflictAwareEditable(params, 'status'),
      cellEditor: TransactionStatusEditor,
      ...editStatePresentation('status'),
    },
    {
      field: 'transactionDate',
      headerName: 'Transaction date',
      minWidth: 180,
      filter: 'agDateColumnFilter',
      ...(filterParams.date ? { filterParams: filterParams.date } : {}),
      editable: (params) => isConflictAwareEditable(params, 'transactionDate'),
      cellEditor: TransactionDateEditor,
      cellEditorPopup: true,
      cellEditorPopupPosition: 'under',
      valueFormatter: ({ value }) => (typeof value === 'string' ? formatDate(value) : ''),
      ...editStatePresentation('transactionDate'),
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
}

export const transactionColumns = createTransactionColumns({
  text: serverTextFilterParams,
  number: serverNumberFilterParams,
  date: serverDateFilterParams,
});

export const transactionClientColumns = createTransactionColumns({});
