/** Reusable configuration root for one configurable business feature. */
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

/**
 * AG Grid-compatible semantic/value representations supported by configurable fields.
 *
 * The compiler sets the matching AG Grid `ColDef.cellDataType` explicitly. This is required for the
 * configurable SSRM proof because AG Grid data-type inference only runs with the Client-Side Row
 * Model. Keeping this mapping explicit also lets AG Grid provide its native type-specific parser,
 * formatter, editor, renderer and filter behavior before any field-level override is added.
 *
 * `date` / `dateTime` represent JavaScript `Date` values. `dateString` / `dateTimeString` represent
 * date values kept as strings (the normal shape for dates arriving directly from JSON APIs).
 */
export type FieldDataType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'dateString'
  | 'dateTime'
  | 'dateTimeString';

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
        : TDataType extends 'date' | 'dateString' | 'dateTime' | 'dateTimeString'
          ? DateFilterOperator
          : never;

/** Filtering capability for one field. */
export interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  /** Complete non-empty list of operators the user may apply to this field. */
  operators: readonly [TOperator, ...TOperator[]];
}

/** Initial pin position available to a configurable field. */
export type FieldPinnedPosition = 'left' | 'right';

/** Sizing constraints that continue to apply after column creation. */
export interface FieldSizingConstraintsDefinition {
  /** Minimum width in pixels; omitted values inherit the resolved default column setting. */
  minWidth?: number;
  /** Maximum width in pixels. */
  maxWidth?: number;
  /** Whether the user can manually resize the column; omitted values inherit the default. */
  resizable?: boolean;
}

/**
 * Initial field sizing plus continuing constraints.
 *
 * A field can declare an initial fixed width or an initial flex weight, never both. Runtime JSON
 * validation must enforce the same rule expressed by this TypeScript union.
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

/** Initial layout configuration for one field. */
export interface FieldLayoutDefinition {
  /** Whether the column is visible when first created; compiled to the inverse of `initialHide`. */
  initialVisible?: boolean;
  /** Side on which the column is pinned when first created; compiled to `initialPinned`. */
  initialPinned?: FieldPinnedPosition;
  /** Optional initial sizing and persistent size constraints. */
  sizing?: FieldSizingDefinition;
}

/**
 * Configurable defaults applied to every field in one entity.
 *
 * The compiler adds these values to shared `baseDefaultColDef` and supplies the result to AG Grid
 * `defaultColDef`. Individual compiled columns then use AG Grid's normal override precedence.
 */
export interface FieldDefaultsDefinition {
  /** Default sortable setting inherited by fields that do not specify `sortable`. */
  sortable?: boolean;
  /** Default layout/sizing settings inherited by fields that do not override them. */
  layout?: FieldLayoutDefinition;
}

/** Registered frontend value formatter selected by declarative configuration. */
export interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  /** Stable formatter registry key. @example "currency" */
  key: TFormatterKey;
  /**
   * Extra JSON-safe configuration for the registered formatter.
   *
   * AG Grid already supplies the normal `ValueFormatterParams` when it invokes `valueFormatter`.
   * These values are additional declarative inputs interpreted by our registered formatter; the
   * compiler combines them with the AG Grid callback params rather than mapping them to a native
   * `valueFormatterParams` property (AG Grid has no such column property).
   */
  params?: ConfigurationJsonObject;
}

/** Registered frontend cell renderer selected by declarative configuration. */
export interface FieldRendererDefinition<TRendererKey extends string = string> {
  /** Stable renderer registry key. @example "statusChip" */
  key: TRendererKey;
  /**
   * Extra JSON-safe props for the registered renderer, compiled to AG Grid `cellRendererParams`.
   *
   * AG Grid still supplies its normal renderer props such as `value`, `valueFormatted`, `data`,
   * `node`, `column`, `colDef` and `api`. Configuration should not duplicate those runtime values;
   * use these params only for additional declarative component configuration.
   */
  params?: ConfigurationJsonObject;
}

/** Popup position supported by AG Grid cell editors. */
export type FieldEditorPopupPosition = 'over' | 'under';

interface FieldEditorBaseDefinition<TEditorKey extends string> {
  /** Stable key of the registered frontend editor implementation. */
  key: TEditorKey;
  /**
   * Extra JSON-safe props for the registered editor, compiled to AG Grid `cellEditorParams`.
   *
   * AG Grid still supplies the normal editor props (`value`, row/column information,
   * `onValueChange`, `stopEditing`, `parseValue`, `formatValue`, etc.). These params configure the
   * provided/custom input beyond that standard runtime context.
   */
  params?: ConfigurationJsonObject;
}

/**
 * Registered editor configuration for one editable field.
 *
 * Popup position is valid only when popup editing is explicitly enabled. The union gives
 * frontend-authored config the same rule that runtime JSON validation must enforce.
 */
export type FieldEditorDefinition<TEditorKey extends string = string> =
  | (FieldEditorBaseDefinition<TEditorKey> & {
      popup?: false;
      popupPosition?: never;
    })
  | (FieldEditorBaseDefinition<TEditorKey> & {
      popup: true;
      /** Popup placement relative to the cell; AG Grid defaults to `over` when omitted. */
      popupPosition?: FieldEditorPopupPosition;
    });

/**
 * Registered parser overriding the value parser provided by the field's AG Grid cell data type.
 *
 * The compiler resolves the key to frontend executable behavior and maps the resulting callback to
 * AG Grid `valueParser`. It is not the save-payload mapper.
 */
export interface FieldValueParserDefinition<TParserKey extends string = string> {
  /** Stable parser registry key. */
  key: TParserKey;
  /**
   * Extra JSON-safe configuration for the registered parser.
   *
   * AG Grid invokes `valueParser` with its normal `ValueParserParams`; the compiler combines those
   * callback params with this declarative configuration. Custom React editors may also use AG Grid's
   * supplied `parseValue()` utility when they need to apply the column parser explicitly.
   */
  params?: ConfigurationJsonObject;
}

/**
 * Editing capability for one field.
 *
 * Presence means the field is eligible for editing; it does not force `editable=true` for every
 * row. Runtime editability must also satisfy current access/authorization, feature row policy and
 * tracked-editing conflict rules.
 *
 * When `editor` is omitted, AG Grid's editor selected by `cellDataType` remains available. When
 * `parser` is omitted, the compiler does not override `valueParser`, so the parser supplied by the
 * AG Grid cell data type (if any) remains in effect.
 */
export interface FieldEditingDefinition<
  TEditorKey extends string = string,
  TParserKey extends string = string,
> {
  /** Optional registered custom editor. */
  editor?: FieldEditorDefinition<TEditorKey>;
  /** Optional registered parser override. */
  parser?: FieldValueParserDefinition<TParserKey>;
}

/**
 * Reusable configuration for one field/column exposed by an entity.
 *
 * Executable formatting/rendering/editing/parsing behavior stays frontend-owned behind registries;
 * backend configuration carries only keys and JSON-safe parameters.
 */
export interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TDataType extends FieldDataType = FieldDataType,
  TAdditionalFilterOperator extends string = never,
  TFormatterKey extends string = string,
  TRendererKey extends string = string,
  TEditingDefinition extends FieldEditingDefinition = FieldEditingDefinition,
> {
  /** Stable configuration identity independent of the API row path. @example "loanAmount" */
  id: TFieldId;
  /** API row path containing the value. Dot notation supports nested response shapes. */
  field: TFieldPath;
  /** Full translation key used to resolve the field/column label. */
  labelKey: TTranslationKey;
  /**
   * Field value type/representation compiled directly to AG Grid `cellDataType`.
   *
   * The configurable SSRM compiler must set this explicitly because AG Grid data-type inference is
   * Client-Side Row Model only. Native type behavior is the baseline: do not require formatter,
   * renderer, editor or parser registry entries when the selected AG Grid cell data type already
   * provides the required behavior.
   */
  dataType: TDataType;

  /** Whether users can sort; omitted values inherit the resolved AG Grid `defaultColDef`. */
  sortable?: boolean;

  /** Omit when not filterable; when present, operators are the exact allowed filter choices. */
  filter?: FieldFilterDefinition<
    FilterOperatorForDataType<TDataType> | TAdditionalFilterOperator
  >;

  /** Optional initial layout/sizing; supplied values override corresponding default column values. */
  layout?: FieldLayoutDefinition;

  /**
   * Optional custom display formatter compiled to AG Grid `valueFormatter`.
   *
   * Omit when the formatter supplied by `cellDataType` is sufficient.
   */
  formatter?: FieldFormatterDefinition<TFormatterKey>;

  /**
   * Optional custom rich cell renderer compiled to AG Grid `cellRenderer`.
   *
   * Omit when normal AG Grid / `cellDataType` rendering is sufficient (for example the native
   * boolean cell type already provides checkbox rendering).
   */
  renderer?: FieldRendererDefinition<TRendererKey>;

  /**
   * Optional editing capability.
   *
   * Omit to make this field non-editable. Presence makes it potentially editable, but the compiled
   * AG Grid `editable` callback must still compose current row/access/conflict policy.
   */
  editing?: TEditingDefinition;
}

type ConfigurableFieldDefinition<TTranslationKey extends string = string> = FieldDefinition<
  string,
  string,
  TTranslationKey,
  FieldDataType,
  string,
  string,
  string,
  FieldEditingDefinition
>;

/** Reusable configuration for one entity/data context inside a configurable feature. */
export interface EntityDefinition<
  TTranslationKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TTranslationKey> = ConfigurableFieldDefinition<TTranslationKey>,
> {
  /** Full translation key used to resolve the entity label. */
  labelKey: TTranslationKey;
  /** Key of the frontend data adapter for loading/saving and API/grid mapping. */
  dataAdapterKey: string;
  /** Stable business-row identity definition. */
  rowId: RowIdDefinition;
  /** Optional configurable defaults compiled into AG Grid `defaultColDef`. */
  fieldDefaults?: FieldDefaultsDefinition;
  /** Fields available for the entity in their configured initial column order. */
  fields: readonly TFieldDefinition[];
}

/** Defines how to locate an entity row's stable unique identifier in the API row shape. */
export interface RowIdDefinition {
  /** Field path containing the stable business-row identifier; dot notation is supported. */
  path: string;
}
