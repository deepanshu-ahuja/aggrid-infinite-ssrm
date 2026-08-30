import type { ColDef } from 'ag-grid-community';

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
 * Built-in AG Grid cell-data-type names supported by configurable fields.
 *
 * The public property is intentionally named `cellDataType`, matching AG Grid `ColDef.cellDataType`.
 * The configurable SSRM compiler sets it explicitly because AG Grid data-type inference only runs
 * with the Client-Side Row Model. AG Grid's native type-specific parser, formatter, editor, renderer
 * and filter behavior is therefore the baseline before any configured override is applied.
 *
 * `date` / `dateTime` represent JavaScript `Date` values. `dateString` / `dateTimeString` represent
 * values kept as strings, which is the normal representation for dates arriving from JSON APIs.
 */
export type FieldCellDataType = Extract<
  NonNullable<ColDef['cellDataType']>,
  'text' | 'number' | 'boolean' | 'date' | 'dateString' | 'dateTime' | 'dateTimeString'
>;

/** Base text-filter options supported by the shared server-query vocabulary. */
export type TextFilterOption =
  | 'contains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith';

/** Base number-filter options supported by the shared server-query vocabulary. */
export type NumberFilterOption =
  | 'equals'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

/** Base date/date-time filter options supported by the shared server-query vocabulary. */
export type DateFilterOption = 'equals' | 'notEqual' | 'lessThan' | 'greaterThan';

/** Base boolean filter options supported by the shared server-query vocabulary. */
export type BooleanFilterOption = 'equals' | 'notEqual';

/** Union of the shared filter options available before feature-specific extensions. */
export type FilterOption =
  | TextFilterOption
  | NumberFilterOption
  | DateFilterOption
  | BooleanFilterOption;

/** Resolves the shared filter-option vocabulary appropriate for an AG Grid cell data type. */
export type FilterOptionForCellDataType<TCellDataType extends FieldCellDataType> =
  TCellDataType extends 'text'
    ? TextFilterOption
    : TCellDataType extends 'number'
      ? NumberFilterOption
      : TCellDataType extends 'boolean'
        ? BooleanFilterOption
        : TCellDataType extends 'date' | 'dateString' | 'dateTime' | 'dateTimeString'
          ? DateFilterOption
          : never;

/** Filtering capability for one field. */
export interface FieldFilterDefinition<TFilterOption extends string = FilterOption> {
  /**
   * Complete non-empty list of AG Grid Simple Filter choices exposed for this field.
   *
   * The name intentionally matches AG Grid `filterParams.filterOptions`. The configurable compiler
   * combines this field-level list with the resolved shared/entity filter defaults rather than
   * inventing a second operator vocabulary.
   */
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}

/** Initial pin position available to a configurable field, derived from AG Grid `ColDef`. */
export type FieldPinnedPosition = Extract<
  NonNullable<ColDef['initialPinned']>,
  'left' | 'right'
>;

/** Sizing constraints that continue to apply after column creation. */
export interface FieldSizingConstraintsDefinition {
  /** Minimum width in pixels; same semantics/type as AG Grid `ColDef.minWidth`. */
  minWidth?: ColDef['minWidth'];
  /** Maximum width in pixels; same semantics/type as AG Grid `ColDef.maxWidth`. */
  maxWidth?: ColDef['maxWidth'];
  /** Whether the user can manually resize; same semantics/type as AG Grid `ColDef.resizable`. */
  resizable?: ColDef['resizable'];
}

/**
 * Initial field sizing plus continuing constraints.
 *
 * A field can declare an initial fixed width or an initial flex weight, never both. Runtime JSON
 * validation must enforce the same rule expressed by this TypeScript union.
 */
export type FieldSizingDefinition =
  | (FieldSizingConstraintsDefinition & {
      /** Same semantics/type as AG Grid `ColDef.initialWidth`. */
      initialWidth?: ColDef['initialWidth'];
      initialFlex?: never;
    })
  | (FieldSizingConstraintsDefinition & {
      initialWidth?: never;
      /** Same semantics/type as AG Grid `ColDef.initialFlex`. */
      initialFlex?: ColDef['initialFlex'];
    });

/** Initial layout configuration for one field. */
export interface FieldLayoutDefinition {
  /** Whether the column starts hidden; same semantics/type as AG Grid `ColDef.initialHide`. */
  initialHide?: ColDef['initialHide'];
  /** Initial pinned side; same semantics/type as AG Grid `ColDef.initialPinned`. */
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
  /** Default sortable setting; same semantics/type as AG Grid `ColDef.sortable`. */
  sortable?: ColDef['sortable'];
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
   * AG Grid already supplies normal `ValueFormatterParams` when it invokes `valueFormatter`. These
   * values are additional declarative inputs interpreted by the registered formatter; the compiler
   * combines them with the AG Grid callback params. AG Grid has no `valueFormatterParams` ColDef
   * property analogous to `cellRendererParams`.
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
   * `node`, `column`, `colDef` and `api`. Configuration should not duplicate those runtime values.
   */
  params?: ConfigurationJsonObject;
}

/** Popup position supported by AG Grid cell editors, derived from `ColDef`. */
export type FieldEditorPopupPosition = NonNullable<ColDef['cellEditorPopupPosition']>;

interface FieldEditorBaseDefinition<TEditorKey extends string> {
  /** Stable key of the registered frontend editor implementation. */
  key: TEditorKey;
  /**
   * Extra JSON-safe props for the registered editor, compiled to AG Grid `cellEditorParams`.
   *
   * AG Grid still supplies normal editor props (`value`, row/column information, `onValueChange`,
   * `stopEditing`, `parseValue`, `formatValue`, etc.).
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

/** Registered parser overriding the value parser provided by the field's AG Grid cell data type. */
export interface FieldValueParserDefinition<TParserKey extends string = string> {
  /** Stable parser registry key. */
  key: TParserKey;
  /**
   * Extra JSON-safe configuration for the registered parser.
   *
   * AG Grid invokes `valueParser` with normal `ValueParserParams`; the compiler combines those
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
 * Native AG Grid concepts deliberately keep AG Grid names and compatible types where the semantics
 * are the same. Executable formatting/rendering/editing/parsing behavior stays frontend-owned behind
 * registries; persisted/backend configuration carries only keys and JSON-safe parameters.
 */
export interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TCellDataType extends FieldCellDataType = FieldCellDataType,
  TAdditionalFilterOption extends string = never,
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
   * AG Grid cell data type/representation, passed to `ColDef.cellDataType`.
   *
   * The configurable SSRM compiler sets this explicitly. Native type behavior is the baseline: do
   * not require formatter, renderer, editor or parser registry entries when AG Grid already provides
   * the required behavior.
   */
  cellDataType: TCellDataType;

  /** Whether users can sort; omitted values inherit the resolved AG Grid `defaultColDef`. */
  sortable?: ColDef['sortable'];

  /** Omit when not filterable; when present, `filterOptions` are the exact allowed choices. */
  filter?: FieldFilterDefinition<
    FilterOptionForCellDataType<TCellDataType> | TAdditionalFilterOption
  >;

  /** Optional initial layout/sizing; supplied values override corresponding default column values. */
  layout?: FieldLayoutDefinition;

  /** Optional custom display formatter compiled to AG Grid `valueFormatter`. */
  formatter?: FieldFormatterDefinition<TFormatterKey>;

  /** Optional custom rich cell renderer compiled to AG Grid `cellRenderer`. */
  renderer?: FieldRendererDefinition<TRendererKey>;

  /**
   * Optional editing capability. Omit to make this field non-editable; presence makes it potentially
   * editable, but the compiled AG Grid `editable` callback still composes row/access/conflict policy.
   */
  editing?: TEditingDefinition;
}

type ConfigurableFieldDefinition<TTranslationKey extends string = string> = FieldDefinition<
  string,
  string,
  TTranslationKey,
  FieldCellDataType,
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
