/**
 * Reusable configuration root for one configurable business feature.
 *
 * Feature implementations provide their concrete keys and entity definitions while
 * sharing the same configuration shape.
 */
export interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  /** Stable programmatic identifier for this feature definition. @example "review" */
  featureKey: TFeatureKey;

  /** Entity definitions keyed by their stable entity identifier. */
  entities: Record<TEntityKey, EntityDefinition>;
}

/** JSON-safe primitive allowed in declarative configuration parameters. */
export type ConfigurationJsonPrimitive = string | number | boolean | null;

/** JSON-safe value allowed in declarative configuration parameters. */
export type ConfigurationJsonValue =
  | ConfigurationJsonPrimitive
  | readonly ConfigurationJsonValue[]
  | { readonly [key: string]: ConfigurationJsonValue };

/** JSON-safe object passed to registered configurable behaviors. */
export interface ConfigurationJsonObject {
  readonly [key: string]: ConfigurationJsonValue;
}

/** Semantic value categories understood by configurable field definitions. */
export type FieldDataType = 'text' | 'number' | 'boolean' | 'date' | 'dateTime';

/** Base text-filter operators supported by the shared configurable filter vocabulary. */
export type TextFilterOperator =
  | 'contains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith';

/** Base number-filter operators supported by the shared configurable filter vocabulary. */
export type NumberFilterOperator =
  | 'equals'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

/** Base date/date-time filter operators supported by the shared configurable filter vocabulary. */
export type DateFilterOperator = 'equals' | 'notEqual' | 'lessThan' | 'greaterThan';

/** Base boolean filter operators supported by the shared configurable filter vocabulary. */
export type BooleanFilterOperator = 'equals' | 'notEqual';

/** Union of the shared filter operators available before feature-specific extensions. */
export type FilterOperator =
  | TextFilterOperator
  | NumberFilterOperator
  | DateFilterOperator
  | BooleanFilterOperator;

/** Resolves the shared filter-operator vocabulary appropriate for a semantic field type. */
export type FilterOperatorForDataType<TDataType extends FieldDataType> =
  TDataType extends 'text'
    ? TextFilterOperator
    : TDataType extends 'number'
      ? NumberFilterOperator
      : TDataType extends 'boolean'
        ? BooleanFilterOperator
        : TDataType extends 'date' | 'dateTime'
          ? DateFilterOperator
          : never;

/**
 * Filter configuration for one field.
 *
 * Supplying this object makes filtering available for the field and the operator list is the
 * complete set of choices exposed for that field. The list must contain at least one operator.
 */
export interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  /** Operators the user is allowed to apply to this field. */
  operators: readonly [TOperator, ...TOperator[]];
}

/** Initial pin position available to a configurable field. */
export type FieldPinnedPosition = 'left' | 'right';

/**
 * Sizing constraints that continue to apply after the column is created.
 *
 * These map to normal AG Grid column constraints rather than user-state defaults.
 */
export interface FieldSizingConstraintsDefinition {
  /** Minimum column width in pixels; omitted values inherit the resolved default column setting. */
  minWidth?: number;

  /** Maximum column width in pixels. Omit when no field-specific maximum is required. */
  maxWidth?: number;

  /** Whether the user can manually resize the column; omitted values inherit the default. */
  resizable?: boolean;
}

/**
 * Initial sizing for one field plus constraints that continue to apply afterwards.
 *
 * A field can start with either a fixed width or a flex weight, never both. Backend JSON must
 * enforce the same rule during runtime configuration validation.
 */
export type FieldSizingDefinition =
  | (FieldSizingConstraintsDefinition & {
      /** Initial fixed width in pixels; compiled to AG Grid `initialWidth`. */
      initialWidth?: number;
      initialFlex?: never;
    })
  | (FieldSizingConstraintsDefinition & {
      initialWidth?: never;
      /** Initial flex weight; compiled to AG Grid `initialFlex`. */
      initialFlex?: number;
    });

/**
 * Initial layout configuration for one field.
 *
 * Initial values seed AG Grid column state. They do not keep forcing the value after Grid State or
 * user interaction changes the column.
 */
export interface FieldLayoutDefinition {
  /** Whether the column is visible when first created; compiled to the inverse of `initialHide`. */
  initialVisible?: boolean;

  /** Side on which the column is pinned when first created; compiled to `initialPinned`. */
  initialPinned?: FieldPinnedPosition;

  /** Optional initial sizing and persistent width/resizing constraints. */
  sizing?: FieldSizingDefinition;
}

/**
 * Configurable defaults applied to every field in one entity before individual field definitions.
 *
 * The compiler adds these values to the shared AG Grid `baseDefaultColDef` and passes the result as
 * AG Grid `defaultColDef`. Individual compiled columns rely on AG Grid's normal precedence: a
 * column value overrides the corresponding default-column value.
 */
export interface FieldDefaultsDefinition {
  /** Default sortable setting inherited by fields that do not specify `sortable`. */
  sortable?: boolean;

  /** Default layout/sizing settings inherited by fields that do not override them. */
  layout?: FieldLayoutDefinition;
}

/**
 * Selects a registered frontend value formatter for one field.
 *
 * Configuration carries only a stable registry key and optional JSON-safe parameters. The compiler
 * resolves executable formatting behavior on the frontend and maps it to AG Grid `valueFormatter`.
 */
export interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  /** Stable key of the registered formatter implementation. @example "currency" */
  key: TFormatterKey;

  /** Optional declarative parameters interpreted and validated by the registered formatter. */
  params?: ConfigurationJsonObject;
}

/**
 * Selects a registered frontend cell renderer for one field.
 *
 * Configuration never carries React components/functions. The compiler resolves the key to a
 * frontend renderer and maps optional JSON-safe parameters into its AG Grid renderer parameters.
 */
export interface FieldRendererDefinition<TRendererKey extends string = string> {
  /** Stable key of the registered renderer implementation. @example "statusChip" */
  key: TRendererKey;

  /** Optional declarative parameters interpreted and validated by the registered renderer. */
  params?: ConfigurationJsonObject;
}

/**
 * Reusable configuration for one field/column exposed by an entity.
 *
 * Formatter and renderer keys remain declarative identities. Backend JSON is runtime data and must
 * be validated against the allowed registries before compilation.
 */
export interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TDataType extends FieldDataType = FieldDataType,
  TAdditionalFilterOperator extends string = never,
  TFormatterKey extends string = string,
  TRendererKey extends string = string,
> {
  /** Stable configuration identity independent of the API row path. @example "loanAmount" */
  id: TFieldId;

  /** API row path containing the field value. Dot notation supports nested response shapes. */
  field: TFieldPath;

  /** Full translation key used to resolve the field/column label. */
  labelKey: TTranslationKey;

  /** Semantic type of the field value. */
  dataType: TDataType;

  /**
   * Whether users can sort by this field. Omitted values inherit the resolved `defaultColDef`.
   */
  sortable?: boolean;

  /**
   * Filtering configuration. Omit when the field is not filterable; when present, the operator
   * list is the exact set of filter choices allowed for the field.
   */
  filter?: FieldFilterDefinition<
    FilterOperatorForDataType<TDataType> | TAdditionalFilterOperator
  >;

  /** Optional initial layout and sizing; supplied values override corresponding defaults. */
  layout?: FieldLayoutDefinition;

  /**
   * Optional registered display formatter.
   *
   * Formatting does not change the raw row value or business save/filter/sort meaning. The runtime
   * must separately preserve any intended clipboard/export behavior because AG Grid can use
   * `valueFormatter` for those surfaces.
   */
  formatter?: FieldFormatterDefinition<TFormatterKey>;

  /**
   * Optional registered rich cell renderer.
   *
   * Omit to use normal AG Grid cell rendering. A renderer may coexist with a formatter and can use
   * both the raw value and AG Grid's formatted value.
   */
  renderer?: FieldRendererDefinition<TRendererKey>;
}

type ConfigurableFieldDefinition<TTranslationKey extends string = string> = FieldDefinition<
  string,
  string,
  TTranslationKey,
  FieldDataType,
  string,
  string,
  string
>;

/** Reusable configuration for one entity/data context inside a configurable feature. */
export interface EntityDefinition<
  TTranslationKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TTranslationKey> = ConfigurableFieldDefinition<TTranslationKey>,
> {
  /** Full translation key used to resolve the entity label. */
  labelKey: TTranslationKey;

  /**
   * Key of the registered frontend data adapter used for loading/saving and API/grid mapping.
   */
  dataAdapterKey: string;

  /** Defines how the stable unique business-row identifier is read from every API row. */
  rowId: RowIdDefinition;

  /**
   * Optional configurable defaults compiled into AG Grid `defaultColDef` on top of shared defaults.
   */
  fieldDefaults?: FieldDefaultsDefinition;

  /** Fields available for the entity in their configured initial column order. */
  fields: readonly TFieldDefinition[];
}

/** Defines how to locate an entity row's stable unique identifier in the API row shape. */
export interface RowIdDefinition {
  /** Field path containing the stable business-row identifier; dot notation is supported. */
  path: string;
}
