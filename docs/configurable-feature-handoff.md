# Handoff: Configurable Feature + AG Grid Architecture

> **Status:** current architecture/design handoff for the configurable-feature work. This is not an implementation-complete document.
>
> **Project conversation checkpoint:** this consolidated handoff reflects the decisions through **Chat 5**. Repository/source/docs remain authoritative; a future chat should not rely on chat memory alone.
>
> Before changing code, inspect current GitHub state, read root `AGENTS.md`, then read `docs/configurable-feature-config-design-progress.md` for the latest exact resume point.

---

## 1. Scope and first proof

The repository already has proven Transaction grids using Client-Side, Infinite and Server-Side Row Models.

The configurable work is a separate architecture experiment. Do not destabilize or refactor those existing grids merely to make the experiment possible.

The first configurable implementation remains **SSRM-only** unless the user explicitly changes that direction. Backend metadata must not choose the row model.

The business unit is the **feature/page + entity context**, for example:

```text
Review feature
├── Loan entity
└── Finance entity
```

The same entity may appear in another feature with a different configuration. Entity identity alone is therefore not the complete configuration identity.

---

## 2. Core architecture

The long-term flow is:

```text
frontend-supported configuration contract
        ↓
configuration may be persisted/managed by backend/database
        ↓
backend returns runtime data
        ↓
validate + normalize/adapt
        ↓
frontend compiler + registries + adapters
        ↓
AG Grid GridOptions / ColDef / callbacks / components
        ↓
concrete SSRM runtime
```

### The normalization boundary always exists

**Normalization/adaptation still happens even when backend/storage keys currently match the frontend/AG Grid-aligned names exactly.**

Matching names only make the normalizer simple; they do not remove the boundary.

Raw backend/storage configuration is never passed directly to `AgGridReact`.

This gives us one controlled place to:

- validate schema/version;
- accept future backend/storage naming differences;
- transform backend-specific shapes;
- reject invalid values;
- resolve aliases/migrations when needed;
- ignore fields the deployed frontend does not support/read;
- prepare the normalized frontend model for compilation.

If backend later adds a property that the deployed frontend normalizer/compiler does not read, that property has no effect on the grid. If a required registry key/value is unsupported, fail clearly rather than accidentally passing it through.

---

## 3. AG Grid names and types are the default vocabulary

When our configuration exposes the **same concept with the same semantics as AG Grid**:

```text
prefer AG Grid property name
+
reuse/derive AG Grid TypeScript type where practical
```

Do not invent a parallel vocabulary merely because the value is stored in configuration.

Current examples:

```text
cellDataType
sortable
filterOptions
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
```

Where practical, source types should derive from AG Grid, for example through `ColDef['...']`, indexed access, `Extract`, or another bounded type relation instead of duplicating unions manually.

Create our own names/types only for concepts that are genuinely ours, for example:

```text
featureKey
dataAdapterKey
fieldDefaults
registry key/params descriptors
access/masking metadata
backend query mapping
save mapping
```

This rule applies to both **property names and TypeScript types**.

---

## 4. Three categories of configuration

### A. Native + declarative + JSON-safe AG Grid configuration

When a supported property is already declarative/JSON-safe and its semantics match AG Grid:

```text
normalize/validate
→ merge/pass through using AG Grid name/type
```

Do not write pointless one-to-one translation code such as copying `paginationPageSize` to another renamed property and then copying it back.

The configurable schema should not be artificially limited to only the 5–7 grid options used by today's demo. The later grid-level schema should review a **broad SSRM-relevant declarative AG Grid surface**, while still being intentional about what is supported.

### B. Executable behavior that is genuinely configurable

Functions/components cannot be stored as JSON. Persist a stable key and optional JSON-safe params:

```text
config key
→ frontend registry/resolver
→ actual implementation
→ native AG Grid property
```

Examples:

```text
formatter key → valueFormatter
renderer key  → cellRenderer
editor key    → cellEditor
parser key    → valueParser
```

If a future real requirement makes something like `onCellClicked` or `getRowHeight` configurable, use the same pattern.

**Registry implementations should use the real AG Grid callback/component/property type where practical.** A registry is not a reason to invent a parallel callback API.

Conceptually:

```ts
type CellClickHandler = NonNullable<GridOptions<Row>["onCellClicked"]>;
```

rather than introducing an unrelated home-grown function signature when the grid-facing contract is AG Grid's callback.

Do not create a registry key merely because an executable AG Grid property exists. Require a real configurable use case.

### C. Runtime/compiler-owned infrastructure

Some AG Grid values are created by the frontend runtime rather than stored as arbitrary config. Examples include:

```text
serverSideDatasource
runtime context
compiled columnDefs
GridApi refs
lifecycle/event wiring needed by the concrete runtime
```

`dataAdapterKey` identifies the frontend data/API boundary. The SSRM runtime creates the datasource from the resolved adapter; configuration does not persist a datasource object.

---

## 5. Defaults and merging

Current field-level relationship:

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
AG Grid defaultColDef

entity.fields[]
        ↓
compiled AG Grid columnDefs[]
```

Use AG Grid's normal `ColDef` over `defaultColDef` precedence for ordinary overrides rather than inventing a general merge engine.

For the future table/grid-level configuration, the intended direction is:

```text
frontend/application defaults
        +
normalized entity-level supported AG Grid config
        ↓
resolved declarative SSRM options
        +
runtime-owned options
        +
compiled defaultColDef / columnDefs
        ↓
AgGridReact
```

An entity/backend payload only needs to store the values it actually overrides. Missing values inherit frontend/application defaults or AG Grid defaults as appropriate.

Do not design a Client schema now merely because Client exists elsewhere. The configurable proof is SSRM, so the schema may contain SSRM-relevant values. If a Client configurable schema is ever needed, design it then.

Existing implementation evidence to consult before finalizing this layer:

- `frontend/src/shared/grid/config/defaultColDef.ts`
- `frontend/src/shared/grid/config/serverBackedGridDefaults.ts`
- `frontend/src/shared/grid/config/serverFilterParams.ts`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- concrete SSRM/Infinite/Client roots where a capability is being evaluated

---

## 6. Current public field contract

Source of truth:

`frontend/src/shared/grid/configurable/configuration.types.ts`

The current field core is conceptually:

```text
id
field
labelKey
cellDataType
sortable?
filter?
layout?
formatter?
renderer?
editing?
```

### Stable identity vs row path

```text
field.id
→ stable configuration identity
→ intended future ColDef.colId
→ edit/conflict/validation identity

field.field
→ actual row/API value path
```

They may differ. `field` supports dot notation.

Do not infer business identity from a renderer key or label.

---

## 7. `cellDataType` is the native baseline

The property is intentionally named `cellDataType` and maps to AG Grid `ColDef.cellDataType`.

The configurable proof uses SSRM, so the compiler must set it explicitly because AG Grid data-type inference is Client-Side Row Model only.

Current supported built-ins:

```text
text
number
boolean
date           → JavaScript Date
dateString     → string date
dateTime       → JavaScript Date
dateTimeString → string date-time
```

A normal JSON date such as `"2026-08-30"` is a string and should generally use `dateString` unless an adapter deliberately converts it to a JavaScript `Date`.

AG Grid's native parser/formatter/editor/renderer/filter behavior for the selected cell data type is the baseline. Do not require a custom registry key when native behavior already satisfies the requirement.

---

## 8. Filtering

Current field filter shape:

```ts
interface FieldFilterDefinition<TFilterOption extends string = FilterOption> {
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}
```

```text
filter omitted → field is not filterable
filter present → exact non-empty allowed filterOptions
```

The property name intentionally matches AG Grid `filterParams.filterOptions`.

Current shared server-query vocabulary:

```text
text:
contains, equals, notEqual, startsWith, endsWith

number:
equals, notEqual, greaterThan, greaterThanOrEqual,
lessThan, lessThanOrEqual

date/dateString/dateTime/dateTimeString:
equals, notEqual, lessThan, greaterThan

boolean:
equals, notEqual
```

AG Grid supports more, but do not expose an option end-to-end until the active mapper/adapter/backend semantics can represent it correctly.

The existing server-backed grids also prove shared filter UX such as Apply/Reset, `maxNumConditions: 1` and `closeOnApply: true`. The next grid-level design batch must decide how those **filter defaults** combine with field `filterOptions` rather than duplicating them on every field.

---

## 9. Layout and sizing

Current custom grouping keeps AG Grid-native leaf names:

```text
layout
├── initialHide
├── initialPinned
└── sizing
    ├── initialWidth XOR initialFlex
    ├── minWidth
    ├── maxWidth
    └── resizable
```

`layout`/`sizing` are our organizational concepts. The leaf names/types follow AG Grid where semantics match.

Initial attributes seed state and must not continuously overwrite later Grid State/user choices. Persistent constraints such as min/max/resizable continue to apply.

Grid State/access reconciliation remains a later runtime area; current authorization/config constraints must ultimately win over stale saved preferences.

---

## 10. Formatter, renderer, editor and parser

Backend/storage config remains JSON-safe. Executable code stays frontend-owned behind registries.

### Formatter

```text
formatter.key
→ formatter registry
→ AG Grid-compatible valueFormatter
```

`formatter.params` are extra declarative inputs. AG Grid supplies the normal `ValueFormatterParams` callback object.

### Renderer

```text
renderer.key
→ renderer registry
→ cellRenderer

renderer.params
→ cellRendererParams
```

AG Grid still supplies normal renderer props such as value, valueFormatted, data, node, column, colDef and api. Config params should not duplicate those runtime values.

### Editing

```text
editing omitted → not editable
editing present → potentially editable
```

Presence must not compile to unconditional `editable: true`. Actual editability composes current access/authorization, row policy, conflict policy and other hard runtime constraints.

### Editor

```text
editor.key      → editor registry → cellEditor
editor.params   → cellEditorParams
popup           → cellEditorPopup
popupPosition   → cellEditorPopupPosition
```

Custom React/MUI/domain inputs are supported. If the editor supplied by `cellDataType` is sufficient, omit the custom editor.

### Parser

```text
parser.key
→ parser registry
→ valueParser
```

No custom parser does **not** mean no parsing; the parser supplied by AG Grid's `cellDataType` may remain active.

Parser output is the LOCAL draft value. It is not the backend save mapper.

---

## 11. Value stages must remain distinct

```text
1. authoritative API row value
2. effective grid value (API or LOCAL unsaved overlay)
3. AG Grid cellDataType baseline behavior
4. optional formatted/rendered display
5. editor-produced candidate
6. native/custom valueParser output = LOCAL draft
7. validation
8. save mapping → backend payload
```

Do not collapse these stages into one generic "value transformation" concept.

AG Grid `valueParser` is not a universal application normalizer because programmatic edits may bypass it. If future requirements need normalization across every edit source, design a separate normalization stage explicitly.

---

## 12. Editing/validation/conflict architecture to preserve

The configurable runtime must reuse the proven shared architecture rather than rebuild editing around metadata.

Existing tracked editing keeps unsaved edits outside transient RowNodes so they survive SSRM recreation and tracks BASE/LOCAL/REMOTE reconciliation.

Validation remains a shared capability independent of configurable metadata. Metadata may later produce inputs to that validation engine; it must not become a second validation architecture.

Dirty/conflict/validation state for configurable fields should use stable `FieldDefinition.id`, while actual row read/write uses `FieldDefinition.field` or a later bounded accessor.

Backend remains authoritative for business validation and write rejection.

---

## 13. Access, masking and backend authority

Frontend-only masking is not security.

Keep these concepts distinct:

```text
maskable
canRequestUnmask
masked
```

Backend should withhold raw unauthorized values and remains authoritative for:

- accessible feature/entity/config projection;
- field and row authorization;
- masking/unmask capability and state;
- business validation;
- server-supported sort/filter/search semantics;
- save/action authorization;
- authoritative data and operation rejection.

Frontend consumes the resolved access/config snapshot and provides correct UX. It does not duplicate backend authorization algorithms.

---

## 14. Data adapters and request ownership

`dataAdapterKey` identifies the frontend adapter/service boundary for the entity.

The adapter/compiler boundary may own:

- backend configuration normalization when storage shape differs;
- SSRM request mapping;
- API response mapping;
- row/value representation conversion where explicitly designed;
- save/request payload mapping;
- server sort/filter/search key translation;
- other feature/entity-specific transport differences.

Do not let backend URL metadata or raw API shapes leak throughout generic grid code.

SSRM loads remain datasource-owned; do not force TanStack Query into block loading merely for consistency.

---

## 15. Actions and other executable behavior

Actions belong to the business feature/page, not a giant generic grid-action framework.

If configuration chooses an action or event behavior, use bounded declarative keys that resolve to frontend code and preserve backend authorization for execution.

Do not couple business semantics to renderer names.

Do not build a universal dependency engine, behavior engine or `DynamicGrid` escape hatch upfront.

---

## 16. Documentation contract

Public contracts require both:

1. useful TypeScript JSDoc/IDE hover documentation;
2. library-style Markdown under `docs/configurable-feature/`.

Current quick visual reference:

`docs/configurable-feature/type-hierarchy.md`

It contains both a portable text hierarchy and a rendered Mermaid relationship diagram.

Generated API documentation is an additional layer, not a replacement. The planned tooling direction is TypeDoc with Markdown output so generated API docs can be browsed directly in GitHub. Package/lockfile changes must be generated reproducibly through npm; do not hand-edit a dependency lockfile.

---

## 17. Working/branch rules for this design phase

Current design branch:

`configurable-feature-grid`

For this design phase:

- do not create another branch unless explicitly asked;
- do not open/merge a PR unless explicitly asked;
- existing concrete grids remain untouched unless the user explicitly moves into implementation;
- discuss coherent subsystems, not every tiny property individually;
- do not silently finalize a whole major subsystem without explaining the choices;
- use AG Grid 36.1 as implementation reference;
- native AG Grid first;
- no universal AG Grid wrapper or giant `useGrid`;
- no Docker/unrelated infrastructure;
- no console logs merely for flow inspection.

Root `AGENTS.md` still governs normal repository quality/testing/documentation rules; these project-specific design instructions govern this configurable-feature phase where they are more specific.

---

## 18. Exact continuation

Do not infer the next task from this handoff alone.

Read:

`docs/configurable-feature-config-design-progress.md`

That file contains the latest exact checkpoint, provisional decisions and next coherent discussion batch.
