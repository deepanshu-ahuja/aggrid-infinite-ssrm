import type { GridOptions } from 'ag-grid-community';
import type {
  ConfigurationJsonObject,
  RegisteredValueFormatter,
  RegisteredValueParser,
} from './configuration.types';
import type { GridValidator } from '../validation/gridValidation';

/** Native component registry object accepted by AG Grid at runtime. */
export type ConfigurableGridComponents<TData> = NonNullable<GridOptions<TData>['components']>;

export type ConfigurableValueFormatterFactory<TData> = (
  config: ConfigurationJsonObject | undefined,
) => RegisteredValueFormatter<TData, unknown>;

export type ConfigurableValueParserFactory<TData> = (
  config: ConfigurationJsonObject | undefined,
) => RegisteredValueParser<TData, unknown>;

/**
 * Frontend-owned executable registries used by the configurable compiler.
 *
 * Persisted configuration carries only names/keys. Functions and React components enter the system
 * here, after runtime JSON has already been validated and normalized.
 */
export interface ConfigurableGridRegistries<TData> {
  /** Names the current frontend bundle permits in native `filter`. */
  filters: ReadonlySet<string>;
  /** Names the current frontend bundle permits in native `cellEditor`. */
  editors: ReadonlySet<string>;
  /** Names the current frontend bundle permits in native `cellRenderer`. */
  renderers: ReadonlySet<string>;
  /** Runtime AG Grid component registrations for custom named editors/renderers/filters. */
  components?: ConfigurableGridComponents<TData>;
  valueFormatters: Readonly<Record<string, ConfigurableValueFormatterFactory<TData>>>;
  valueParsers: Readonly<Record<string, ConfigurableValueParserFactory<TData>>>;
  validators: Readonly<Record<string, GridValidator<unknown>>>;
}

export function requireRegisteredKey<TValue>(
  registry: Readonly<Record<string, TValue>>,
  key: string,
  kind: string,
): TValue {
  const value = registry[key];
  if (value === undefined) {
    throw new Error(`Unknown configurable ${kind}: ${key}`);
  }
  return value;
}

export function requireAllowedComponentName(
  allowedNames: ReadonlySet<string>,
  name: string,
  kind: 'filter' | 'cell editor' | 'cell renderer',
) {
  if (!allowedNames.has(name)) {
    throw new Error(`Unsupported configurable ${kind}: ${name}`);
  }
}
