# Configurable Feature Configuration Reference

Public reference for `frontend/src/shared/grid/configurable/configuration.types.ts`.

The configurable runtime/compiler is not wired yet. This document defines the normalized frontend contract that runtime code must eventually validate and compile. Configuration may be persisted by the backend, but raw backend/storage JSON is never passed directly to AG Grid.

Quick visual reference: [`type-hierarchy.md`](type-hierarchy.md).

## Core boundary: backend shape is not the grid contract

```text
frontend-supported configuration design
        ↓
may be stored/managed using backend/database shape
        ↓
backend returns runtime JSON
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
resolve registries + compile runtime behavior
        ↓
AG Grid GridOptions / ColDef / callbacks / components
```

Normalization remains mandatory even when backend/storage property names happen to match the normalized frontend names exactly. Matching names only make a mapping identity-like; they do not make backend JSON trusted configuration.

The backend may later rename or restructure a value. For example, storage could call something `columnDefaults` while the normalized frontend contract still exposes `defaultColDef`. The normalizer maps the wire/storage value once; downstream compiler/grid code sees only the normalized property.

A backend property that the deployed frontend does not validate/normalize/compile has no effect. Unknown required registry keys and invalid supported values must fail clearly.

## AG Grid naming/type rule

Use the AG Grid name and compatible AG Grid type when **both the concept and value semantics are the same**.

```text
same concept + same value semantics
→ AG Grid property name
→ derive/reuse AG Grid type where practical

same eventual AG Grid destination but different persisted semantics
→ application/configuration name
→ normalize/resolve/compile
→ final native AG Grid property

application/business concept
→ application name
```

Examples of direct native alignment in the current contract:

```text
colId
field
cellDataType
sortable
defaultColDef
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
filterOptions              (AG Grid filterParams.filterOptions leaf)
cellRendererParams
cellEditorParams
cellEditorPopup
cellEditorPopupPosition
```

Examples that deliberately remain application/configuration concepts:

```text
featureKey
entities
labelKey
dataAdapterKey
rowId
filtering
formatter
renderer
editing
registry key / custom params descriptors
```

The difference matters. A persisted formatter registry key is not an AG Grid `ValueFormatterFunc`, so calling the descriptor `valueFormatter` would falsely imply it can be passed through directly.

## Three categories of configuration

### 1. Native + declarative + JSON-safe AG Grid values

Supported native values keep AG Grid names/types and can be merged into the final grid configuration after validation/normalization.

### 2. Executable behavior selected by configuration

Functions/components cannot be stored safely as JSON. Persist a stable key plus JSON-safe parameters where needed:

```text
formatter.key → formatter registry → AG Grid valueFormatter
renderer.key  → renderer registry  → AG Grid cellRenderer
editor.key    → editor registry    → AG Grid cellEditor
parser.key    → parser registry    → AG Grid valueParser
```

Registry implementations should use the real AG Grid callback/component types where practical.

### 3. Runtime/compiler-owned infrastructure

The frontend runtime constructs values such as:

```text
serverSideDatasource
runtime context
compiled columnDefs
GridApi refs
lifecycle handlers
```

Those are not arbitrary persisted configuration.

## `FeatureDefinition`

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
  TEntityDefinition extends EntityDefinition = EntityDefinition,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, TEntityDefinition>;
}
```

The important business identity is the key of `entities`.

Conceptually:

```ts
type ReviewFeature = FeatureDefinition<
  'review',
  'transaction' | 'loan'
>;
```

That means:

```text
review
├── transaction → EntityDefinition
└── loan        → EntityDefinition
```

`EntityDefinition` itself is intentionally reusable and does not hard-code Transaction, Loan, Finance, or another business entity.

## `EntityDefinition`

```ts
interface EntityDefinition<TLabelKey, TFieldDefinition> {
  labelKey: TLabelKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  defaultColDef?: ConfigurableDefaultColDef;
  fields: readonly TFieldDefinition[];
}
```

The generic parameters are **typing constraints**, not business identity:

- `TLabelKey` narrows which translation keys a concrete entity is allowed to use;
- `TFieldDefinition` narrows the concrete field shape allowed in `fields`;
- the entity name/identity such as `transaction` comes from the containing `FeatureDefinition.entities` record key.

### `labelKey`

Application translation key. It intentionally does not use AG Grid `headerName`, because `headerName` is the final display string while `labelKey` must first be resolved through translation.

### `dataAdapterKey`

Application-owned key resolving the frontend data/API adapter for loading, saving, request/response mapping and transport differences. It is not an AG Grid property.

### `rowId`

Declarative description of where stable business row identity lives. The runtime later builds executable AG Grid `getRowId` behavior from it.

### `defaultColDef`

This name now deliberately matches AG Grid `defaultColDef` because the normalized values have the same semantics.

```text
shared baseDefaultColDef
        +
entity.defaultColDef
        ↓
resolved AG Grid defaultColDef
        ↓
individual compiled field ColDef overrides
```

The type is still bounded; using the native name does not expose arbitrary `ColDef` callbacks/components/runtime values to persisted JSON.

## `ConfigurableDefaultColDef`

Current supported subset:

```ts
interface ConfigurableDefaultColDef {
  sortable?: ColDef['sortable'];
  initialHide?: ColDef['initialHide'];
  initialPinned?: ...;
  initialWidth?: ColDef['initialWidth'];
  initialFlex?: ColDef['initialFlex'];
  minWidth?: ColDef['minWidth'];
  maxWidth?: ColDef['maxWidth'];
  resizable?: ColDef['resizable'];
}
```

These are native AG Grid values. The later grid/filter-default design may expand this bounded subset where end-to-end semantics are supported.

## `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

`path` supports dot notation and has no implicit `id` fallback. It stays custom because persisted JSON can safely carry a path, not the executable AG Grid `getRowId` callback.

## `FieldDefinition`

```ts
interface FieldDefinition<...> {
  colId: TColId;
  field: TFieldPath;
  labelKey: TLabelKey;
  cellDataType: TCellDataType;
  sortable?: ColDef['sortable'];
  filtering?: FieldFilteringDefinition<...>;
  initialHide?: ColDef['initialHide'];
  initialPinned?: ...;
  initialWidth?: ColDef['initialWidth'];
  initialFlex?: ColDef['initialFlex'];
  minWidth?: ColDef['minWidth'];
  maxWidth?: ColDef['maxWidth'];
  resizable?: ColDef['resizable'];
  formatter?: FieldFormatterDefinition<...>;
  renderer?: FieldRendererDefinition<...>;
  editing?: FieldEditingDefinition<...>;
}
```

### `colId` vs `field`

```text
field.colId
→ AG Grid ColDef.colId
→ stable column identity for Grid State/API/sort/filter identity
→ stable application edit/conflict/validation identity

field.field
→ AG Grid ColDef.field
→ actual API/row value path
```

They may differ. The configurable contract requires explicit `colId` so stable column identity does not accidentally change when a backend/API field path is renamed.

AG Grid Grid State is keyed by Column ID, which is why this distinction matters for restoring sizes, visibility, order, pinning and sorting.

### `labelKey`

Custom application key that compiles to translated `ColDef.headerName`. It is not renamed to `headerName` because the stored value is not the final header string.

### `cellDataType`

Same name/semantics as `ColDef.cellDataType`. Current supported values:

```text
text
number
boolean
date           → JavaScript Date
dateString     → string date
dateTime       → JavaScript Date
dateTimeString → string date-time
```

The configurable proof is SSRM, so the compiler sets this explicitly; AG Grid cell-data-type inference is Client-Side Row Model only.

### Native layout/sizing leaves

The old `layout` / `sizing` wrappers have been removed. They did not represent separate AG Grid concepts and forced unnecessary mapping.

The normalized field now exposes the native leaves directly:

```text
initialHide   → ColDef.initialHide
initialPinned → ColDef.initialPinned
initialWidth  → ColDef.initialWidth
initialFlex   → ColDef.initialFlex
minWidth      → ColDef.minWidth
maxWidth      → ColDef.maxWidth
resizable     → ColDef.resizable
```

`initial*` values seed a new column without repeatedly overwriting later user/Grid State changes. Persistent constraints such as `minWidth`, `maxWidth` and `resizable` continue to apply.

No custom XOR rule is imposed on `initialWidth` and `initialFlex`; the normalized contract follows AG Grid's native width/flex semantics instead of inventing a parallel sizing model.

## Filtering

The earlier contract used:

```ts
filter: { filterOptions: [...] }
```

That was misleading because AG Grid `ColDef.filter` does **not** have those object semantics. It selects/enables the filter component.

The normalized application descriptor is now intentionally named `filtering`:

```ts
interface FieldFilteringDefinition<TFilterOption extends string = FilterOption> {
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}
```

Compiler meaning:

```text
field.filtering
→ enable the appropriate AG Grid filter
→ supply field.filtering.filterOptions through filterParams.filterOptions
```

```text
filtering omitted → configurable contract does not expose this field as filterable
filtering present → exact non-empty supported operator list
```

Shared server-query vocabulary currently supports:

```text
text:    contains, equals, notEqual, startsWith, endsWith
number:  equals, notEqual, greaterThan, greaterThanOrEqual,
         lessThan, lessThanOrEqual
date/dateString/dateTime/dateTimeString:
         equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

Do not expose additional AG Grid filter semantics until the active adapter/backend request contract supports them end to end.

## Formatter

```ts
formatter?: {
  key: string;
  params?: ConfigurationJsonObject;
}
```

This remains custom because the persisted value is a registry descriptor, not `ColDef.valueFormatter` executable behavior.

```text
formatter.key
→ frontend registry
→ AG Grid-compatible valueFormatter implementation
→ ColDef.valueFormatter
```

AG Grid supplies normal `ValueFormatterParams`; configured `params` are additional application inputs.

## Renderer

```ts
renderer?: {
  key: string;
  cellRendererParams?: ConfigurationJsonObject;
}
```

The descriptor remains custom because `key` resolves frontend-owned executable behavior. The parameter leaf uses the native AG Grid name because it has the same purpose:

```text
renderer.key                → registry → ColDef.cellRenderer
renderer.cellRendererParams → ColDef.cellRendererParams
```

AG Grid still supplies normal runtime renderer props such as value, data, node, column, colDef and api.

## Editing / editor / parser

`editing` remains an application concept:

```text
editing omitted → not editable
editing present → potentially editable
```

Presence is not equivalent to unconditional `ColDef.editable = true`. Runtime editability must still satisfy access/authorization, row policy and tracked-edit conflict policy.

Editor descriptor:

```text
editor.key                     → registry → ColDef.cellEditor
editor.cellEditorParams        → ColDef.cellEditorParams
editor.cellEditorPopup         → ColDef.cellEditorPopup
editor.cellEditorPopupPosition → ColDef.cellEditorPopupPosition
```

Parser descriptor:

```text
parser.key → registry → ColDef.valueParser
```

Parser `params` stay custom because AG Grid has no `valueParserParams` ColDef property. If no custom parser is configured, the compiler leaves AG Grid's cell-data-type parser intact where available.

Parser output is a LOCAL draft value, not the backend save payload.

## Value stages

```text
1. authoritative API value
2. effective grid value (API or LOCAL overlay)
3. AG Grid cellDataType baseline behavior
4. optional custom formatted/rendered display
5. editor-produced candidate
6. native/custom valueParser output = LOCAL draft
7. validation
8. save mapping → backend payload          [later]
```

Do not collapse these stages.

## Strong frontend typing vs runtime JSON

TypeScript generics narrow frontend-authored configuration, but backend JSON is still runtime data. It must pass schema/version/value/registry validation and normalization before compilation.

```text
backend key happens to equal normalized key
→ normalize/validate anyway

backend key differs later
→ map it once in normalizer
→ normalized compiler contract stays stable
```

## Separate future contracts

Still to design:

- broad table/grid-level SSRM declarative option surface and app/entity merge rules;
- filter defaults/table-level Simple Filter behavior;
- exact registry key-to-params and AG Grid implementation typing;
- validation declarations;
- server sort/filter/search mapping and searchability;
- save/request mapping;
- access/masking resolution;
- action/business-operation configuration;
- runtime config versioning/schema validation/normalization implementation;
- final compiler composition.
