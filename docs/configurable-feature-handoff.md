# Handoff: Configurable Feature + AG Grid Architecture

> **Status:** current architecture/design handoff for the configurable-feature work. This is not an implementation-complete document.
>
> Repository/source/docs are authoritative. Before changing code, inspect current GitHub state, read root `AGENTS.md`, then read `docs/configurable-feature-config-design-progress.md` for the latest exact resume point.

## 1. Scope

The repository already has proven Transaction grids using Client-Side, Infinite and Server-Side Row Models. The configurable work is a separate architecture experiment; do not destabilize those concrete grids merely to make the experiment possible.

The first configurable implementation remains **SSRM-only** unless the user explicitly changes direction. Backend metadata must not choose row model.

The business unit is feature/page + entity context:

```text
Review feature
├── "transaction" entity
├── "loan" entity
└── "finance" entity
```

The entity business/configuration identity is the key in `FeatureDefinition.entities`. `EntityDefinition<TLabelKey, TFieldDefinition>` itself is reusable and has no hard-coded knowledge of Transaction, Loan, Finance, etc.; those generics only narrow translation keys and field shape.

## 2. Mandatory normalization boundary

```text
frontend-supported configuration design
        ↓
may be persisted/managed using backend/database shape
        ↓
backend returns runtime JSON
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
compiler + registries + adapters
        ↓
AG Grid GridOptions / ColDef / callbacks / components
        ↓
concrete SSRM runtime
```

**Normalization remains even when backend/storage keys exactly match normalized frontend/AG Grid-aligned names.** Matching names only make the transformation identity-like; they do not make raw runtime data trusted configuration.

If storage naming changes later, transform once at this boundary. Example:

```text
backend: columnDefaults
→ normalizer
→ normalized frontend: defaultColDef
→ compiler
```

Compiler/grid code should not contain scattered backend-shape compatibility checks.

## 3. AG Grid naming/type rule

Use AG Grid vocabulary when the **concept and value semantics are the same**:

```text
same concept + same value semantics
→ AG Grid property name
→ derive/reuse AG Grid type where practical
```

If the persisted value only *selects* executable behavior, keep an explicit application descriptor:

```text
formatter: { key, params }
→ registry
→ actual AG Grid valueFormatter function
```

Do not call that descriptor `valueFormatter`, because an object containing a registry key is not the function AG Grid expects.

Current direct native names include:

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
filterOptions
cellRendererParams
cellEditorParams
cellEditorPopup
cellEditorPopupPosition
```

Current application/configuration names intentionally include:

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
registry key/custom params descriptors
```

## 4. Three configuration categories

### Native + declarative + JSON-safe

Validated normalized values may use AG Grid names/types directly where semantics match.

### Executable behavior selected by configuration

Persist a key plus JSON-safe params where required:

```text
formatter.key → registry → AG Grid valueFormatter
renderer.key  → registry → AG Grid cellRenderer
editor.key    → registry → AG Grid cellEditor
parser.key    → registry → AG Grid valueParser
```

Registry implementations should use real AG Grid callback/component types where practical.

### Runtime/compiler-owned infrastructure

Frontend creates values such as:

```text
serverSideDatasource
runtime context
compiled columnDefs
GridApi refs
lifecycle/event wiring
```

`dataAdapterKey` identifies the application data/API boundary; it does not persist a datasource object.

## 5. Current public type structure

Source of truth:

`frontend/src/shared/grid/configurable/configuration.types.ts`

```text
FeatureDefinition
└── entities: Record<entityKey, EntityDefinition>
    ├── labelKey
    ├── dataAdapterKey
    ├── rowId: RowIdDefinition
    ├── defaultColDef?: ConfigurableDefaultColDef
    └── fields: FieldDefinition[]
        ├── colId
        ├── field
        ├── labelKey
        ├── cellDataType
        ├── sortable?
        ├── filtering?: FieldFilteringDefinition
        ├── initialHide?
        ├── initialPinned?
        ├── initialWidth?
        ├── initialFlex?
        ├── minWidth?
        ├── maxWidth?
        ├── resizable?
        ├── formatter?: FieldFormatterDefinition
        ├── renderer?: FieldRendererDefinition
        └── editing?: FieldEditingDefinition
            ├── editor?: FieldEditorDefinition
            └── parser?: FieldValueParserDefinition
```

## 6. Stable column identity vs API field path

```text
field.colId
→ AG Grid ColDef.colId
→ stable Column ID used by Grid State/API
→ application edit/conflict/validation identity

field.field
→ AG Grid ColDef.field
→ current API row value path
```

They may differ. Explicit `colId` prevents a backend field-path rename from silently changing logical column identity or restoring saved state onto the wrong logical column.

## 7. Defaults

```text
shared baseDefaultColDef
        +
entity.defaultColDef
        ↓
resolved AG Grid defaultColDef
        ↓
individual compiled field ColDef overrides
```

`ConfigurableDefaultColDef` is intentionally bounded. Using the native property name does not mean arbitrary `ColDef` callbacks/components can be persisted.

Current supported default leaves:

```text
sortable
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
```

## 8. Layout/sizing cleanup

The previous `layout` and `sizing` wrapper objects have been removed. They added a second organization layer around values that already map directly to `ColDef`.

Fields now carry the native leaves directly:

```text
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
```

The earlier custom `initialWidth XOR initialFlex` restriction was also removed. Follow AG Grid's native width/flex semantics instead of inventing a separate sizing rule.

Use `initial*` properties where the intent is initial state so later user/Grid State changes are not continuously overwritten.

## 9. Filtering

The previous field shape:

```text
filter: { filterOptions: [...] }
```

was misleading because AG Grid `ColDef.filter` has different value semantics: it enables/selects a filter component.

Current normalized descriptor:

```ts
filtering?: {
  filterOptions: readonly [...];
}
```

Compiler meaning:

```text
filtering descriptor
→ enable appropriate AG Grid filter
→ filterOptions → filterParams.filterOptions
```

Only server-query operators supported end to end by the active adapter/backend contract should be exposed.

The existing server-backed grids prove shared filter UX such as Apply/Reset, `maxNumConditions: 1` and `closeOnApply: true`; filter defaults remain part of the upcoming grid-level design batch.

## 10. `cellDataType` native baseline

The configurable proof uses SSRM, so `cellDataType` is set explicitly because AG Grid inference is Client-Side Row Model only.

Current supported values:

```text
text
number
boolean
date           → JavaScript Date
dateString     → string date
dateTime       → JavaScript Date
dateTimeString → string date-time
```

Native parser/formatter/editor/renderer/filter behavior is the baseline. Do not require registry overrides when AG Grid already provides the needed behavior.

## 11. Formatter/renderer/editor/parser descriptors

Executable code stays frontend-owned behind registries.

```text
formatter.key                 → registry → ColDef.valueFormatter
renderer.key                  → registry → ColDef.cellRenderer
renderer.cellRendererParams   → ColDef.cellRendererParams
editor.key                    → registry → ColDef.cellEditor
editor.cellEditorParams       → ColDef.cellEditorParams
editor.cellEditorPopup        → ColDef.cellEditorPopup
editor.cellEditorPopupPosition→ ColDef.cellEditorPopupPosition
parser.key                    → registry → ColDef.valueParser
```

Formatter/parser `params` remain application-specific because AG Grid has no direct `valueFormatterParams` / `valueParserParams` ColDef property.

## 12. Editing/value stages

```text
editing omitted → not editable
editing present → potentially editable
```

Presence must not compile to unconditional `editable: true`. Runtime editability composes access/authorization, row policy, tracked-edit conflict policy and other hard constraints.

Keep these value stages distinct:

```text
1. authoritative API value
2. effective value (API or LOCAL overlay)
3. AG Grid cellDataType baseline
4. optional formatted/rendered display
5. editor candidate
6. native/custom valueParser output = LOCAL draft
7. validation
8. save mapping → backend payload
```

## 13. Existing editing/security architecture to preserve

The configurable runtime must reuse the proven tracked-editing/validation/conflict mechanics rather than building a second metadata-specific system.

Backend remains authoritative for:

- accessible config projection;
- field/row authorization;
- masking/unmask capability and state;
- server sort/filter/search semantics;
- business validation;
- save/action authorization and rejection;
- authoritative data.

Frontend consumes resolved access/config and provides UX; it does not duplicate backend authorization algorithms.

## 14. Data adapters

`dataAdapterKey` resolves the frontend adapter/service boundary for entity-specific transport concerns, including loading/saving/request-response mapping and any deliberate backend-wire normalization.

SSRM block loading remains datasource-owned; do not force TanStack Query into datasource loading for consistency.

## 15. Documentation

Public configuration contracts require:

1. useful JSDoc/IDE hover comments explaining responsibility and AG Grid mapping;
2. curated Markdown under `docs/configurable-feature/`;
3. source-generated TypeDoc Markdown under `docs/configurable-feature/generated/`.

TypeDoc tooling is installed/configured. Regenerate after every public contract/JSDoc change:

```bash
npm run docs:configurable
```

The portable text hierarchy in `docs/configurable-feature/type-hierarchy.md` remains the reliable visual reference; Mermaid is supplemental.

## 16. Working rules

Current design branch:

`configurable-feature-grid`

Do not create another branch, open a PR or merge unless explicitly requested. Existing concrete grids remain untouched during the design experiment unless the user explicitly moves into implementation.

Use AG Grid 36.1 as the implementation reference. Native AG Grid first. No universal wrapper/giant `useGrid`, no Docker/unrelated infrastructure, and no console logging merely to inspect flow.

## 17. Continuation

Read `docs/configurable-feature-config-design-progress.md` for the latest exact checkpoint and next design batch.
