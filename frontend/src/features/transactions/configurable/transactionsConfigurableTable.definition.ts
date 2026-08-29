// GRIDCAP-CONFIGURABLE-TABLE
import type { ConfigurableTableDefinition } from '@/shared/grid/configuration/configurableTable.types';

export const TRANSACTIONS_CONFIGURABLE_TABLE_KEY = 'transactions.configurable-ssrm';

/**
 * Local JSON-safe metadata for the isolated experiment. It intentionally describes table/business
 * composition only; the route chooses SSRM and owns its native loading/selection lifecycle.
 */
export const transactionsConfigurableTableDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: TRANSACTIONS_CONFIGURABLE_TABLE_KEY,
  rowIdField: 'id',
  dataSourceKey: 'transactions',
  columns: [
    {
      id: 'reference',
      field: 'reference',
      semanticKey: 'reference',
      header: 'Reference',
      dataType: 'text',
      layout: { minWidth: 150 },
      sort: { enabled: true },
      filter: { type: 'text' },
    },
    {
      id: 'interaction',
      field: 'interactionMode',
      semanticKey: 'interaction',
      header: 'Access',
      dataType: 'text',
      layout: { minWidth: 135, maxWidth: 155 },
      sort: { enabled: false },
      renderer: { key: 'transactionAccess' },
    },
    {
      id: 'account',
      field: 'account',
      semanticKey: 'account',
      header: 'Account',
      dataType: 'text',
      layout: { minWidth: 150 },
      sort: { enabled: true },
      filter: { type: 'text' },
    },
    {
      id: 'amount',
      field: 'amount',
      semanticKey: 'amount',
      header: 'Amount',
      dataType: 'number',
      layout: { minWidth: 140 },
      sort: { enabled: true },
      filter: { type: 'number' },
      formatter: {
        key: 'transactionCurrency',
        params: { currencyField: 'currency' },
      },
    },
    {
      id: 'currency',
      field: 'currency',
      semanticKey: 'currency',
      header: 'Currency',
      dataType: 'text',
      layout: { maxWidth: 120 },
      sort: { enabled: true },
      filter: { type: 'text' },
    },
    {
      id: 'status',
      field: 'status',
      semanticKey: 'status',
      header: 'Status',
      dataType: 'text',
      layout: { minWidth: 130 },
      sort: { enabled: true },
      filter: { type: 'text' },
      renderer: { key: 'transactionStatus' },
    },
    {
      id: 'transactionDate',
      field: 'transactionDate',
      semanticKey: 'transactionDate',
      header: 'Transaction date',
      dataType: 'date',
      layout: { minWidth: 180 },
      sort: { enabled: true },
      filter: { type: 'date' },
      formatter: { key: 'transactionDate' },
    },
  ],
} satisfies ConfigurableTableDefinition;
