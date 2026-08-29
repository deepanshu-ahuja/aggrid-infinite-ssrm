// GRIDCAP-CONFIGURABLE-TABLE
import type { ConfigurableTableDefinition } from './configurableTable.types';
import { ConfigurableTableDefinitionError } from './configurableTable.validation';

/**
 * Replaceable metadata source. The local experiment uses in-memory JSON-safe definitions today; a
 * future API provider can implement the same asynchronous contract without changing the compiler.
 */
export interface ConfigurableTableDefinitionProvider {
  loadDefinition(definitionKey: string, signal: AbortSignal): Promise<unknown>;
}

export function createLocalConfigurableTableDefinitionProvider(
  definitions: Readonly<Record<string, ConfigurableTableDefinition>>,
): ConfigurableTableDefinitionProvider {
  return {
    async loadDefinition(definitionKey, signal) {
      if (signal.aborted) throw new DOMException('Configuration request aborted.', 'AbortError');
      const definition = definitions[definitionKey];
      if (!definition) {
        throw new ConfigurableTableDefinitionError(
          `Unknown local table definition key "${definitionKey}"`,
        );
      }
      return definition;
    },
  };
}
