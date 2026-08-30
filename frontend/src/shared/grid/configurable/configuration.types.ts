import type { ColDef } from 'ag-grid-community';

/**
 * Reusable configuration root for one configurable business feature.
 *
 * The feature knows entity identities through the keys of `entities`; for example a feature could
 * use `"transaction" | "loan"` as `TEntityKey`. The generic entity type only constrains the shape
 * of each entity definition; it does not make this shared contract business-specific.
 *
 * @typeParam TFeatureKey Stable application feature key, such as `"review"`.
 * @typeParam TEntityKey Stable entity keys available inside the feature, such as `"transaction"`.
 * @typeParam TEntityDefinition Entity configuration shape stored at each `entities` key.
 */
export interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
  TEntityDefinition extends EntityDefinition = EntityDefinition,
> {
  /** Stable programmatic identifier for this feature definition. @example "review" */
  featureKey: TFeatureKey;

  /**
   * Entity definitions keyed by stable business/configuration identity.
   *
   * The record key is where an identity such as `"transaction"` or `"loan"` belongs. The reusable
   * `EntityDefinition` itself intentionally has no hard-coded knowledge of those business names.
   */
  entities: Record<TEntityKey, TEntityDefinition>;
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

/**
 * Server-supported filtering capability for one configurable field.
 *
 * This is deliberately named `filtering` at the field level rather than pretending this object is
 * AG Grid `ColDef.filter`. AG Grid's `filter` property selects/enables a filter component, while this
 * persisted descriptor declares the supported server-query options. The compiler turns a configured
 * `filtering` block into the corresponding `ColDef.filter` / `filterParams` values.
 */
export interface FieldFilteringDefinition<TFilterOption extends string = FilterOption> {
  /**
   * Complete non-empty list of AG Grid Simple Filter choices exposed for this field.
   *
   * The leaf name intentionally matches AG Grid `filterParams.filterOptions`. The compiler combines
   * this field-level list with resolved shared/entity filter defaults; the backend/data adapter must
   * support the same operators before they are exposed to users.
   */
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}

/** Initial pin position available to a configurable field, derived from AG Grid `ColDef`. */
export type FieldPinnedPosition = Extract<
  NonNullable<ColDef['initialPinned']>,
  'left' | 'right'
>;

/**
 * Bounded JSON-safe subset of AG Grid `defaultColDef` currently supported by the configurable model.
 *
 * The property using this type is named `defaultColDef` because the values have the same semantics as
 * AG Grid. The subset remains intentional: supporting the native name does not mean arbitrary `ColDef`
 * values, callbacks, components or runtime objects can be persisted and passed through unchecked.
 */
export interface ConfigurableDefaultColDef {
  /** Default sortable setting; same semantics/type as AG Grid `ColDef.sortable`. */
  sortable?: ColDef['sortable'];
  /** Initial hidden state for columns that do not override it; maps to `ColDef.initialHide`. */
  initialHide?: ColDef['initialHide'];
  /** Initial pinned side for columns that do not override it; maps to `ColDef.initialPinned`. */
  initialPinned?: FieldPinnedPosition;
  /** Initial width for columns that do not override it; maps to `ColDef.initialWidth`. */
  initialWidth?: ColDef['initialWidth'];
  /** Initial flex value for columns that do not override it; maps to `ColDef.initialFlex`. */
  initialFlex?: ColDef['initialFlex'];
  /** Continuing minimum-width constraint; maps to `ColDef.minWidth`. */
  minWidth?: ColDef['minWidth'];
  /** Continuing maximum-width constraint; maps to `ColDef.maxWidth`. */
  maxWidth?: ColDef['maxWidth'];
  /** Continuing resize permission; maps to `ColDef.resizable`. */
  resizable?: ColDef['resizable'];
}

/** Registered frontend value formatter selected by declarative configuration. */
export interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  /** Stable formatter registry key. @example "currency" */
  key: TFormatterKey;
  /**
   * Extra JSON-safe configuration for the registered formatter.
   *
   * This descriptor is not named `valueFormatter` because AG Grid's `ColDef.valueFormatter` expects
   * executable formatter behavior, while persisted configuration can only carry a safe registry key
   * and declarative data. AG Grid supplies normal `ValueFormatterParams` when the resolved formatter
   * is invoked; these values are additional application inputs interpreted by that implementation.
   */
  params?: ConfigurationJsonObject;
}

/** Registered frontend cell renderer selected by declarative configuration. */
export interface FieldRendererDefinition<TRendererKey extends string = string> {
  /** Stable renderer registry key resolved to a frontend-owned AG Grid-compatible renderer. */
  key: TRendererKey;
  /**
   * Extra JSON-safe props compiled to AG Grid `ColDef.cellRendererParams`.
   *
   * AG Grid still supplies normal renderer props such as `value`, `valueFormatted`, `data`, `node`,
   * `column`, `colDef` and `api`. Configuration should not duplicate those runtime values.
   */
  cellRendererParams?: ConfigurationJsonObject;
}

/** Popup position supported by AG Grid cell editors, derived from `ColDef`. */
export type FieldEditorPopupPosition = NonNullable<ColDef['cellEditorPopupPosition']>;

interface FieldEditorBaseDefinition<TEditorKey extends string> {
  /** Stable key resolved to a frontend-owned AG Grid-compatible cell editor. */
  key: TEditorKey;
  /**
   * Extra JSON-safe props compiled to AG Grid `ColDef.cellEditorParams`.
   *
   * AG Grid still supplies normal editor props (`value`, row/column information, `onValueChange`,
   * `stopEditing`, `parseValue`, `formatValue`, etc.).
   */
  cellEditorParams?: ConfigurationJsonObject;
}

/**
 * Registered editor configuration for one editable field.
 *
 * The descriptor uses AG Grid leaf names where the values have the same semantics. The `key` remains
 * application-specific because persisted JSON cannot contain the executable editor component itself.
 */
export type FieldEditorDefinition<TEditorKey extends string = string> =
  | (FieldEditorBaseDefinition<TEditorKey> & {
      /** Whether this registered editor opens as an AG Grid popup editor. */
      cellEditorPopup?: false;
      cellEditorPopupPosition?: never;
    })
  | (FieldEditorBaseDefinition<TEditorKey> & {
      /** Enables AG Grid popup editing for the registered editor. */
      cellEditorPopup: true;
      /** Placement relative to the cell; AG Grid defaults to `over` when omitted. */
      cellEditorPopupPosition?: FieldEditorPopupPosition;
    });

/** Registered parser overriding the value parser provided by the field's AG Grid cell data type. */
export interface FieldValueParserDefinition<TParserKey extends string = string> {
  /** Stable parser registry key resolved to an AG Grid-compatible `valueParser` implementation. */
  key: TParserKey;
  /**
   * Extra JSON-safe configuration for the registered parser.
   *
   * This remains application-specific because AG Grid has no `valueParserParams` ColDef property.
   * AG Grid invokes the resolved parser with normal `ValueParserParams`; custom React editors may also
   * use AG Grid's supplied `parseValue()` utility when they need to apply the column parser explicitly.
   */
  params?: ConfigurationJsonObject;
}

/**
 * Editing capability for one field.
 *
 * This is an application configuration concept rather than a replacement name for `ColDef.editable`.
 * Presence means the field is eligible for editing; the compiled `editable` callback must still satisfy
 * current access/authorization, feature row policy and tracked-editing conflict rules for each row.
 *
 * When `editor` is omitted, AG Grid's editor selected by `cellDataType` remains available. When
 * `parser` is omitted, the compiler does not override `valueParser`, so the parser supplied by the
 * AG Grid cell data type (if any) remains in effect.
 */
export interface FieldEditingDefinition<
  TEditorKey extends string = string,
  TParserKey extends string = string,
> {
  /** Optional registered custom editor configuration. */
  editor?: FieldEditorDefinition<TEditorKey>;
  /** Optional registered parser override. */
  parser?: FieldValueParserDefinition<TParserKey>;
}

/**
 * Reusable configuration for one field/column exposed by an entity.
 *
 * Native, JSON-safe AG Grid concepts deliberately use AG Grid property names and compatible types.
 * Application concepts keep distinct names when the persisted value has different semantics—for
 * example `filtering`, `formatter`, `renderer` and `editing` are descriptors that the compiler must
 * translate/resolve rather than values that can be spread directly into a `ColDef`.
 *
 * @typeParam TColId Stable AG Grid column/configuration identity type.
 * @typeParam TFieldPath Row/API value path bound to `ColDef.field`.
 * @typeParam TLabelKey Allowed translation-key type for the column label.
 * @typeParam TCellDataType Supported AG Grid cell data type for this field.
 * @typeParam TAdditionalFilterOption Feature-specific server filter options, if any.
 * @typeParam TFormatterKey Allowed formatter registry keys.
 * @typeParam TRendererKey Allowed renderer registry keys.
 * @typeParam TEditingDefinition Concrete editing descriptor type for this field family.
 */
export interface FieldDefinition<
  TColId extends NonNullable<ColDef['colId']> = NonNullable<ColDef['colId']>,
  TFieldPath extends string = string,
  TLabelKey extends string = string,
  TCellDataType extends FieldCellDataType = FieldCellDataType,
  TAdditionalFilterOption extends string = never,
  TFormatterKey extends string = string,
  TRendererKey extends string = string,
  TEditingDefinition extends FieldEditingDefinition = FieldEditingDefinition,
> {
  /**
   * Stable AG Grid column ID and application field-configuration identity.
   *
   * This maps directly to `ColDef.colId`. AG Grid uses Column ID to associate sorting, filtering,
   * column state and API operations with the same logical column. The configurable model requires an
   * explicit value so identity can remain stable even when the API `field` path later changes.
   *
   * @example "transactionDate"
   */
  colId: TColId;

  /**
   * API/row value path, passed to AG Grid `ColDef.field`; dot notation supports nested response shapes.
   * This is value binding, not stable column identity, so it may legitimately differ from `colId`.
   */
  field: TFieldPath;

  /**
   * Translation key resolved by the frontend into the final AG Grid header text.
   *
   * This intentionally does not use AG Grid's `headerName`: `headerName` is the final display string,
   * whereas this application value must first be translated before compilation.
   */
  labelKey: TLabelKey;

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

  /**
   * Optional server-supported filtering descriptor.
   *
   * When present, the compiler enables the appropriate AG Grid filter and supplies the configured
   * `filterOptions` through `filterParams`. Omission means this field is not exposed as filterable by
   * the configurable contract, regardless of broader shared defaults that the compiler starts from.
   */
  filtering?: FieldFilteringDefinition<
    FilterOptionForCellDataType<TCellDataType> | TAdditionalFilterOption
  >;

  /** Initial hidden state; same semantics/type as AG Grid `ColDef.initialHide`. */
  initialHide?: ColDef['initialHide'];
  /** Initial pinned side; same semantics/type as AG Grid `ColDef.initialPinned`. */
  initialPinned?: FieldPinnedPosition;
  /** Initial width in pixels; same semantics/type as AG Grid `ColDef.initialWidth`. */
  initialWidth?: ColDef['initialWidth'];
  /** Initial flex value; same semantics/type as AG Grid `ColDef.initialFlex`. */
  initialFlex?: ColDef['initialFlex'];
  /** Continuing minimum-width constraint; same semantics/type as AG Grid `ColDef.minWidth`. */
  minWidth?: ColDef['minWidth'];
  /** Continuing maximum-width constraint; same semantics/type as AG Grid `ColDef.maxWidth`. */
  maxWidth?: ColDef['maxWidth'];
  /** Continuing resize permission; same semantics/type as AG Grid `ColDef.resizable`. */
  resizable?: ColDef['resizable'];

  /** Optional custom display formatter descriptor resolved to AG Grid `ColDef.valueFormatter`. */
  formatter?: FieldFormatterDefinition<TFormatterKey>;

  /** Optional rich-renderer descriptor resolved to AG Grid `ColDef.cellRenderer`. */
  renderer?: FieldRendererDefinition<TRendererKey>;

  /**
   * Optional application editing capability. Omit to make the field non-editable; presence makes it
   * potentially editable, but the compiled AG Grid `editable` callback still composes row/access/
   * conflict policy rather than becoming unconditional `true`.
   */
  editing?: TEditingDefinition;
}

type ConfigurableFieldDefinition<TLabelKey extends string = string> = FieldDefinition<
  NonNullable<ColDef['colId']>,
  string,
  TLabelKey,
  FieldCellDataType,
  string,
  string,
  string,
  FieldEditingDefinition
>;

/**
 * Reusable configuration for one entity/data context inside a configurable feature.
 *
 * This shared interface does not know whether the entity is a Transaction, Loan, Finance, or another
 * business type. The entity's business identity is the key used in `FeatureDefinition.entities`.
 * These generic parameters only let a concrete feature narrow the allowed label keys and field shape.
 *
 * @typeParam TLabelKey Translation keys allowed by this entity definition.
 * @typeParam TFieldDefinition Concrete configurable field shape allowed in this entity's `fields` list.
 */
export interface EntityDefinition<
  TLabelKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TLabelKey> = ConfigurableFieldDefinition<TLabelKey>,
> {
  /** Full translation key resolved into the entity's display label. */
  labelKey: TLabelKey;

  /**
   * Key of the frontend data adapter used for this entity's data/API boundary.
   *
   * The resolved adapter owns entity-specific loading/saving and request/response mapping. It may also
   * participate in backend-wire/config normalization when storage names or shapes differ from the
   * normalized frontend model. This is application infrastructure, not an AG Grid property.
   */
  dataAdapterKey: string;

  /** Stable business-row identity definition used to build the runtime AG Grid `getRowId` behavior. */
  rowId: RowIdDefinition;

  /**
   * Supported entity-wide column defaults, supplied to AG Grid as part of `defaultColDef`.
   *
   * The name deliberately matches AG Grid because the normalized values have the same semantics. The
   * compiler first combines these values with application `baseDefaultColDef`, then individual field
   * definitions use AG Grid's normal per-column override precedence.
   */
  defaultColDef?: ConfigurableDefaultColDef;

  /**
   * Fields available for this entity in configured initial column order.
   *
   * Each field becomes one compiled AG Grid `ColDef`. Business entity identity does not come from this
   * generic array type; it comes from the containing `FeatureDefinition.entities` record key.
   */
  fields: readonly TFieldDefinition[];
}

/**
 * Defines where the stable business-row identifier is found in the API row shape.
 *
 * This remains an application descriptor rather than being named `getRowId`: AG Grid `getRowId` is an
 * executable callback, while persisted configuration can safely carry only the field path from which
 * the frontend runtime constructs that callback.
 */
export interface RowIdDefinition {
  /** Field path containing the stable business-row identifier; dot notation is supported. */
  path: string;
}
