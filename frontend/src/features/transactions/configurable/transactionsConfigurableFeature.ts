// GRIDCAP-DATA-LOAD | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-COLUMNS
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { normalizeFeatureDefinition } from '@/shared/grid/configurable/configuration.normalizer';
import type { ConfigurableGridRegistries } from '@/shared/grid/configurable/configuration.registries';
import { defaultGridValidatorRegistry } from '@/shared/grid/validation/defaultGridValidationRules';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionInteractionCell } from '../grid/TransactionInteractionCell';
import { TransactionStatusCell } from '../grid/TransactionStatusCell';
import { mapTransactionGridRequest } from '../grid/transactionRequest.mapper';

/**
 * Backend-like JSON for the first real configurable consumer.
 *
 * This deliberately stays free of functions and React components. Even though the object currently
 * lives in frontend source, it enters the same `unknown -> validate + normalize` boundary that a
 * future backend response must use.
 */
export const rawTransactionsConfigurableFeature: unknown = {
  featureKey: 'transactionReview',
  entities: {
    transaction: {
      labelKey: 'transactions.entity.label',
      dataAdapterKey: 'transactions',
      rowId: { path: 'id' },
      gridOptions: {
        paginationPageSize: 25,
        defaultColDef: {
          resizable: true,
        },
        rowSelection: {
          mode: 'multiRow',
          checkboxes: true,
          headerCheckbox: true,
          selectAll: 'all',
        },
      },
      fields: [
        {
          colId: 'reference',
          field: 'reference',
          labelKey: 'transactions.fields.reference',
          cellDataType: 'text',
          minWidth: 150,
          sortable: true,
          filter: 'agTextColumnFilter',
          filterParams: {
            filterOptions: ['contains', 'equals', 'notEqual', 'startsWith', 'endsWith'],
          },
          editable: false,
        },
        {
          colId: 'interaction',
          field: 'interactionMode',
          labelKey: 'transactions.fields.interaction',
          cellDataType: 'text',
          minWidth: 135,
          maxWidth: 155,
          sortable: false,
          filter: false,
          editable: false,
          cellRenderer: 'transactionInteraction',
        },
        {
          colId: 'account',
          field: 'account',
          labelKey: 'transactions.fields.account',
          cellDataType: 'text',
          minWidth: 150,
          sortable: true,
          filter: 'agTextColumnFilter',
          filterParams: {
            filterOptions: ['contains', 'equals', 'notEqual', 'startsWith', 'endsWith'],
          },
          editable: true,
          cellEditor: 'agTextCellEditor',
          cellEditorParams: {
            maxLength: 100,
          },
          validationRules: [
            { key: 'required', message: 'Account is required.' },
            {
              key: 'maxLength',
              params: { max: 100 },
              message: 'Account must be 100 characters or fewer.',
            },
          ],
        },
        {
          colId: 'amount',
          field: 'amount',
          labelKey: 'transactions.fields.amount',
          cellDataType: 'number',
          type: 'numericColumn',
          minWidth: 140,
          sortable: true,
          filter: 'agNumberColumnFilter',
          filterParams: {
            filterOptions: [
              'equals',
              'notEqual',
              'greaterThan',
              'greaterThanOrEqual',
              'lessThan',
              'lessThanOrEqual',
            ],
          },
          editable: true,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: {
            min: 0,
            max: 1000000,
          },
          validationRules: [
            {
              key: 'numberRange',
              params: { min: 0, max: 1000000 },
              message: 'Amount must be between 0 and 1,000,000.',
            },
          ],
          valueFormatterKey: 'transactionCurrency',
        },
        {
          colId: 'currency',
          field: 'currency',
          labelKey: 'transactions.fields.currency',
          cellDataType: 'text',
          maxWidth: 120,
          sortable: true,
          filter: 'agTextColumnFilter',
          filterParams: {
            filterOptions: ['equals', 'notEqual'],
          },
          editable: true,
          cellEditor: 'agTextCellEditor',
          cellEditorParams: {
            maxLength: 3,
          },
          validationRules: [
            { key: 'required', message: 'Currency is required.' },
            {
              key: 'maxLength',
              params: { max: 3 },
              message: 'Currency must be 3 characters or fewer.',
            },
            { key: 'currencyCode', message: 'Currency must be a 3-letter code.' },
          ],
          valueParserKey: 'uppercaseText',
        },
        {
          colId: 'status',
          field: 'status',
          labelKey: 'transactions.fields.status',
          cellDataType: 'text',
          minWidth: 130,
          sortable: true,
          filter: 'agTextColumnFilter',
          filterParams: {
            filterOptions: ['equals', 'notEqual'],
          },
          editable: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Completed', 'Pending', 'Failed'],
          },
          cellRenderer: 'transactionStatus',
          validationRules: [
            { key: 'required', message: 'Status is required.' },
            { key: 'transactionStatus', message: 'Status must be Completed, Pending, or Failed.' },
          ],
        },
        {
          colId: 'transactionDate',
          field: 'transactionDate',
          labelKey: 'transactions.fields.transactionDate',
          cellDataType: 'dateString',
          minWidth: 180,
          sortable: true,
          filter: 'agDateColumnFilter',
          filterParams: {
            filterOptions: ['equals', 'notEqual', 'lessThan', 'greaterThan'],
          },
          editable: true,
          cellEditor: 'agTextCellEditor',
          validationRules: [
            { key: 'required', message: 'Transaction date is required.' },
            { key: 'transactionDate', message: 'Transaction date must use YYYY-MM-DD.' },
          ],
          valueFormatterKey: 'transactionDate',
        },
      ],
    },
  },
};

export const transactionsConfigurableFeature = normalizeFeatureDefinition(
  rawTransactionsConfigurableFeature,
);

const TRANSACTION_LABELS: Readonly<Record<string, string>> = {
  'transactions.entity.label': 'Transactions',
  'transactions.fields.reference': 'Reference',
  'transactions.fields.interaction': 'Access',
  'transactions.fields.account': 'Account',
  'transactions.fields.amount': 'Amount',
  'transactions.fields.currency': 'Currency',
  'transactions.fields.status': 'Status',
  'transactions.fields.transactionDate': 'Transaction date',
};

export function resolveTransactionConfigurableLabel(labelKey: string) {
  const label = TRANSACTION_LABELS[labelKey];
  if (!label) throw new Error(`Unknown Transaction configurable label key: ${labelKey}`);
  return label;
}

/**
 * Executable behavior is registered in frontend code. Metadata can select these keys but can never
 * supply the component/function implementation itself.
 */
export const transactionConfigurableRegistries: ConfigurableGridRegistries<Transaction> = {
  filters: new Set(['agTextColumnFilter', 'agNumberColumnFilter', 'agDateColumnFilter']),
  editors: new Set(['agTextCellEditor', 'agNumberCellEditor', 'agSelectCellEditor']),
  renderers: new Set(['transactionInteraction', 'transactionStatus']),
  components: {
    transactionInteraction: TransactionInteractionCell,
    transactionStatus: TransactionStatusCell,
  },
  valueFormatters: {
    transactionCurrency: () => ({ value, data }) =>
      typeof value === 'number'
        ? formatCurrency(value, data?.currency ?? 'USD')
        : '',
    transactionDate: () => ({ value }) =>
      typeof value === 'string' ? formatDate(value) : '',
  },
  valueParsers: {
    uppercaseText: () => ({ newValue }) =>
      typeof newValue === 'string' ? newValue.trim().toUpperCase() : newValue,
  },
  validators: {
    ...defaultGridValidatorRegistry,
    currencyCode: (value) => ({
      valid: typeof value === 'string' && /^[A-Z]{3}$/.test(value),
      defaultMessage: 'Must be a 3-letter currency code.',
    }),
    transactionStatus: (value) => ({
      valid: value === 'Completed' || value === 'Pending' || value === 'Failed',
      defaultMessage: 'Must be a supported Transaction status.',
    }),
    transactionDate: (value) => ({
      valid:
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      defaultMessage: 'Must use YYYY-MM-DD.',
    }),
  },
};

const transactionConfigurableRowsLoader: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

export const transactionConfigurableDataAdapters: Readonly<
  Record<string, GridRowsLoader<Transaction>>
> = {
  transactions: transactionConfigurableRowsLoader,
};

export function requireTransactionConfigurableDataAdapter(key: string) {
  const adapter = transactionConfigurableDataAdapters[key];
  if (!adapter) throw new Error(`Unknown Transaction configurable data adapter: ${key}`);
  return adapter;
}
