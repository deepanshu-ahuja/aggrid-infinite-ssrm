// GRIDCAP-CONFIGURABLE-TABLE
import { createLocalConfigurableTableDefinitionProvider } from '@/shared/grid/configuration/configurableTable.provider';
import {
  TRANSACTIONS_CONFIGURABLE_TABLE_KEY,
  transactionsConfigurableTableDefinition,
} from './transactionsConfigurableTable.definition';

/**
 * The experiment starts local. Replacing this object with an API-backed provider must not change the
 * compiler or the SSRM composition root.
 */
export const transactionsConfigurableTableProvider =
  createLocalConfigurableTableDefinitionProvider({
    [TRANSACTIONS_CONFIGURABLE_TABLE_KEY]: transactionsConfigurableTableDefinition,
  });
