// GRIDCAP-CONFIGURABLE-TABLE

/** JSON-safe values are the only values allowed to cross the configuration-provider boundary. */
export type ConfigurableTableJsonValue =
  | string
  | number
  | boolean
  | null
  | ConfigurableTableJsonValue[]
  | { [key: string]: ConfigurableTableJsonValue };

export type ConfigurableTableJsonObject = { [key: string]: ConfigurableTableJsonValue };

export type ConfigurableTableDataType = 'text' | 'number' | 'date';
export type ConfigurableTableFilterType = 'text' | 'number' | 'date';

/**
 * String keys select allowlisted frontend implementations; metadata never carries executable code.
 */
export interface ConfigurableTableRegistryReference {
  key: string;
  params?: ConfigurableTableJsonObject;
}

export interface ConfigurableTableColumnDefinition {
  /** Stable UI identity used for AG Grid colId / future Grid State reconciliation. */
  id: string;
  /** Explicit row-data binding. Never infer this from header text or arbitrary response keys. */
  field: string;
  /** Optional stable business/UI meaning. Presentation keys must not imply business behavior. */
  semanticKey?: string;
  header: string;
  dataType: ConfigurableTableDataType;
  layout?: {
    width?: number;
    minWidth?: number;
    maxWidth?: number;
  };
  sort?: {
    enabled: boolean;
  };
  filter?: {
    type: ConfigurableTableFilterType;
  };
  renderer?: ConfigurableTableRegistryReference;
  formatter?: ConfigurableTableRegistryReference;
  editing?: {
    supported: boolean;
    editor?: ConfigurableTableRegistryReference;
  };
}

/**
 * JSON-safe application metadata. Row-model choice intentionally does NOT live here: the frontend
 * composition route chooses Client / Infinite / SSRM and keeps the correct native lifecycle mechanics.
 */
export interface ConfigurableTableDefinition {
  schemaVersion: 1;
  definitionVersion: number;
  id: string;
  rowIdField: string;
  dataSourceKey: string;
  columns: ConfigurableTableColumnDefinition[];
}
