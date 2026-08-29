// GRIDCAP-CONFIGURABLE-TABLE
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import type { ConfigurableTableRegistries } from '@/shared/grid/configuration/compileConfigurableTable';
import { ConfigurableTableDefinitionError } from '@/shared/grid/configuration/configurableTable.validation';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionInteractionCell } from '../grid/TransactionInteractionCell';
import { TransactionStatusCell } from '../grid/TransactionStatusCell';
import { mapTransactionGridRequest } from '../grid/transactionRequest.mapper';

export const transactionsConfigurableTableRegistries: ConfigurableTableRegistries<Transaction> = {
  renderers: {
    transactionAccess: TransactionInteractionCell,
    transactionStatus: TransactionStatusCell,
  },
  formatters: {
    transactionCurrency: (params, metadataParams) => {
      if (typeof params.value !== 'number') return '';

      const configuredCurrencyField = metadataParams?.currencyField;
      const currencyValue =
        typeof configuredCurrencyField === 'string' && params.data
          ? params.data[configuredCurrencyField as keyof Transaction]
          : params.data?.currency;

      return formatCurrency(params.value, typeof currencyValue === 'string' ? currencyValue : 'USD');
    },
    transactionDate: ({ value }) => (typeof value === 'string' ? formatDate(value) : ''),
  },
};

const transactionRowsLoader: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

const dataSourceRegistry: Readonly<Record<string, GridRowsLoader<Transaction>>> = {
  transactions: transactionRowsLoader,
};

/** Metadata selects only an allowlisted business data source; SSRM itself is chosen by the route. */
export function resolveTransactionConfigurableRowsLoader(dataSourceKey: string) {
  const loader = dataSourceRegistry[dataSourceKey];
  if (!loader) {
    throw new ConfigurableTableDefinitionError(
      `Unknown Transaction configurable data source key "${dataSourceKey}"`,
    );
  }
  return loader;
}
