import type {
  ConfigurableSsrmGridOptions,
  EntityDefinition,
  FeatureDefinition,
  FieldCellDataType,
  FieldDefinition,
} from './configuration.types';

type JsonObject = Record<string, unknown>;

const featureKeys = ['featureKey', 'entities'] as const;
const entityKeys = ['labelKey', 'dataAdapterKey', 'rowId', 'gridOptions', 'fields'] as const;
const fieldKeys = [
  'type', 'sortable', 'initialSort', 'initialSortIndex', 'sortingOrder', 'initialHide',
  'lockVisible', 'initialPinned', 'initialWidth', 'initialFlex', 'minWidth', 'maxWidth',
  'resizable', 'suppressSizeToFit', 'suppressAutoSize', 'suppressMovable', 'lockPosition',
  'lockPinned', 'wrapText', 'autoHeight', 'wrapHeaderText', 'autoHeaderHeight',
  'headerTooltip', 'tooltipField', 'floatingFilter', 'suppressHeaderMenuButton',
  'suppressHeaderFilterButton', 'suppressHeaderContextMenu', 'suppressFloatingFilterButton',
  'cellEditorPopup', 'cellEditorPopupPosition', 'singleClickEdit', 'useValueParserForImport',
  'useValueFormatterForExport', 'suppressFillHandle', 'editable', 'suppressNavigable',
  'suppressPaste', 'filter', 'filterParams', 'cellEditor', 'cellEditorParams', 'cellRenderer',
  'cellRendererParams', 'colId', 'field', 'labelKey', 'cellDataType', 'validationRules',
  'valueFormatterKey', 'valueFormatterConfig', 'valueParserKey', 'valueParserConfig',
] as const;
const defaultColDefKeys = fieldKeys.filter((key) =>
  !['colId', 'field', 'labelKey', 'cellDataType', 'validationRules', 'valueFormatterKey',
    'valueFormatterConfig', 'valueParserKey', 'valueParserConfig'].includes(key),
);
const gridOptionKeys = [
  'pagination', 'paginationAutoPageSize', 'paginationPageSize', 'paginationPageSizeSelector',
  'suppressPaginationPanel', 'cacheBlockSize', 'maxBlocksInCache', 'blockLoadDebounceMillis',
  'maxConcurrentDatasourceRequests', 'serverSideInitialRowCount',
  'suppressServerSideFullWidthLoadingRow', 'invalidEditValueMode', 'singleClickEdit',
  'suppressClickEdit', 'enterNavigatesVertically', 'enterNavigatesVerticallyAfterEdit',
  'stopEditingWhenCellsLoseFocus', 'undoRedoCellEditing', 'undoRedoCellEditingLimit',
  'suppressClipboardPaste', 'suppressMovableColumns', 'suppressMoveWhenColumnDragging',
  'suppressColumnMoveAnimation', 'suppressDragLeaveHidesColumns', 'rowHeight', 'rowBuffer',
  'headerHeight', 'animateRows', 'enableRtl', 'enableBrowserTooltips', 'tooltipShowDelay',
  'tooltipSwitchShowDelay', 'tooltipHideDelay', 'tooltipMouseTrack', 'tooltipInteraction',
  'suppressCellFocus', 'suppressHeaderFocus', 'enableCellTextSelection', 'ensureDomOrder',
  'defaultColDef', 'rowSelection', 'cellSelection',
] as const;

const cellDataTypes = new Set<FieldCellDataType>([
  'text', 'number', 'bigint', 'boolean', 'date', 'dateString', 'dateTime', 'dateTimeString', 'object',
]);
const filterOptions: Record<string, ReadonlySet<string>> = {
  text: new Set(['contains', 'equals', 'notEqual', 'startsWith', 'endsWith']),
  number: new Set(['equals', 'notEqual', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual']),
  bigint: new Set(['equals', 'notEqual', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual']),
  boolean: new Set(['equals', 'notEqual']),
  date: new Set(['equals', 'notEqual', 'lessThan', 'greaterThan']),
  dateString: new Set(['equals', 'notEqual', 'lessThan', 'greaterThan']),
  dateTime: new Set(['equals', 'notEqual', 'lessThan', 'greaterThan']),
  dateTimeString: new Set(['equals', 'notEqual', 'lessThan', 'greaterThan']),
  object: new Set(),
};

function invalid(path: string, message: string): never {
  throw new Error(`Invalid configurable grid JSON at ${path}: ${message}`);
}

function isObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function object(value: unknown, path: string): asserts value is JsonObject {
  if (!isObject(value)) invalid(path, 'expected an object.');
}

function string(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') invalid(path, 'expected a non-empty string.');
}

function bool(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') invalid(path, 'expected a boolean.');
}

function number(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number.');
}

function knownKeys(value: JsonObject, keys: readonly string[], path: string) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid(`${path}.${key}`, 'property is not supported by the normalized contract.');
  }
}

function jsonSafe(value: unknown, path: string): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => jsonSafe(item, `${path}[${index}]`));
    return;
  }

  if (isObject(value)) {
    Object.entries(value).forEach(([key, item]) => jsonSafe(item, `${path}.${key}`));
    return;
  }

  invalid(path, 'value must be JSON-safe; executable/runtime values are rejected.');
}

function validateFilterParams(value: unknown, path: string, cellDataType?: FieldCellDataType) {
  object(value, path);
  const common = ['buttons', 'closeOnApply', 'debounceMs', 'readOnly', 'filterPlaceholder', 'maxNumConditions'];
  const specific =
    cellDataType === 'text' ? ['filterOptions', 'defaultOption', 'trimInput'] :
    cellDataType === 'number' || cellDataType === 'bigint' ? ['filterOptions', 'defaultOption', 'allowedCharPattern'] :
    cellDataType && ['date', 'dateString', 'dateTime', 'dateTimeString'].includes(cellDataType)
      ? ['filterOptions', 'defaultOption', 'browserDatePicker', 'minValidYear', 'maxValidYear', 'minValidDate', 'maxValidDate']
      : cellDataType === 'boolean' ? ['filterOptions', 'defaultOption'] : [];
  knownKeys(value, [...common, ...specific], path);

  if (value.maxNumConditions !== undefined && value.maxNumConditions !== 1) {
    invalid(`${path}.maxNumConditions`, 'must be exactly 1 for the current server-query contract.');
  }
  for (const key of ['closeOnApply', 'readOnly', 'trimInput', 'browserDatePicker']) {
    if (value[key] !== undefined) bool(value[key], `${path}.${key}`);
  }
  for (const key of ['debounceMs', 'minValidYear', 'maxValidYear']) {
    if (value[key] !== undefined) number(value[key], `${path}.${key}`);
  }
  for (const key of ['filterPlaceholder', 'allowedCharPattern', 'minValidDate', 'maxValidDate']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      invalid(`${path}.${key}`, 'expected a string.');
    }
  }
  if (value.buttons !== undefined) {
    if (!Array.isArray(value.buttons)) invalid(`${path}.buttons`, 'expected an array.');
    for (const button of value.buttons) {
      if (!['apply', 'clear', 'reset', 'cancel'].includes(String(button))) {
        invalid(`${path}.buttons`, `unsupported Simple Filter button "${String(button)}".`);
      }
    }
  }

  const allowedOptions = cellDataType ? filterOptions[cellDataType] : undefined;
  for (const key of ['filterOptions', 'defaultOption'] as const) {
    const configured = value[key];
    if (configured === undefined) continue;
    if (!allowedOptions) invalid(`${path}.${key}`, 'type-specific filter options are not valid here.');
    const candidates = key === 'filterOptions' ? configured : [configured];
    if (!Array.isArray(candidates)) invalid(`${path}.${key}`, 'expected an array.');
    for (const option of candidates) {
      if (typeof option !== 'string' || !allowedOptions.has(option)) {
        invalid(`${path}.${key}`, `unsupported filter option "${String(option)}".`);
      }
    }
  }
}

function validateColumnOptions(value: JsonObject, path: string, keys: readonly string[], cellDataType?: FieldCellDataType) {
  knownKeys(value, keys, path);
  const booleans = [
    'sortable', 'initialHide', 'lockVisible', 'resizable', 'suppressSizeToFit', 'suppressAutoSize',
    'suppressMovable', 'lockPinned', 'wrapText', 'autoHeight', 'wrapHeaderText', 'autoHeaderHeight',
    'floatingFilter', 'suppressHeaderMenuButton', 'suppressHeaderFilterButton',
    'suppressHeaderContextMenu', 'suppressFloatingFilterButton', 'cellEditorPopup',
    'singleClickEdit', 'useValueParserForImport', 'useValueFormatterForExport', 'suppressFillHandle',
    'editable', 'suppressNavigable', 'suppressPaste',
  ];
  const numbers = ['initialSortIndex', 'initialWidth', 'initialFlex', 'minWidth', 'maxWidth'];
  booleans.forEach((key) => value[key] === undefined || bool(value[key], `${path}.${key}`));
  numbers.forEach((key) => value[key] === undefined || number(value[key], `${path}.${key}`));

  for (const key of ['headerTooltip', 'tooltipField', 'cellEditor', 'cellRenderer']) {
    if (value[key] !== undefined) string(value[key], `${path}.${key}`);
  }
  if (value.type !== undefined) {
    if (typeof value.type !== 'string') {
      if (!Array.isArray(value.type) || value.type.some((item) => typeof item !== 'string')) {
        invalid(`${path}.type`, 'expected a string or array of strings.');
      }
    }
  }
  if (value.initialSort !== undefined && value.initialSort !== null && !['asc', 'desc'].includes(String(value.initialSort))) {
    invalid(`${path}.initialSort`, 'expected "asc", "desc", or null.');
  }
  if (value.sortingOrder !== undefined) {
    if (!Array.isArray(value.sortingOrder)) invalid(`${path}.sortingOrder`, 'expected an array.');
    value.sortingOrder.forEach((item, index) => {
      if (item !== null && typeof item !== 'object' && !['asc', 'desc'].includes(String(item))) {
        invalid(`${path}.sortingOrder[${index}]`, 'expected a native sort direction/definition.');
      }
    });
  }
  if (value.initialPinned !== undefined && value.initialPinned !== null && !['left', 'right'].includes(String(value.initialPinned))) {
    invalid(`${path}.initialPinned`, 'expected "left", "right", or null.');
  }
  if (value.lockPosition !== undefined && typeof value.lockPosition !== 'boolean' && !['left', 'right'].includes(String(value.lockPosition))) {
    invalid(`${path}.lockPosition`, 'expected a boolean, "left", or "right".');
  }
  if (value.filter !== undefined && typeof value.filter !== 'boolean' && typeof value.filter !== 'string') {
    invalid(`${path}.filter`, 'expected a boolean or registered filter name.');
  }
  if (value.filterParams !== undefined) validateFilterParams(value.filterParams, `${path}.filterParams`, cellDataType);
  for (const key of ['cellEditorParams', 'cellRendererParams']) {
    if (value[key] !== undefined) {
      object(value[key], `${path}.${key}`);
      jsonSafe(value[key], `${path}.${key}`);
    }
  }
  if (value.cellEditorPopupPosition !== undefined && value.cellEditorPopupPosition !== 'over' && value.cellEditorPopupPosition !== 'under') {
    invalid(`${path}.cellEditorPopupPosition`, 'expected "over" or "under".');
  }
}

function validateRowSelection(value: unknown, path: string) {
  object(value, path);
  string(value.mode, `${path}.mode`);
  const common = ['mode', 'enableClickSelection', 'checkboxLocation', 'hideDisabledCheckboxes', 'copySelectedRows', 'enableSelectionWithoutKeys', 'checkboxes'];
  const multi = ['headerCheckbox', 'ctrlASelectsRows', 'selectAll'];
  if (value.mode === 'singleRow') knownKeys(value, common, path);
  else if (value.mode === 'multiRow') knownKeys(value, [...common, ...multi], path);
  else invalid(`${path}.mode`, 'expected "singleRow" or "multiRow".');

  if (
    value.enableClickSelection !== undefined &&
    typeof value.enableClickSelection !== 'boolean' &&
    value.enableClickSelection !== 'enableSelection' &&
    value.enableClickSelection !== 'enableDeselection'
  ) {
    invalid(`${path}.enableClickSelection`, 'expected a boolean, "enableSelection", or "enableDeselection".');
  }
  if (
    value.checkboxLocation !== undefined &&
    value.checkboxLocation !== 'selectionColumn' &&
    value.checkboxLocation !== 'autoGroupColumn'
  ) {
    invalid(`${path}.checkboxLocation`, 'expected "selectionColumn" or "autoGroupColumn".');
  }
  for (const key of ['hideDisabledCheckboxes', 'copySelectedRows', 'enableSelectionWithoutKeys', 'checkboxes', 'headerCheckbox', 'ctrlASelectsRows']) {
    if (value[key] !== undefined) bool(value[key], `${path}.${key}`);
  }
  if (value.selectAll !== undefined && value.selectAll !== 'all') {
    invalid(`${path}.selectAll`, 'flat SSRM configuration supports only native selectAll="all".');
  }
}

function validateCellSelection(value: unknown, path: string) {
  if (typeof value === 'boolean') return;
  object(value, path);
  knownKeys(value, ['suppressMultiRanges', 'enableHeaderHighlight', 'enableColumnSelection', 'handle'], path);
  for (const key of ['suppressMultiRanges', 'enableHeaderHighlight', 'enableColumnSelection']) {
    if (value[key] !== undefined) bool(value[key], `${path}.${key}`);
  }
  if (value.handle === undefined) return;
  object(value.handle, `${path}.handle`);
  string(value.handle.mode, `${path}.handle.mode`);
  if (value.handle.mode === 'range') {
    knownKeys(value.handle, ['mode'], `${path}.handle`);
    return;
  }
  if (value.handle.mode !== 'fill') invalid(`${path}.handle.mode`, 'expected "range" or "fill".');
  knownKeys(value.handle, ['mode', 'suppressClearOnFillReduction', 'direction'], `${path}.handle`);
  if (value.handle.suppressClearOnFillReduction !== undefined) {
    bool(value.handle.suppressClearOnFillReduction, `${path}.handle.suppressClearOnFillReduction`);
  }
  if (value.handle.direction !== undefined && !['x', 'y', 'xy'].includes(String(value.handle.direction))) {
    invalid(`${path}.handle.direction`, 'expected "x", "y", or "xy".');
  }
}

function validateGridOptions(value: unknown, path: string) {
  object(value, path);
  jsonSafe(value, path);
  knownKeys(value, gridOptionKeys, path);

  const booleans = [
    'pagination', 'paginationAutoPageSize', 'suppressPaginationPanel',
    'suppressServerSideFullWidthLoadingRow', 'singleClickEdit', 'suppressClickEdit',
    'enterNavigatesVertically', 'enterNavigatesVerticallyAfterEdit', 'stopEditingWhenCellsLoseFocus',
    'undoRedoCellEditing', 'suppressClipboardPaste', 'suppressMovableColumns',
    'suppressMoveWhenColumnDragging', 'suppressColumnMoveAnimation', 'suppressDragLeaveHidesColumns',
    'animateRows', 'enableRtl', 'enableBrowserTooltips', 'tooltipMouseTrack', 'tooltipInteraction',
    'suppressCellFocus', 'suppressHeaderFocus', 'enableCellTextSelection', 'ensureDomOrder',
  ];
  const numbers = [
    'paginationPageSize', 'cacheBlockSize', 'maxBlocksInCache', 'blockLoadDebounceMillis',
    'maxConcurrentDatasourceRequests', 'serverSideInitialRowCount', 'undoRedoCellEditingLimit',
    'rowHeight', 'rowBuffer', 'headerHeight', 'tooltipShowDelay', 'tooltipSwitchShowDelay',
    'tooltipHideDelay',
  ];
  booleans.forEach((key) => value[key] === undefined || bool(value[key], `${path}.${key}`));
  numbers.forEach((key) => value[key] === undefined || number(value[key], `${path}.${key}`));

  if (value.paginationPageSizeSelector !== undefined && typeof value.paginationPageSizeSelector !== 'boolean') {
    if (!Array.isArray(value.paginationPageSizeSelector)) invalid(`${path}.paginationPageSizeSelector`, 'expected a boolean or number array.');
    value.paginationPageSizeSelector.forEach((item, index) => number(item, `${path}.paginationPageSizeSelector[${index}]`));
  }
  if (value.invalidEditValueMode !== undefined && value.invalidEditValueMode !== 'revert' && value.invalidEditValueMode !== 'block') {
    invalid(`${path}.invalidEditValueMode`, 'expected "revert" or "block".');
  }
  if (value.defaultColDef !== undefined) {
    object(value.defaultColDef, `${path}.defaultColDef`);
    validateColumnOptions(value.defaultColDef, `${path}.defaultColDef`, defaultColDefKeys);
  }
  if (value.rowSelection !== undefined) validateRowSelection(value.rowSelection, `${path}.rowSelection`);
  if (value.cellSelection !== undefined) validateCellSelection(value.cellSelection, `${path}.cellSelection`);
}

function validateField(value: unknown, path: string) {
  object(value, path);
  jsonSafe(value, path);
  string(value.cellDataType, `${path}.cellDataType`);
  if (!cellDataTypes.has(value.cellDataType as FieldCellDataType)) {
    invalid(`${path}.cellDataType`, `unsupported AG Grid base cell data type "${value.cellDataType}".`);
  }
  validateColumnOptions(value, path, fieldKeys, value.cellDataType as FieldCellDataType);
  string(value.colId, `${path}.colId`);
  string(value.field, `${path}.field`);
  string(value.labelKey, `${path}.labelKey`);

  if (value.validationRules !== undefined) {
    if (!Array.isArray(value.validationRules)) invalid(`${path}.validationRules`, 'expected an array.');
    value.validationRules.forEach((rule, index) => {
      const rulePath = `${path}.validationRules[${index}]`;
      object(rule, rulePath);
      knownKeys(rule, ['key', 'params', 'message'], rulePath);
      string(rule.key, `${rulePath}.key`);
      if (rule.params !== undefined) {
        object(rule.params, `${rulePath}.params`);
        jsonSafe(rule.params, `${rulePath}.params`);
      }
      if (rule.message !== undefined && typeof rule.message !== 'string') invalid(`${rulePath}.message`, 'expected a string.');
    });
  }
  for (const key of ['valueFormatterKey', 'valueParserKey']) {
    if (value[key] !== undefined) string(value[key], `${path}.${key}`);
  }
  for (const key of ['valueFormatterConfig', 'valueParserConfig']) {
    if (value[key] !== undefined) {
      object(value[key], `${path}.${key}`);
      jsonSafe(value[key], `${path}.${key}`);
    }
  }
}

function validateEntity(value: unknown, path: string) {
  object(value, path);
  jsonSafe(value, path);
  knownKeys(value, entityKeys, path);
  string(value.labelKey, `${path}.labelKey`);
  string(value.dataAdapterKey, `${path}.dataAdapterKey`);
  object(value.rowId, `${path}.rowId`);
  knownKeys(value.rowId, ['path'], `${path}.rowId`);
  string(value.rowId.path, `${path}.rowId.path`);
  if (value.gridOptions !== undefined) validateGridOptions(value.gridOptions, `${path}.gridOptions`);
  if (!Array.isArray(value.fields) || value.fields.length === 0) invalid(`${path}.fields`, 'expected at least one field.');

  const ids = new Set<string>();
  value.fields.forEach((field, index) => {
    validateField(field, `${path}.fields[${index}]`);
    const id = (field as JsonObject).colId as string;
    if (ids.has(id)) invalid(`${path}.fields[${index}].colId`, `duplicate column id "${id}".`);
    ids.add(id);
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Mandatory `unknown` backend/storage boundary for the complete feature definition. */
export function normalizeFeatureDefinition(raw: unknown): FeatureDefinition {
  object(raw, 'feature');
  jsonSafe(raw, 'feature');
  knownKeys(raw, featureKeys, 'feature');
  string(raw.featureKey, 'feature.featureKey');
  object(raw.entities, 'feature.entities');
  if (Object.keys(raw.entities).length === 0) invalid('feature.entities', 'expected at least one entity.');
  Object.entries(raw.entities).forEach(([key, entity]) => validateEntity(entity, `feature.entities.${key}`));
  return clone(raw) as unknown as FeatureDefinition;
}

export function normalizeEntityDefinition(raw: unknown): EntityDefinition {
  validateEntity(raw, 'entity');
  return clone(raw) as unknown as EntityDefinition;
}

export function normalizeConfigurableSsrmGridOptions(raw: unknown): ConfigurableSsrmGridOptions {
  validateGridOptions(raw, 'gridOptions');
  return clone(raw) as unknown as ConfigurableSsrmGridOptions;
}

export function normalizeFieldDefinition(raw: unknown): FieldDefinition {
  validateField(raw, 'field');
  return clone(raw) as unknown as FieldDefinition;
}
