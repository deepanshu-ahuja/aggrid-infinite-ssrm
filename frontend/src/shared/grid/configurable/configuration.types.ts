import type {
  BaseCellDataType,
  ColDef,
  GridOptions,
  IBigIntFilterParams,
  IDateFilterParams,
  INumberFilterParams,
  ISimpleFilterModelType,
  ITextFilterParams,
} from 'ag-grid-community';

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

/** JSON-safe object passed to registered/configured AG Grid behavior. */
export interface ConfigurationJsonObject {
  readonly [key: string]: ConfigurationJsonValue;
}

/**
 * AG Grid's own union of pre-defined cell-data-type names.
 *
 * Use `BaseCellDataType` directly rather than reconstructing the literals from `ColDef.cellDataType`:
 * `ColDef.cellDataType` is intentionally broader because AG Grid also accepts `false`, inference and
 * custom data-type names. SSRM does not infer types, so a configurable field supplies one explicitly.
 */
export type FieldCellDataType = BaseCellDataType;

/** Server-supported text-filter choices, narrowed from AG Grid's native Simple Filter option union. */
export type TextFilterOption = Extract<
  ISimpleFilterModelType,
  'contains' | 'equals' | 'notEqual' | 'startsWith' | 'endsWith'
>;

/** Server-supported number/BigInt-filter choices, narrowed from AG Grid's native option union. */
export type NumberFilterOption = Extract<
  ISimpleFilterModelType,
  | 'equals'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
>;

/** Server-supported date/date-time choices, narrowed from AG Grid's native option union. */
export type DateFilterOption = Extract<
  ISimpleFilterModelType,
  'equals' | 'notEqual' | 'lessThan' | 'greaterThan'
>;

/** Server-supported boolean choices, narrowed from AG Grid's native option union. */
export type BooleanFilterOption = Extract<ISimpleFilterModelType, 'equals' | 'notEqual'>;

/** Union of the native AG Grid Simple Filter options supported by the current server-query contract. */
export type FilterOption =
  | TextFilterOption
  | NumberFilterOption
  | DateFilterOption
  | BooleanFilterOption;

/** Resolves the server-supported AG Grid filter-option vocabulary for a cell data type. */
export type FilterOptionForCellDataType<TCellDataType extends FieldCellDataType> =
  TCellDataType extends 'text'
    ? TextFilterOption
    : TCellDataType extends 'number' | 'bigint'
      ? NumberFilterOption
      : TCellDataType extends 'boolean'
        ? BooleanFilterOption
        : TCellDataType extends 'date' | 'dateString' | 'dateTime' | 'dateTimeString'
          ? DateFilterOption
          : never;

/**
 * Native Simple Filter behavior that is both JSON-safe and common across Text/Number/BigInt/Date.
 *
 * `filterPlaceholder` is narrowed to AG Grid's string branch because its other branch is executable.
 * `filterOptions` is intentionally handled separately so each field can be constrained to the exact
 * native operator keys that the server adapter supports end-to-end.
 */
type ConfigurableSimpleFilterCommonParamKey =
  | 'buttons'
  | 'closeOnApply'
  | 'debounceMs'
  | 'readOnly'
  | 'defaultOption'
  | 'defaultJoinOperator'
  | 'maxNumConditions'
  | 'numAlwaysVisibleConditions';

export type ConfigurableSimpleFilterCommonParams = Pick<
  ITextFilterParams,
  ConfigurableSimpleFilterCommonParamKey
> & {
  filterPlaceholder?: Extract<NonNullable<ITextFilterParams['filterPlaceholder']>, string>;
};

/**
 * Common JSON-safe Simple Filter params plus a server-supported native option allowlist.
 *
 * AG Grid also permits custom `IFilterOptionDef` entries containing a predicate function. Those are
 * deliberately excluded from persisted metadata; executable filter behavior remains frontend-owned.
 */
export type ConfigurableSimpleFilterParams<
  TFilterOption extends ISimpleFilterModelType = FilterOption,
> = ConfigurableSimpleFilterCommonParams & {
  filterOptions?: TFilterOption[];
};

/** JSON-safe Text Filter params derived from AG Grid's `ITextFilterParams`. */
export type ConfigurableTextFilterParams<
  TFilterOption extends ISimpleFilterModelType = TextFilterOption,
> = ConfigurableSimpleFilterParams<TFilterOption> &
  Pick<ITextFilterParams, 'caseSensitive' | 'trimInput'>;

type ConfigurableScalarFilterParamKey =
  | 'inRangeInclusive'
  | 'includeBlanksInEquals'
  | 'includeBlanksInNotEqual'
  | 'includeBlanksInLessThan'
  | 'includeBlanksInGreaterThan'
  | 'includeBlanksInRange';

/** JSON-safe Number Filter params; executable `numberParser` / `numberFormatter` stay frontend-owned. */
export type ConfigurableNumberFilterParams<
  TFilterOption extends ISimpleFilterModelType = NumberFilterOption,
> = ConfigurableSimpleFilterParams<TFilterOption> &
  Pick<INumberFilterParams, ConfigurableScalarFilterParamKey | 'allowedCharPattern'>;

/** JSON-safe BigInt Filter params; executable parser/formatter callbacks stay frontend-owned. */
export type ConfigurableBigIntFilterParams<
  TFilterOption extends ISimpleFilterModelType = NumberFilterOption,
> = ConfigurableSimpleFilterParams<TFilterOption> &
  Pick<IBigIntFilterParams, ConfigurableScalarFilterParamKey | 'allowedCharPattern'>;

/**
 * JSON-safe Date Filter params derived from AG Grid's `IDateFilterParams`.
 *
 * Native `comparator` and `isValidDate` are callbacks and therefore excluded. `minValidDate` and
 * `maxValidDate` also accept JavaScript `Date` objects natively; persisted configuration keeps only
 * AG Grid's documented string representation.
 */
export type ConfigurableDateFilterParams<
  TFilterOption extends ISimpleFilterModelType = DateFilterOption,
> = ConfigurableSimpleFilterParams<TFilterOption> &
  Pick<
    IDateFilterParams,
    | ConfigurableScalarFilterParamKey
    | 'browserDatePicker'
    | 'minValidYear'
    | 'maxValidYear'
    | 'inRangeFloatingFilterDateFormat'
    | 'includeTime'
    | 'useIsoSeparator'
  > & {
    minValidDate?: Extract<NonNullable<IDateFilterParams['minValidDate']>, string>;
    maxValidDate?: Extract<NonNullable<IDateFilterParams['maxValidDate']>, string>;
  };

/**
 * Resolves the native JSON-safe filter-param surface for one configured cell data type.
 *
 * Boolean currently keeps only common Simple Filter behavior plus the server-supported equality
 * operators. Set Filter / Multi Filter are separate server-query capabilities and are not smuggled
 * into this flat Simple Filter contract merely because AG Grid can render them.
 */
export type ConfigurableFilterParamsForCellDataType<
  TCellDataType extends FieldCellDataType,
  TAdditionalFilterOption extends ISimpleFilterModelType = never,
> = TCellDataType extends 'text'
  ? ConfigurableTextFilterParams<TextFilterOption | TAdditionalFilterOption>
  : TCellDataType extends 'number'
    ? ConfigurableNumberFilterParams<NumberFilterOption | TAdditionalFilterOption>
    : TCellDataType extends 'bigint'
      ? ConfigurableBigIntFilterParams<NumberFilterOption | TAdditionalFilterOption>
      : TCellDataType extends 'date' | 'dateString' | 'dateTime' | 'dateTimeString'
        ? ConfigurableDateFilterParams<DateFilterOption | TAdditionalFilterOption>
        : TCellDataType extends 'boolean'
          ? ConfigurableSimpleFilterParams<BooleanFilterOption | TAdditionalFilterOption>
          : never;

/**
 * Native declarative `ColDef` members that can be persisted without changing their AG Grid semantics.
 *
 * Keep this as a reviewed `Pick`, not a hand-written copy of each property type and not an `Omit` of
 * all `ColDef`: `Pick` makes newly-added AG Grid callbacks/features opt-in instead of accidentally
 * becoming backend-configurable after a library upgrade.
 */
type ConfigurableNativeColDefKey =
  | 'type'
  | 'sortable'
  | 'initialSort'
  | 'initialSortIndex'
  | 'sortingOrder'
  | 'initialHide'
  | 'lockVisible'
  | 'initialPinned'
  | 'initialWidth'
  | 'initialFlex'
  | 'minWidth'
  | 'maxWidth'
  | 'resizable'
  | 'suppressSizeToFit'
  | 'suppressAutoSize'
  | 'suppressMovable'
  | 'lockPosition'
  | 'lockPinned'
  | 'wrapText'
  | 'autoHeight'
  | 'wrapHeaderText'
  | 'autoHeaderHeight'
  | 'headerTooltip'
  | 'tooltipField'
  | 'floatingFilter'
  | 'suppressHeaderMenuButton'
  | 'suppressHeaderFilterButton'
  | 'suppressHeaderContextMenu'
  | 'suppressFloatingFilterButton'
  | 'cellEditorPopup'
  | 'cellEditorPopupPosition'
  | 'singleClickEdit'
  | 'useValueParserForImport'
  | 'useValueFormatterForExport'
  | 'suppressFillHandle';

type ConfigurableNativeColDefBase = Pick<ColDef, ConfigurableNativeColDefKey>;

/**
 * Native `ColDef` members whose AG Grid type also permits a callback/function branch.
 * Only the declarative boolean branch is safe in persisted configuration.
 */
type ConfigurableNativeColDefBooleanBranches = {
  editable?: Extract<NonNullable<ColDef['editable']>, boolean>;
  suppressNavigable?: Extract<NonNullable<ColDef['suppressNavigable']>, boolean>;
  suppressPaste?: Extract<NonNullable<ColDef['suppressPaste']>, boolean>;
};

/**
 * JSON-safe native `ColDef` surface for configurable fields/defaults.
 *
 * Most members are inherited directly through `Pick<ColDef, ...>`. Only members whose native value
 * can be executable or framework-owned are replaced below with the safe representation we support.
 * AG Grid editor/renderer/filter component names stay native because AG Grid already supports named
 * registered components; the frontend owns and validates the actual registrations.
 */
export type ConfigurableNativeColDefOptions<
  TCellEditorName extends string = string,
  TCellRendererName extends string = string,
  TFilterName extends string = string,
  TFilterParams = ConfigurableSimpleFilterCommonParams,
> = ConfigurableNativeColDefBase &
  ConfigurableNativeColDefBooleanBranches & {
    /** AG Grid provided-filter name or an allowlisted frontend-registered filter name. */
    filter?: Extract<NonNullable<ColDef['filter']>, boolean> | TFilterName;
    /** Native JSON-safe params for the selected filter component. */
    filterParams?: TFilterParams;
    /** AG Grid provided-editor name or an allowlisted frontend-registered editor name. */
    cellEditor?: TCellEditorName;
    /** Static JSON-safe editor params; runtime functions such as validation callbacks are merged later. */
    cellEditorParams?: ConfigurationJsonObject;
    /** AG Grid provided-renderer name or an allowlisted frontend-registered renderer name. */
    cellRenderer?: TCellRendererName;
    /** Static JSON-safe renderer params. */
    cellRendererParams?: ConfigurationJsonObject;
  };

/** Native JSON-safe `defaultColDef` uses the common filter behavior rather than one filter-type's options. */
export type ConfigurableDefaultColDef = ConfigurableNativeColDefOptions<
  string,
  string,
  string,
  ConfigurableSimpleFilterCommonParams
>;

type NativeCellSelectionOptions = Exclude<NonNullable<GridOptions['cellSelection']>, boolean>;
type NativeCellSelectionHandle = NonNullable<NativeCellSelectionOptions['handle']>;
type NativeRangeHandle = Extract<NativeCellSelectionHandle, { mode: 'range' }>;
type NativeFillHandle = Extract<NativeCellSelectionHandle, { mode: 'fill' }>;

/**
 * Native Cell Selection handle with only executable Fill Handle behavior removed.
 *
 * AG Grid owns the range/fill shape, direction and compatible declarative members. The only current
 * member removed is `setFillValue`, because that is executable frontend behavior.
 */
export type ConfigurableCellSelectionHandle =
  | NativeRangeHandle
  | Omit<NativeFillHandle, 'setFillValue'>;

/**
 * JSON-safe subset of AG Grid's native `cellSelection` object.
 *
 * The top-level members come directly from `GridOptions['cellSelection']`; `handle` is replaced by the
 * derived safe handle above so backend JSON cannot contain `setFillValue`.
 */
export type ConfigurableCellSelectionOptions = Pick<
  NativeCellSelectionOptions,
  'suppressMultiRanges' | 'enableHeaderHighlight' | 'enableColumnSelection'
> & {
  handle?: ConfigurableCellSelectionHandle;
};

type NativeRowSelectionOptions = NonNullable<GridOptions['rowSelection']>;
type NativeSingleRowSelectionOptions = Extract<NativeRowSelectionOptions, { mode: 'singleRow' }>;
type NativeMultiRowSelectionOptions = Extract<NativeRowSelectionOptions, { mode: 'multiRow' }>;

type ConfigurableRowSelectionCommonOptions = Pick<
  NativeSingleRowSelectionOptions,
  | 'enableClickSelection'
  | 'checkboxLocation'
  | 'hideDisabledCheckboxes'
  | 'copySelectedRows'
  | 'enableSelectionWithoutKeys'
> & {
  /** Static branch only; AG Grid's per-row checkbox callback remains runtime-owned. */
  checkboxes?: Extract<NonNullable<NativeSingleRowSelectionOptions['checkboxes']>, boolean>;
};

/**
 * Native row-selection configuration valid for the current flat configurable SSRM model.
 *
 * `isRowSelectable` is deliberately absent because it is executable business policy. Group-selection
 * behavior is also absent because this configurable runtime is currently flat SSRM; when server-side
 * grouping becomes a supported capability its native group-selection branch should be added together
 * with the corresponding request/state semantics.
 *
 * SSRM treats `selectAll: 'filtered' | 'currentPage'` as invalid, so the persisted native branch is
 * narrowed to `'all'`; our All Filtered / Current Page operations remain application semantics.
 */
export type ConfigurableSsrmRowSelectionOptions =
  | (ConfigurableRowSelectionCommonOptions & Pick<NativeSingleRowSelectionOptions, 'mode'>)
  | (ConfigurableRowSelectionCommonOptions &
      Pick<NativeMultiRowSelectionOptions, 'mode' | 'headerCheckbox' | 'ctrlASelectsRows'> & {
        selectAll?: Extract<NonNullable<NativeMultiRowSelectionOptions['selectAll']>, 'all'>;
      });

/**
 * Native declarative `GridOptions` members currently supported by the configurable SSRM root.
 *
 * As with columns, use an explicit `Pick` allowlist so AG Grid upgrades cannot silently expose a new
 * callback/runtime object to backend configuration. Nested/mixed properties are replaced separately.
 */
type ConfigurableSsrmGridOptionKey =
  | 'pagination'
  | 'paginationAutoPageSize'
  | 'paginationPageSize'
  | 'paginationPageSizeSelector'
  | 'suppressPaginationPanel'
  | 'cacheBlockSize'
  | 'maxBlocksInCache'
  | 'blockLoadDebounceMillis'
  | 'maxConcurrentDatasourceRequests'
  | 'serverSideInitialRowCount'
  | 'suppressServerSideFullWidthLoadingRow'
  | 'invalidEditValueMode'
  | 'singleClickEdit'
  | 'suppressClickEdit'
  | 'enterNavigatesVertically'
  | 'enterNavigatesVerticallyAfterEdit'
  | 'stopEditingWhenCellsLoseFocus'
  | 'undoRedoCellEditing'
  | 'undoRedoCellEditingLimit'
  | 'suppressClipboardPaste'
  | 'suppressMovableColumns'
  | 'suppressMoveWhenColumnDragging'
  | 'suppressColumnMoveAnimation'
  | 'suppressDragLeaveHidesColumns'
  | 'rowHeight'
  | 'rowBuffer'
  | 'headerHeight'
  | 'animateRows'
  | 'enableRtl'
  | 'enableBrowserTooltips'
  | 'tooltipShowDelay'
  | 'tooltipSwitchShowDelay'
  | 'tooltipHideDelay'
  | 'tooltipMouseTrack'
  | 'tooltipInteraction'
  | 'suppressCellFocus'
  | 'suppressHeaderFocus'
  | 'enableCellTextSelection'
  | 'ensureDomOrder';

type ConfigurableSsrmGridOptionsBase = Pick<GridOptions, ConfigurableSsrmGridOptionKey>;

/**
 * Bounded JSON-safe native AG Grid options for the configurable SSRM root.
 *
 * Most values are inherited directly from `GridOptions` through `Pick`. Nested values whose native
 * type contains executable or unsupported branches are replaced with narrower derived versions.
 * Runtime-owned values such as modules, datasource, columnDefs, callbacks/events, context and GridApi
 * are intentionally not in the picked surface.
 */
export type ConfigurableSsrmGridOptions = ConfigurableSsrmGridOptionsBase & {
  defaultColDef?: ConfigurableDefaultColDef;
  rowSelection?: ConfigurableSsrmRowSelectionOptions;
  cellSelection?:
    | Extract<NonNullable<GridOptions['cellSelection']>, boolean>
    | ConfigurableCellSelectionOptions;
};

/** Actual AG Grid formatter-function branch used by frontend formatter registries. */
export type RegisteredValueFormatter<TData = unknown, TValue = unknown> = Exclude<
  NonNullable<ColDef<TData, TValue>['valueFormatter']>,
  string
>;

/** Actual AG Grid parser-function branch used by frontend parser registries. */
export type RegisteredValueParser<TData = unknown, TValue = unknown> = Exclude<
  NonNullable<ColDef<TData, TValue>['valueParser']>,
  string
>;

/**
 * Reusable configuration for one field/column exposed by an entity.
 *
 * Native JSON-safe AG Grid concepts stay flat through `ConfigurableNativeColDefOptions`. A custom
 * descriptor exists only where the persisted value cannot have AG Grid's executable semantics—for
 * example formatter/parser keys select frontend functions rather than storing raw functions or AG Grid
 * expression strings.
 *
 * @typeParam TColId Stable AG Grid column/configuration identity type.
 * @typeParam TFieldPath Row/API value path bound to `ColDef.field`.
 * @typeParam TLabelKey Allowed translation-key type for the column label.
 * @typeParam TCellDataType Supported AG Grid base cell data type for this field.
 * @typeParam TAdditionalFilterOption Additional native Simple Filter option keys supported by a feature.
 * @typeParam TCellEditorName Allowed AG Grid provided/registered editor names.
 * @typeParam TCellRendererName Allowed AG Grid provided/registered renderer names.
 * @typeParam TValueFormatterKey Allowed frontend formatter registry keys.
 * @typeParam TValueParserKey Allowed frontend parser registry keys.
 */
export type FieldDefinition<
  TColId extends NonNullable<ColDef['colId']> = NonNullable<ColDef['colId']>,
  TFieldPath extends string = string,
  TLabelKey extends string = string,
  TCellDataType extends FieldCellDataType = FieldCellDataType,
  TAdditionalFilterOption extends ISimpleFilterModelType = never,
  TCellEditorName extends string = string,
  TCellRendererName extends string = string,
  TValueFormatterKey extends string = string,
  TValueParserKey extends string = string,
> = ConfigurableNativeColDefOptions<
  TCellEditorName,
  TCellRendererName,
  string,
  ConfigurableFilterParamsForCellDataType<TCellDataType, TAdditionalFilterOption>
> & {
  /**
   * Stable native Column ID and application field-configuration identity.
   * It remains independent from the API `field` path so Grid State/API identity survives path renames.
   */
  colId: TColId;

  /** API/row value path, passed to AG Grid `ColDef.field`; dot notation is supported. */
  field: TFieldPath;

  /** Translation key resolved by the frontend into final AG Grid `headerName` text. */
  labelKey: TLabelKey;

  /** Explicit AG Grid base cell data type; SSRM cannot infer this from row data. */
  cellDataType: TCellDataType;

  /** Frontend registry key resolved to executable AG Grid `valueFormatter`. */
  valueFormatterKey?: TValueFormatterKey;
  /** Extra JSON-safe application config consumed by the registered formatter. */
  valueFormatterConfig?: ConfigurationJsonObject;

  /** Frontend registry key resolved to executable AG Grid `valueParser`. */
  valueParserKey?: TValueParserKey;
  /** Extra JSON-safe application config consumed by the registered parser. */
  valueParserConfig?: ConfigurationJsonObject;
};

type ConfigurableFieldDefinition<TLabelKey extends string = string> = FieldDefinition<
  NonNullable<ColDef['colId']>,
  string,
  TLabelKey,
  FieldCellDataType,
  ISimpleFilterModelType,
  string,
  string,
  string,
  string
>;

/**
 * Reusable configuration for one entity/data context inside a configurable feature.
 *
 * This shared type does not know whether the entity is a Transaction, Loan, Finance, or another
 * business type. The entity's identity is the key used in `FeatureDefinition.entities`; these generic
 * parameters only narrow its translation keys and field-definition shape.
 */
export interface EntityDefinition<
  TLabelKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TLabelKey> = ConfigurableFieldDefinition<TLabelKey>,
> {
  /** Full translation key resolved into the entity's display label. */
  labelKey: TLabelKey;

  /**
   * Frontend data/API adapter key for loading, saving, request/response mapping and wire normalization.
   * This is application infrastructure, not an AG Grid datasource object.
   */
  dataAdapterKey: string;

  /** Stable business-row identity definition used to construct runtime AG Grid `getRowId`. */
  rowId: RowIdDefinition;

  /**
   * Entity-level native AG Grid overrides for the configurable SSRM root.
   * Application defaults are resolved first, then these normalized overrides are merged.
   */
  gridOptions?: ConfigurableSsrmGridOptions;

  /** Fields available for this entity in configured initial column order. */
  fields: readonly TFieldDefinition[];
}

/**
 * Defines where stable business-row identity lives in the API row shape.
 *
 * This remains an application descriptor rather than `getRowId`: the latter is an executable AG Grid
 * callback, while persisted JSON can safely carry only the field path used to construct it.
 */
export interface RowIdDefinition {
  /** Field path containing the stable business-row identifier; dot notation is supported. */
  path: string;
}
