// GRIDCAP-CONFIGURABLE-TABLE
import type {
  ConfigurableTableColumnDefinition,
  ConfigurableTableDefinition,
  ConfigurableTableFilterType,
  ConfigurableTableRegistryReference,
} from './configurableTable.types';

export class ConfigurableTableDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurableTableDefinitionError';
  }
}

function fail(path: string, message: string): never {
  throw new ConfigurableTableDefinitionError(`${path}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertJsonSafe(value: unknown, path: string): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return;
  }

  if (isRecord(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      assertJsonSafe(nestedValue, `${path}.${key}`);
    }
    return;
  }

  fail(path, 'configuration must contain JSON-safe values only');
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${path}.${key}`, 'must be a non-empty string');
  }
  return value;
}

function readOptionalPositiveNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail(`${path}.${key}`, 'must be a positive finite number when provided');
  }
  return value;
}

function parseRegistryReference(
  value: unknown,
  path: string,
): ConfigurableTableRegistryReference | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) fail(path, 'must be an object');

  const key = readRequiredString(value, 'key', path);
  const params = value.params;
  if (params !== undefined && !isRecord(params)) fail(`${path}.params`, 'must be a JSON object');

  return {
    key,
    ...(params === undefined
      ? {}
      : { params: params as ConfigurableTableRegistryReference['params'] }),
  };
}

const DATA_TYPES = new Set(['text', 'number', 'date']);
const FILTER_TYPES = new Set<ConfigurableTableFilterType>(['text', 'number', 'date']);

function parseColumn(value: unknown, index: number): ConfigurableTableColumnDefinition {
  const path = `definition.columns[${index}]`;
  if (!isRecord(value)) fail(path, 'must be an object');

  const id = readRequiredString(value, 'id', path);
  const field = readRequiredString(value, 'field', path);
  const header = readRequiredString(value, 'header', path);
  const dataType = value.dataType;
  if (typeof dataType !== 'string' || !DATA_TYPES.has(dataType)) {
    fail(`${path}.dataType`, 'must be one of text, number or date');
  }

  const semanticKey = value.semanticKey;
  if (semanticKey !== undefined && (typeof semanticKey !== 'string' || semanticKey.length === 0)) {
    fail(`${path}.semanticKey`, 'must be a non-empty string when provided');
  }

  let layout: ConfigurableTableColumnDefinition['layout'];
  if (value.layout !== undefined) {
    if (!isRecord(value.layout)) fail(`${path}.layout`, 'must be an object');
    layout = {
      width: readOptionalPositiveNumber(value.layout, 'width', `${path}.layout`),
      minWidth: readOptionalPositiveNumber(value.layout, 'minWidth', `${path}.layout`),
      maxWidth: readOptionalPositiveNumber(value.layout, 'maxWidth', `${path}.layout`),
    };
  }

  let sort: ConfigurableTableColumnDefinition['sort'];
  if (value.sort !== undefined) {
    if (!isRecord(value.sort) || typeof value.sort.enabled !== 'boolean') {
      fail(`${path}.sort.enabled`, 'must be a boolean');
    }
    sort = { enabled: value.sort.enabled };
  }

  let filter: ConfigurableTableColumnDefinition['filter'];
  if (value.filter !== undefined) {
    if (!isRecord(value.filter) || typeof value.filter.type !== 'string') {
      fail(`${path}.filter.type`, 'must be a supported filter type');
    }
    if (!FILTER_TYPES.has(value.filter.type as ConfigurableTableFilterType)) {
      fail(`${path}.filter.type`, 'must be one of text, number or date');
    }
    filter = { type: value.filter.type as ConfigurableTableFilterType };
  }

  let editing: ConfigurableTableColumnDefinition['editing'];
  if (value.editing !== undefined) {
    if (!isRecord(value.editing) || typeof value.editing.supported !== 'boolean') {
      fail(`${path}.editing.supported`, 'must be a boolean');
    }
    editing = {
      supported: value.editing.supported,
      editor: parseRegistryReference(value.editing.editor, `${path}.editing.editor`),
    };
  }

  return {
    id,
    field,
    header,
    dataType: dataType as ConfigurableTableColumnDefinition['dataType'],
    ...(semanticKey === undefined ? {} : { semanticKey }),
    ...(layout === undefined ? {} : { layout }),
    ...(sort === undefined ? {} : { sort }),
    ...(filter === undefined ? {} : { filter }),
    ...(value.renderer === undefined
      ? {}
      : { renderer: parseRegistryReference(value.renderer, `${path}.renderer`) }),
    ...(value.formatter === undefined
      ? {}
      : { formatter: parseRegistryReference(value.formatter, `${path}.formatter`) }),
    ...(editing === undefined ? {} : { editing }),
  };
}

/**
 * Runtime validation is required even for today's local provider because the same boundary is intended
 * to accept backend JSON later. Unknown schema versions fail before metadata reaches AG Grid.
 */
export function parseConfigurableTableDefinition(value: unknown): ConfigurableTableDefinition {
  assertJsonSafe(value, 'definition');
  if (!isRecord(value)) fail('definition', 'must be an object');

  if (value.schemaVersion !== 1) {
    fail('definition.schemaVersion', `unsupported schema version ${String(value.schemaVersion)}`);
  }

  if (
    typeof value.definitionVersion !== 'number' ||
    !Number.isInteger(value.definitionVersion) ||
    value.definitionVersion < 1
  ) {
    fail('definition.definitionVersion', 'must be a positive integer');
  }

  const id = readRequiredString(value, 'id', 'definition');
  const rowIdField = readRequiredString(value, 'rowIdField', 'definition');
  const dataSourceKey = readRequiredString(value, 'dataSourceKey', 'definition');

  if (!Array.isArray(value.columns) || value.columns.length === 0) {
    fail('definition.columns', 'must contain at least one column');
  }

  const columns = value.columns.map(parseColumn);
  const ids = new Set<string>();
  for (const column of columns) {
    if (ids.has(column.id)) fail(`definition.columns.${column.id}`, 'column id must be unique');
    ids.add(column.id);
  }

  return {
    schemaVersion: 1,
    definitionVersion: value.definitionVersion,
    id,
    rowIdField,
    dataSourceKey,
    columns,
  };
}
