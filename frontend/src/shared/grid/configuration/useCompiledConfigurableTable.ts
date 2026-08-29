// GRIDCAP-CONFIGURABLE-TABLE
import { useQuery } from '@tanstack/react-query';
import {
  compileConfigurableTable,
  type ConfigurableTableRegistries,
} from './compileConfigurableTable';
import type { ConfigurableTableDefinitionProvider } from './configurableTable.provider';
import { parseConfigurableTableDefinition } from './configurableTable.validation';

interface UseCompiledConfigurableTableOptions<TData> {
  definitionKey: string;
  provider: ConfigurableTableDefinitionProvider;
  registries: ConfigurableTableRegistries<TData>;
}

/** Provider -> runtime validation -> registry/compiler is one explicit boundary before AG Grid sees it. */
export function useCompiledConfigurableTable<TData>({
  definitionKey,
  provider,
  registries,
}: UseCompiledConfigurableTableOptions<TData>) {
  return useQuery({
    queryKey: ['configurable-table-definition', definitionKey],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const rawDefinition = await provider.loadDefinition(definitionKey, signal);
      const definition = parseConfigurableTableDefinition(rawDefinition);
      return compileConfigurableTable<TData>(definition, registries);
    },
  });
}
