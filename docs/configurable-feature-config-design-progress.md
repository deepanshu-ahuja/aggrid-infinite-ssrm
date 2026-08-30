# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature contract design on `configurable-feature-grid`.

This checkpoint reflects the decisions through **Chat 5**. Repository/source/docs are authoritative; the chat label is only a convenient reference.

Read in this order after root `AGENTS.md` and current GitHub state:

1. `docs/configurable-feature-handoff.md` — current architecture handoff;
2. `docs/configurable-feature/configuration-reference.md` — finalized public contract currently in source;
3. `docs/configurable-feature/type-hierarchy.md` — visible hierarchy, Mermaid diagram and AG Grid mappings;
4. this file — exact resume point and provisional work.

## Design-phase working rules

- Stay on `configurable-feature-grid`; do not create another branch unless explicitly asked.
- Do not open/merge a PR unless explicitly asked.
- Existing Transaction Client/Infinite/SSRM grids remain untouched during the initial configurable experiment.
- First configurable implementation remains SSRM-only unless the user changes direction.
- Backend metadata never chooses row model.
- SSRM datasource loading remains datasource-owned, not TanStack Query.
- Discuss coherent subsystems, not every tiny property individually.
- Do not silently finalize a whole major subsystem without explaining the choices.
- AG Grid 36.1 is the implementation reference; native capability first.
- Do not add a universal AG Grid wrapper or giant `useGrid`.
- No console logging merely to inspect flow.

## Latest architecture rule: AG Grid names/types first

When our public config exposes the same concept with the same semantics as AG Grid:

```text
use AG Grid property name where practical
+
reuse/derive AG Grid TypeScript type where practical
```

Do not create a parallel vocabulary merely because the value is stored as configuration.

Current source corrections already made:

```text
dataType       → cellDataType
operators      → filterOptions
initialVisible → initialHide
```

Several leaf types now derive from `ColDef`, including sortable, sizing/pinning/visibility leaves and editor popup position.

Our own names remain for genuinely application-specific concepts such as:

```text
featureKey
dataAdapterKey
fieldDefaults
registry key/params descriptors
access/masking
server query mapping
save mapping
```

## Frontend-authored, backend-stored configuration

Intended flow:

```text
frontend-supported configuration contract
        ↓
configuration may be persisted/managed by backend/database
        ↓
backend returns runtime data
        ↓
validate + normalize/adapt
        ↓
frontend compiler + registries/adapters
        ↓
AG Grid
```

### Normalization always remains

**Normalization/adaptation still happens even when backend/storage property names currently match the normalized frontend/AG Grid-aligned names exactly.**

Matching names only make the transformation simple; they do not remove the boundary.

Raw backend runtime data is never spread directly into `AgGridReact`.

If backend/storage shape differs later, transform once at the same boundary. If backend adds a property that the deployed frontend does not read/normalize/compile, it has no grid effect. Unknown required registry keys or invalid supported values must fail clearly.

## Three configuration categories

### 1. Native + declarative + JSON-safe AG Grid config

For supported properties whose semantics match AG Grid:

```text
keep AG Grid name/type
→ validate/normalize
→ merge/pass through where appropriate
```

Do not manually map every identical native property one by one.

The future grid-level schema must not be limited to only the 5–7 pagination/cache properties used by today's Transaction demo. Review a broad SSRM-relevant declarative AG Grid surface.

### 2. Executable behavior that is genuinely configurable

Persist a key + optional JSON-safe params:

```text
config key
→ frontend registry/resolver
→ actual implementation
→ native AG Grid callback/component/property
```

Registry outputs should use the **real AG Grid implementation type** where practical rather than home-grown grid-facing signatures.

Current examples:

```text
formatter key → valueFormatter
renderer key  → cellRenderer
editor key    → cellEditor
parser key    → valueParser
```

If future requirements make `onCellClicked`, `getRowHeight`, etc. configurable, use the same pattern only when there is a real use case.

### 3. Runtime/compiler-owned infrastructure

Frontend constructs these rather than persisting them as arbitrary config, e.g.:

```text
serverSideDatasource
runtime context
compiled columnDefs
GridApi refs
lifecycle wiring
```

`dataAdapterKey` identifies the frontend data/API boundary; the runtime creates the datasource from the resolved adapter.

## Defaults / merge direction

Current column relationship:

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

Future grid-level direction:

```text
frontend/application defaults
        +
normalized entity-level supported AG Grid config
        ↓
resolved declarative SSRM options
        +
runtime-owned options
        +
compiled columns/defaults
        ↓
AgGridReact
```

An entity/backend payload may store only the values it overrides. Missing values inherit application or AG Grid defaults as appropriate.

Do not design a configurable Client schema now just because a Client grid exists elsewhere. This proof is SSRM; a Client configurable schema can be designed only if needed later.

Existing repo evidence to inspect when designing the grid-level surface:

- `frontend/src/shared/grid/config/defaultColDef.ts`
- `frontend/src/shared/grid/config/serverBackedGridDefaults.ts`
- `frontend/src/shared/grid/config/serverFilterParams.ts`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- concrete grid roots where a capability is being classified

## Current finalized source contract

Source:

`frontend/src/shared/grid/configurable/configuration.types.ts`

Current hierarchy:

```text
FeatureDefinition
└── EntityDefinition
    ├── RowIdDefinition
    ├── FieldDefaultsDefinition
    └── FieldDefinition[]
        ├── FieldFilterDefinition
        ├── FieldLayoutDefinition / FieldSizingDefinition
        ├── FieldFormatterDefinition
        ├── FieldRendererDefinition
        └── FieldEditingDefinition
            ├── FieldEditorDefinition
            └── FieldValueParserDefinition
```

Visible text + Mermaid version:

`docs/configurable-feature/type-hierarchy.md`

## Field core — FINALIZED

```text
field.id
→ stable configuration identity
→ future ColDef.colId / edit-conflict-validation identity

field.field
→ row/API value path
```

Current field core:

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

`cellDataType` uses the AG Grid name and compatible derived type. Current built-ins:

```text
text
number
boolean
date           (JavaScript Date)
dateString     (string date)
dateTime       (JavaScript Date)
dateTimeString (string date-time)
```

The configurable proof uses SSRM, so `cellDataType` must be set explicitly. Native AG Grid type behavior is the baseline before custom overrides.

## Filtering — FINALIZED CORE, DEFAULTS STILL TO DESIGN

```ts
interface FieldFilterDefinition<TFilterOption extends string = FilterOption> {
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}
```

```text
filter omitted → not filterable
filter present → exact non-empty allowed filterOptions
```

Shared current server-query vocabulary:

```text
text: contains, equals, notEqual, startsWith, endsWith
number: equals, notEqual, greaterThan, greaterThanOrEqual,
        lessThan, lessThanOrEqual
date/dateString/dateTime/dateTimeString:
        equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

Existing `serverFilterParams.ts` also proves Apply/Reset, `maxNumConditions: 1` and `closeOnApply: true`. The upcoming grid/filter-default batch must decide how these defaults merge with individual field `filterOptions`.

Do not expose AG Grid filter semantics until the full adapter/backend request contract supports them.

## Layout/sizing — FINALIZED CORE

Our grouping:

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

Grouping is ours; leaf names/types follow AG Grid where semantics match.

Initial values seed state; persistent min/max/resizable constraints remain active. Later access/security constraints must win over stale saved Grid State.

## Formatter / renderer — FINALIZED CONFIG SHAPE

```ts
formatter?: { key; params? }
renderer?:  { key; params? }
```

These descriptors are custom because executable functions/components cannot be JSON persisted.

```text
formatter.key → registry → AG Grid-compatible valueFormatter
renderer.key  → registry → AG Grid-compatible cellRenderer
renderer.params → cellRendererParams
```

AG Grid supplies its normal callback/component runtime params. Config params are extra declarative inputs only.

## Editing / editor / parser — FINALIZED CONFIG SHAPE

```text
editing omitted → not editable
editing present → potentially editable
```

Actual `editable` must compose access/authorization, row policy, conflict policy and other hard constraints.

```text
editor.key      → registry → cellEditor
editor.params   → cellEditorParams
popup           → cellEditorPopup
popupPosition   → cellEditorPopupPosition

parser.key      → registry → valueParser
```

No custom parser does not mean no parsing; AG Grid's `cellDataType` parser may remain active. Custom React/MUI/domain inputs are supported.

## Durable value stages

```text
1. authoritative API value
2. effective grid value (API or LOCAL overlay)
3. AG Grid cellDataType baseline behavior
4. optional formatted/rendered display
5. editor candidate
6. native/custom valueParser output = LOCAL draft
7. validation
8. save mapping → backend payload
```

Parser is not universal application normalization; programmatic edits may bypass AG Grid `valueParser`.

## Backend authority to preserve

Backend remains authoritative for:

- accessible feature/entity/config projection;
- field/row authorization;
- masking/unmask state/capability;
- server sort/filter/search support;
- business validation/operation enforcement;
- authoritative data and save/action rejection.

Frontend consumes resolved configuration/access and provides UX; it does not duplicate backend authorization algorithms.

## Generated documentation status

`docs/configurable-feature/type-hierarchy.md` contains both:

- portable text hierarchy;
- GitHub-rendered Mermaid relationship diagram.

Source-generated API tooling is now configured:

```text
TypeDoc 0.28.x
+
typedoc-plugin-markdown 4.x
+
typedoc.json
+
npm run docs:configurable
```

Generation flow:

```text
frontend/src/shared/grid/configurable/configuration.types.ts
        ↓
npm run docs:configurable
        ↓
docs/configurable-feature/generated/
```

The dependencies are present in `package.json` and `package-lock.json`. The npm script and `typedoc.json` are committed on `configurable-feature-grid`.

The generated output directory is created by the command; after generation, review and commit the Markdown output. Generated docs supplement—not replace—the curated hierarchy/reference.

## Overall coverage snapshot

```text
FeatureDefinition                              DONE
EntityDefinition core                         PARTIAL
RowIdDefinition                               DONE
Field identity/binding                        DONE
cellDataType                                  DONE
sortable                                      DONE
filter filterOptions core                     DONE
layout/sizing                                 DONE
formatter/renderer descriptors                DONE
editing/editor/parser                         DONE
AG Grid naming/type guardrail                 DONE
backend/store → normalize → compile boundary  DONE DIRECTION
visible text + Mermaid hierarchy              DONE
TypeDoc + Markdown tooling                    CONFIGURED
first generated TypeDoc output                PENDING npm run docs:configurable
broad SSRM declarative GridOptions surface    NEXT
app/entity grid-option merge rules            NEXT
filter defaults/table-level filter behavior   NEXT
registry key→params→AG Grid impl typing        NEXT/RELATED
validation declarations                       AFTER ABOVE
server sort/filter/search mapping              NOT YET DESIGNED
read/write/save mapping                        NOT YET DESIGNED
access/security/masking                        NOT YET DESIGNED
data-adapter registry                          NOT YET DESIGNED
actions/business operations                    NOT YET DESIGNED
Grid State/access reconciliation               PRINCIPLES ONLY
runtime config version/schema validation       NOT YET DESIGNED
final runtime/compiler                         NOT YET DESIGNED
```

## Exact resume point for next chat

Do **not** jump directly to validation.

Resume with one coherent **grid-level/native configuration + normalization/registry-typing batch**:

1. inspect AG Grid 36.1 `GridOptions` / SSRM option types and current repo defaults;
2. design the broad JSON-safe/native declarative SSRM configuration surface without limiting it to today's demo properties;
3. define application defaults + entity override/merge semantics;
4. design filter defaults and their merge with field `filterOptions`;
5. classify supported native declarative vs executable configurable vs runtime-owned AG Grid properties;
6. design registry typing so outputs use real AG Grid callback/component/property types and key-specific params can later be strongly typed;
7. keep backend/storage normalization as a mandatory boundary even when names currently match;
8. regenerate TypeDoc with `npm run docs:configurable` whenever the public configurable contract/JSDoc changes.

Then continue with:

1. validation declarations;
2. server sort/filter/search mapping + searchability;
3. read/write/save mapping;
4. access/security/masking;
5. adapter/action/page/runtime/compiler layers.

## Validation/testing status

The latest changes include source/docs/tooling configuration. Do **not** claim full repository lint/typecheck/test passed for this checkpoint unless those commands are actually run after the current branch head.
