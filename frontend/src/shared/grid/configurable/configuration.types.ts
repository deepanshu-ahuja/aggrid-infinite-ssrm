import type { ColDef, GridOptions } from 'ag-grid-community';

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
 * Built-in AG Grid cell-data-type names supported by configurable fields.
 *
 * The normalized property is `cellDataType`, matching AG Grid `ColDef.cellDataType`. SSRM does not
 * infer cell data types from row data, so the configurable compiler must set the type explicitly.
 * AG Grid's native type-specific parser, formatter, editor, renderer, sorting and filtering behavior
 * is then the baseline before a field deliberately overrides one of those capabilities.
 *
 * `date` / `dateTime` represent JavaScript `Date` values. `dateString` / `dateTimeString` represent
 * strings. `bigint` requires the data adapter to materialise real JavaScript bigint values because
 * raw JSON cannot transport bigint directly. `object` normally requires application formatter/parser
 * behavior that understands the object's shape.
 */
export type FieldCellDataType = Extract<
  NonNullable<ColDef['cellDataType']>,
  | 'text'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'date'
  | 'dateString'
  | 'dateTime'
  | 'dateTimeString'
  | 'object'
>;

/** Base text-filter options supported by the shared server-query vocabulary. */
export type TextFilterOption =
  | 'contains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith';

/** Base number/BigInt-filter options supported by the shared server-query vocabulary. */
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

/** Resolves the shared server-filter vocabulary appropriate for an AG Grid cell data type. */
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
 * Server-supported filtering capability for one configurable field.
 *
 * This remains application-specific because the important persisted meaning is not merely "which AG
 * Grid filter component should render?" It is "which filter operations can this data adapter/backend
 * execute correctly?" The compiler turns this descriptor into the matching AG Grid `filter` plus
 * `filterParams.filterOptions` configuration.
 */
export interface FieldFilteringDefinition<TFilterOption extends string = FilterOption> {
  /**
   * Complete non-empty list of filter operations that the active server-query adapter supports.
   *
   * The leaf name intentionally matches AG Grid Simple Filter `filterOptions`. A native option is not
   * exposed merely because AG Grid can render it; the data adapter/backend must support the same model.
   */
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}

/** Initial pin position available to configurable columns, derived from AG Grid `ColDef`. */
export type FieldPinnedPosition = Extract<
  NonNullable<ColDef['initialPinned']>,
  'left' | 'right'
>;

/**
 * JSON-safe native `ColDef` properties that the configurable contract may carry directly.
 *
 * These properties intentionally keep AG Grid names because their normalized values have the same
 * meaning as AG Grid. Function/callback branches are removed where a native property is a union of
 * declarative and executable forms. Runtime policy may still further restrict a native capability;
 * for example `editable: true` makes the column eligible for editing while the compiled AG Grid
 * callback can additionally enforce current row/access policy.
 *
 * Registered custom editors/renderers are represented by their AG Grid component names. Executable
 * component implementations remain frontend-owned and are registered by runtime infrastructure.
 */
export interface ConfigurableNativeColDefOptions<
  TCellEditorName extends string = string,
  TCellRendererName extends string = string,
> {
  /** Whether the column participates in native AG Grid sorting. */
  sortable?: ColDef['sortable'];
  /** Initial sort direction without continuously overwriting later Grid State. */
  initialSort?: ColDef['initialSort'];
  /** Initial multi-sort priority without continuously overwriting later Grid State. */
  initialSortIndex?: ColDef['initialSortIndex'];
  /** Native sort-cycle order, for example `['asc', 'desc', null]`. */
  sortingOrder?: ColDef['sortingOrder'];

  /** Initial hidden state; seeds new column state. */
  initialHide?: ColDef['initialHide'];
  /** Prevent users from changing this column's visibility through the UI. */
  lockVisible?: ColDef['lockVisible'];
  /** Initial pinned side; seeds new column state. */
  initialPinned?: FieldPinnedPosition;
  /** Initial width in pixels; seeds new column state. */
  initialWidth?: ColDef['initialWidth'];
  /** Initial flex value; seeds new column state. */
  initialFlex?: ColDef['initialFlex'];
  /** Continuing minimum-width constraint. */
  minWidth?: ColDef['minWidth'];
  /** Continuing maximum-width constraint. */
  maxWidth?: ColDef['maxWidth'];
  /** Whether users may resize the column. */
  resizable?: ColDef['resizable'];
  /** Whether the column is excluded from size-to-fit calculations. */
  suppressSizeToFit?: ColDef['suppressSizeToFit'];
  /** Whether the column is excluded from auto-size calculations. */
  suppressAutoSize?: ColDef['suppressAutoSize'];
  /** Whether the user may move this column. */
  suppressMovable?: ColDef['suppressMovable'];
  /** Native AG Grid position lock for this column. */
  lockPosition?: ColDef['lockPosition'];
  /** Whether users may change this column's pinned state. */
  lockPinned?: ColDef['lockPinned'];

  /** Whether cell text wraps. */
  wrapText?: ColDef['wrapText'];
  /** Whether row height may grow to fit this column's wrapped cell content. */
  autoHeight?: ColDef['autoHeight'];
  /** Whether header text wraps. */
  wrapHeaderText?: ColDef['wrapHeaderText'];
  /** Whether header height may grow to fit wrapped header text. */
  autoHeaderHeight?: ColDef['autoHeaderHeight'];
  /** Static header tooltip text. */
  headerTooltip?: ColDef['headerTooltip'];
  /** Row-data field used by AG Grid as the cell tooltip value. */
  tooltipField?: ColDef['tooltipField'];
  /** Static branch of native keyboard navigation suppression for the column. */
  suppressNavigable?: boolean;

  /** Show the field's normal filter state/control in an AG Grid floating-filter row. */
  floatingFilter?: ColDef['floatingFilter'];
  /** Hide the normal column-menu button for this header. */
  suppressHeaderMenuButton?: ColDef['suppressHeaderMenuButton'];
  /** Hide the header filter button for this column. */
  suppressHeaderFilterButton?: ColDef['suppressHeaderFilterButton'];
  /** Disable opening the column menu from header right-click. */
  suppressHeaderContextMenu?: ColDef['suppressHeaderContextMenu'];
  /** Hide the button that opens the parent filter from a floating filter. */
  suppressFloatingFilterButton?: ColDef['suppressFloatingFilterButton'];

  /**
   * Native column editing eligibility.
   *
   * Only the declarative boolean branch is persisted. `true` does not bypass application row/access
   * policy: the compiler may turn it into an AG Grid `editable` callback that combines this permission
   * with current authoritative business rules.
   */
  editable?: boolean;

  /**
   * AG Grid provided-editor name or frontend-registered custom editor name.
   *
   * This is deliberately the native `cellEditor` property rather than `editing.editor.key`. AG Grid
   * supports selecting registered components by name, which is the JSON-safe representation we need.
   */
  cellEditor?: TCellEditorName;

  /**
   * Static JSON-safe params passed through to AG Grid `cellEditorParams`.
   *
   * Runtime/compiler-owned functions such as native `getValidationErrors` are merged separately and
   * are never accepted from backend JSON.
   */
  cellEditorParams?: ConfigurationJsonObject;

  /** Native popup-editor flag. */
  cellEditorPopup?: ColDef['cellEditorPopup'];
  /** Native popup placement relative to the edited cell. */
  cellEditorPopupPosition?: ColDef['cellEditorPopupPosition'];
  /** Start editing this column on one click instead of the grid's normal double-click behavior. */
  singleClickEdit?: ColDef['singleClickEdit'];
  /** Whether import/paste should apply this column's resolved value parser. */
  useValueParserForImport?: ColDef['useValueParserForImport'];
  /** Whether export/copy/fill should use this column's resolved value formatter. */
  useValueFormatterForExport?: ColDef['useValueFormatterForExport'];
  /** Static branch of AG Grid `suppressPaste`; callbacks remain frontend-owned. */
  suppressPaste?: boolean;
  /** Prevent Fill Handle updates for this column. Non-editable cells are already skipped natively. */
  suppressFillHandle?: ColDef['suppressFillHandle'];

  /** AG Grid provided-renderer name or frontend-registered custom renderer name. */
  cellRenderer?: TCellRendererName;
  /** Static JSON-safe props passed through to AG Grid `cellRendererParams`. */
  cellRendererParams?: ConfigurationJsonObject;
}

/**
 * Bounded JSON-safe AG Grid `defaultColDef` used by configurable entities.
 *
 * This reuses the reviewed native declarative surface used by fields. It intentionally does not
 * accept executable callbacks, component implementations or arbitrary `ColDef` objects.
 */
export type ConfigurableDefaultColDef = ConfigurableNativeColDefOptions<string, string>;

/**
 * JSON-safe Cell Selection configuration supported by the configurable SSRM grid.
 *
 * The names match AG Grid `cellSelection`. The callback-based Fill Handle `setFillValue` option is
 * intentionally absent; custom executable fill behavior requires a separately reviewed frontend
 * registry capability rather than backend-supplied JavaScript.
 */
export interface ConfigurableCellSelectionOptions {
  /** Allow only one cell range at a time. */
  suppressMultiRanges?: boolean;
  /** Highlight headers that intersect selected cell ranges. */
  enableHeaderHighlight?: boolean;
  /** Allow whole-column cell selection from the header. */
  enableColumnSelection?: boolean;
  /** Native range or Fill Handle configuration. */
  handle?: ConfigurableCellSelectionHandle;
}

/** JSON-safe native selection-handle modes. */
export type ConfigurableCellSelectionHandle =
  | {
      /** Native range-resize handle. */
      mode: 'range';
    }
  | {
      /** Native Fill Handle used for spreadsheet-like editing. */
      mode: 'fill';
      /** Limit fill dragging to horizontal, vertical, or both axes. */
      direction?: 'x' | 'y' | 'xy';
      /** Prevent shrinking a fill range from clearing removed cells. */
      suppressClearOnFillReduction?: boolean;
    };

interface ConfigurableRowSelectionCommonOptions {
  /** Static branch of AG Grid checkbox rendering; per-row callback policy remains runtime-owned. */
  checkboxes?: boolean;
  /** Hide checkboxes disabled by the runtime `isRowSelectable` business-policy callback. */
  hideDisabledCheckboxes?: boolean;
  /** Native row-click/keyboard selection behavior. */
  enableClickSelection?: boolean | 'enableDeselection' | 'enableSelection';
  /** Copy a selected row rather than only its focused cell when native clipboard copy is used. */
  copySelectedRows?: boolean;
  /** Allow touch/click multi-selection without requiring Ctrl/Cmd. */
  enableSelectionWithoutKeys?: boolean;
}

/**
 * JSON-safe native row-selection configuration valid for the flat configurable SSRM model.
 *
 * The callback `isRowSelectable` remains runtime-owned because it enforces feature/business policy.
 * SSRM treats `selectAll: 'filtered' | 'currentPage'` as invalid and falls back to `'all'`, so those
 * values are deliberately not accepted here. The repository's All Filtered / Current Page semantics
 * remain explicit application operations rather than misleading native configuration.
 */
export type ConfigurableSsrmRowSelectionOptions = ConfigurableRowSelectionCommonOptions &
  (
    | {
        mode: 'singleRow';
      }
    | {
        mode: 'multiRow';
        /** Flat SSRM selection state; grouped descendant selection requires a different contract. */
        groupSelects?: 'self';
        /** Only native SSRM-valid header select-all scope. */
        selectAll?: 'all';
        /** Show AG Grid's header select-all checkbox. */
        headerCheckbox?: boolean;
        /** Allow Ctrl/Cmd+A to select rows when Cell Selection is also enabled. */
        ctrlASelectsRows?: boolean;
      }
  );

/**
 * Bounded native AG Grid options for the configurable SSRM root.
 *
 * This is an allowlisted JSON-safe subset of `GridOptions`, not a parallel grid API. Application-wide
 * defaults are merged with entity overrides before the runtime supplies resolved values to
 * `AgGridReact`. Executable callbacks/events, `serverSideDatasource`, `context`, `columnDefs`, GridApi
 * references and React `modules` remain runtime-owned.
 *
 * The allowlist is capability-driven: applicable declarative native options should retain their AG
 * Grid names instead of being reinvented. A native option is excluded only when it is executable,
 * changes the selected runtime architecture, is incompatible with flat SSRM semantics, or belongs to
 * a capability whose end-to-end contract is not supported yet.
 */
export interface ConfigurableSsrmGridOptions {
  /** Native AG Grid column defaults after application defaults are merged. */
  defaultColDef?: ConfigurableDefaultColDef;

  /** Enable native AG Grid pagination. */
  pagination?: GridOptions['pagination'];
  /** Size the current page automatically from available vertical space. */
  paginationAutoPageSize?: GridOptions['paginationAutoPageSize'];
  /** Number of rows displayed per pagination page. */
  paginationPageSize?: GridOptions['paginationPageSize'];
  /** Native page-size selector configuration. */
  paginationPageSizeSelector?: GridOptions['paginationPageSizeSelector'];
  /** Hide AG Grid's built-in pagination panel while retaining pagination behavior. */
  suppressPaginationPanel?: GridOptions['suppressPaginationPanel'];

  /** SSRM rows requested per server-side cache block. */
  cacheBlockSize?: GridOptions['cacheBlockSize'];
  /** Maximum retained SSRM blocks before least-recent blocks are evicted. */
  maxBlocksInCache?: GridOptions['maxBlocksInCache'];
  /** Debounce before issuing another block-load request during rapid scrolling. */
  blockLoadDebounceMillis?: GridOptions['blockLoadDebounceMillis'];
  /** Maximum simultaneous datasource requests. */
  maxConcurrentDatasourceRequests?: GridOptions['maxConcurrentDatasourceRequests'];
  /** Initial number of SSRM loading rows represented at the root level. */
  serverSideInitialRowCount?: GridOptions['serverSideInitialRowCount'];
  /** Use per-cell loading instead of SSRM's full-width loading row. */
  suppressServerSideFullWidthLoadingRow?: GridOptions['suppressServerSideFullWidthLoadingRow'];

  /** Native row selection for the flat SSRM model; runtime injects `isRowSelectable`. */
  rowSelection?: ConfigurableSsrmRowSelectionOptions;

  /**
   * Native AG Grid Cell Selection configuration.
   *
   * This is the selection surface used by native Ctrl/Cmd+D, Ctrl/Cmd+Enter and Fill Handle editing.
   * Required AG Grid Enterprise modules are runtime/bundle infrastructure, not JSON config.
   */
  cellSelection?: boolean | ConfigurableCellSelectionOptions;

  /** Native AG Grid invalid-editor handling, including the spike's `"block"` mode. */
  invalidEditValueMode?: GridOptions['invalidEditValueMode'];
  /** Enable single-click editing across columns unless a column overrides it. */
  singleClickEdit?: GridOptions['singleClickEdit'];
  /** Disable click/double-click edit entry while retaining other native edit entry points. */
  suppressClickEdit?: GridOptions['suppressClickEdit'];
  /** Move focus down on Enter when the focused cell is not editing. */
  enterNavigatesVertically?: GridOptions['enterNavigatesVertically'];
  /** Move focus down after Enter commits the active editor. */
  enterNavigatesVerticallyAfterEdit?: GridOptions['enterNavigatesVerticallyAfterEdit'];
  /** Commit/stop the active edit when focus leaves the grid. */
  stopEditingWhenCellsLoseFocus?: GridOptions['stopEditingWhenCellsLoseFocus'];
  /** Enable AG Grid's native undo/redo stack for cell edits, paste and Fill Handle changes. */
  undoRedoCellEditing?: GridOptions['undoRedoCellEditing'];
  /** Native maximum undo/redo stack depth. */
  undoRedoCellEditingLimit?: GridOptions['undoRedoCellEditingLimit'];
  /** Disable clipboard paste for the entire grid. */
  suppressClipboardPaste?: GridOptions['suppressClipboardPaste'];

  /** Prevent all columns from being moved by users. */
  suppressMovableColumns?: GridOptions['suppressMovableColumns'];
  /** Show the target position while dragging and move only when the drag completes. */
  suppressMoveWhenColumnDragging?: GridOptions['suppressMoveWhenColumnDragging'];
  /** Disable AG Grid's column-moving animation. */
  suppressColumnMoveAnimation?: GridOptions['suppressColumnMoveAnimation'];
  /** Prevent dragging a column outside the grid from hiding it. */
  suppressDragLeaveHidesColumns?: GridOptions['suppressDragLeaveHidesColumns'];

  /** Native fixed row height when the table chooses one. */
  rowHeight?: GridOptions['rowHeight'];
  /** Number of extra rows AG Grid renders outside the visible viewport. */
  rowBuffer?: GridOptions['rowBuffer'];
  /** Native header-row height. */
  headerHeight?: GridOptions['headerHeight'];
  /** Native row animation toggle. */
  animateRows?: GridOptions['animateRows'];
  /** Use right-to-left grid layout. */
  enableRtl?: GridOptions['enableRtl'];

  /** Use browser-native title tooltips instead of AG Grid rich tooltips. */
  enableBrowserTooltips?: GridOptions['enableBrowserTooltips'];
  /** Delay before a rich AG Grid tooltip is shown. */
  tooltipShowDelay?: GridOptions['tooltipShowDelay'];
  /** Delay when switching directly between tooltip-enabled elements. */
  tooltipSwitchShowDelay?: GridOptions['tooltipSwitchShowDelay'];
  /** Delay before a rich AG Grid tooltip is hidden. */
  tooltipHideDelay?: GridOptions['tooltipHideDelay'];
  /** Make rich tooltips follow the mouse pointer. */
  tooltipMouseTrack?: GridOptions['tooltipMouseTrack'];
  /** Allow interaction with rich tooltip content. */
  tooltipInteraction?: GridOptions['tooltipInteraction'];

  /** Disable focus navigation into grid cells. */
  suppressCellFocus?: GridOptions['suppressCellFocus'];
  /** Disable focus navigation into grid headers. */
  suppressHeaderFocus?: GridOptions['suppressHeaderFocus'];
  /** Allow native browser text selection inside cells. */
  enableCellTextSelection?: GridOptions['enableCellTextSelection'];
  /** Keep rendered row/cell DOM order aligned with visual order for accessibility needs. */
  ensureDomOrder?: GridOptions['ensureDomOrder'];
}

/**
 * Reusable configuration for one field/column exposed by an entity.
 *
 * Native JSON-safe AG Grid concepts are deliberately flat and keep their AG Grid property names. A
 * custom descriptor exists only when the persisted value cannot have AG Grid's executable semantics.
 * For example `valueFormatterKey` and `valueParserKey` select frontend functions; they are not raw AG
 * Grid expressions/functions from backend JSON.
 *
 * @typeParam TColId Stable AG Grid column/configuration identity type.
 * @typeParam TFieldPath Row/API value path bound to `ColDef.field`.
 * @typeParam TLabelKey Allowed translation-key type for the column label.
 * @typeParam TCellDataType Supported AG Grid cell data type for this field.
 * @typeParam TAdditionalFilterOption Feature-specific server filter options, if any.
 * @typeParam TCellEditorName Allowed AG Grid provided/registered editor names.
 * @typeParam TCellRendererName Allowed AG Grid provided/registered renderer names.
 * @typeParam TValueFormatterKey Allowed frontend formatter registry keys.
 * @typeParam TValueParserKey Allowed frontend parser registry keys.
 */
export interface FieldDefinition<
  TColId extends NonNullable<ColDef['colId']> = NonNullable<ColDef['colId']>,
  TFieldPath extends string = string,
  TLabelKey extends string = string,
  TCellDataType extends FieldCellDataType = FieldCellDataType,
  TAdditionalFilterOption extends string = never,
  TCellEditorName extends string = string,
  TCellRendererName extends string = string,
  TValueFormatterKey extends string = string,
  TValueParserKey extends string = string,
> extends ConfigurableNativeColDefOptions<TCellEditorName, TCellRendererName> {
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
   * Translation key resolved by the frontend into final AG Grid header text.
   *
   * This intentionally does not use `headerName`: AG Grid `headerName` is already display text whereas
   * this application value must first go through translation.
   */
  labelKey: TLabelKey;

  /**
   * AG Grid cell data type/representation, supplied to `ColDef.cellDataType`.
   * Native data-type behavior remains the baseline before explicit field overrides are compiled.
   */
  cellDataType: TCellDataType;

  /**
   * Optional server-supported filtering descriptor.
   * Omission means this configurable field does not expose server filtering.
   */
  filtering?: FieldFilteringDefinition<
    FilterOptionForCellDataType<TCellDataType> | TAdditionalFilterOption
  >;

  /**
   * Frontend registry key resolved to the executable AG Grid `valueFormatter`.
   * Raw formatter functions/AG Grid expression strings are never accepted from persisted JSON.
   */
  valueFormatterKey?: TValueFormatterKey;

  /**
   * Extra JSON-safe application configuration consumed by the registered formatter implementation.
   * AG Grid itself has no `valueFormatterParams` `ColDef` property, so this name remains explicit.
   */
  valueFormatterConfig?: ConfigurationJsonObject;

  /**
   * Frontend registry key resolved to the executable AG Grid `valueParser`.
   * If omitted, the compiler leaves the parser supplied by `cellDataType` intact where applicable.
   */
  valueParserKey?: TValueParserKey;

  /**
   * Extra JSON-safe application configuration consumed by the registered parser implementation.
   * AG Grid supplies normal `ValueParserParams` at runtime; this object is additional app config.
   */
  valueParserConfig?: ConfigurationJsonObject;
}

type ConfigurableFieldDefinition<TLabelKey extends string = string> = FieldDefinition<
  NonNullable<ColDef['colId']>,
  string,
  TLabelKey,
  FieldCellDataType,
  string,
  string,
  string,
  string,
  string
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

  /** Stable business-row identity definition used to build runtime AG Grid `getRowId`. */
  rowId: RowIdDefinition;

  /**
   * Entity-level native AG Grid overrides for the configurable SSRM root.
   *
   * The nested keys deliberately retain AG Grid `GridOptions` names. Application defaults are resolved
   * first, then these entity overrides are normalized/merged. `defaultColDef` lives here because it is
   * itself a GridOptions property; individual fields then use normal AG Grid column override precedence.
   */
  gridOptions?: ConfigurableSsrmGridOptions;

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
