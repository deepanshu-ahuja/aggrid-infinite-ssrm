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
  /** Optional JSON-safe parameters interpreted and validated by the registered formatter. */
  params?: ConfigurationJsonObject;
}

/** Registered frontend cell renderer selected by declarative configuration. */
export interface FieldRendererDefinition<TRendererKey extends string = string> {
  /** Stable renderer registry key. @example "statusChip" */
  key: TRendererKey;
  /** Optional JSON-safe parameters interpreted and validated by the registered renderer. */
  params?: ConfigurationJsonObject;
}

/** Popup position supported by AG Grid cell editors. */
export type FieldEditorPopupPosition = 'over' | 'under';

interface FieldEditorBaseDefinition<TEditorKey extends string> {
  /** Stable key of the registered frontend editor implementation. */
  key: TEditorKey;
  /** Optional JSON-safe parameters interpreted and validated by the registered editor. */
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
 * Registered parser for converting an editor/import candidate into the local draft value.
 *
 * The compiler resolves the key to frontend executable behavior and maps it to AG Grid
 * `valueParser`. It is not the save-payload mapper.
 */
export interface FieldValueParserDefinition<TParserKey extends string = string> {
  /** Stable parser registry key. */
  key: TParserKey;
  /** Optional JSON-safe parameters interpreted and validated by the registered parser. */
  params?: ConfigurationJsonObject;
}

/**
 * Editing capability for one field.
 *
 * Presence means the field is eligible for editing; it does not force `editable=true` for every
 * row. Runtime editability must also satisfy current access/authorization, feature row policy and
 * tracked-editing conflict rules.
 *
 * When `editor` is omitted, the compiler may use AG Grid's editor selected from the semantic data
 * type. When `parser` is omitted, the editor-produced value becomes the local draft unchanged.
 */
export interface FieldEditingDefinition<
  TEditorKey extends string = string,
  TParserKey extends string = string,
> {
  /** Optional registered custom editor. */
  editor?: FieldEditorDefinition<TEditorKey>;
  /** Optional registered conversion from editor/import candidate to local draft value. */
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
  /** Semantic type of the field value. */
  dataType: TDataType;

  /** Whether users can sort; omitted values inherit the resolved AG Grid `defaultColDef`. */
  sortable?: boolean;

  /** Omit when not filterable; when present, operators are the exact allowed filter choices. */
  filter?: FieldFilterDefinition<
    FilterOperatorForDataType<TDataType> | TAdditionalFilterOperator
  >;

  /** Optional initial layout/sizing; supplied values override corresponding default column values. */
  layout?: FieldLayoutDefinition;

  /** Optional registered display formatter compiled to AG Grid `valueFormatter`. */
  formatter?: FieldFormatterDefinition<TFormatterKey>;

  /** Optional registered rich cell renderer compiled to AG Grid `cellRenderer`. */
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
