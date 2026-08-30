# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature contract design on `configurable-feature-grid`.

Primary architecture: `docs/configurable-feature-handoff.md`  
Public reference: `docs/configurable-feature/configuration-reference.md`  
Visual type/mapping tree: `docs/configurable-feature/type-hierarchy.md`  
Documentation standard: `docs/configurable-feature/documentation-standard.md`

A new chat should read this file after the primary handoff. This file contains the latest decisions and overrides older illustrative names in the handoff when they differ.

## Working rules

- Stay on `configurable-feature-grid`; do not create another branch unless explicitly asked.
- Do not open/merge a PR unless explicitly asked.
- Discuss related properties in coherent batches; do not stop after every tiny property and do not silently finalize whole major areas without explanation.
- Inspect existing Client/Infinite/SSRM implementations when designing a corresponding configurable capability; classify what is configurable, defaulted, frontend/runtime-owned, adapter-owned or backend-authoritative.
- Existing Transaction grids remain untouched during the initial configurable experiment.
- First configurable implementation remains SSRM-only unless the user changes that direction.
- Backend metadata never chooses row model.
- SSRM datasource loading remains datasource-owned, not TanStack Query.
- No console logging merely to inspect flow.

## Latest architectural rule — AG Grid names/types first

When our public configuration exposes the same concept with the same semantics as AG Grid:

```text
same concept
→ prefer the AG Grid property name
→ reuse/derive the AG Grid TypeScript type where practical
→ avoid a pointless rename-and-map layer
```

Create our own names/types only where the concept is genuinely ours, e.g.:

```text
featureKey
dataAdapterKey
fieldDefaults
registry descriptors
access/masking
server query mapping
save mapping
```

This rule applies to **both names and TypeScript types**.

Current source corrections already made:

```text
dataType      → cellDataType
operators     → filterOptions
initialVisible→ initialHide
```

Several leaf types now derive from `ColDef`, including sortable, initial/persistent sizing and editor popup position where practical.

## Frontend-authored, backend-stored configuration — FINALIZED DIRECTION

The intended long-term flow is:

```text
frontend defines/supports configuration contract
        ↓
configuration may be persisted/managed in backend database
        ↓
backend returns runtime JSON
        ↓
validate + normalize/adapt once
        ↓
frontend compiler + registries
        ↓
AG Grid
```

Important consequences:

- raw backend JSON is never spread directly into `AgGridReact`;
- backend/storage property names/shapes may differ later without changing the grid architecture;
- if they differ, transform once at the configuration boundary;
- an unknown backend property that the deployed frontend does not read/normalize/compile has no effect;
- unknown required registry keys or invalid supported values must fail clearly;
- frontend strong types do not replace runtime schema/version/registry validation.

The backend is primarily storing/managing a configuration model the frontend understands; it is not expected to invent arbitrary executable AG Grid behavior independently.

## Three configuration categories — FINALIZED DIRECTION

### 1. Native + declarative + JSON-safe AG Grid configuration

When supported by the frontend contract:

```text
keep AG Grid name/type
→ validate/normalize
→ merge/pass through where semantics are identical
```

Do not write manual one-to-one compiler assignments merely because a property came from configuration.

### 2. Executable behavior that is genuinely configurable

Persist a JSON-safe key (+ params when needed):

```text
config key
→ frontend registry
→ real AG Grid-compatible callback/component/function
→ final AG Grid property
```

Registry implementations should use/return the **real AG Grid callback/component type** where practical rather than a home-grown signature.

Examples:

```text
formatter key → AG Grid-compatible valueFormatter
renderer key  → AG Grid-compatible cellRenderer
editor key    → AG Grid-compatible cellEditor
parser key    → AG Grid-compatible valueParser
```

If future product requirements make an executable option such as `onCellClicked` or `getRowHeight` configurable, apply the same rule: stored key → registry → implementation typed against AG Grid's corresponding property/callback type.

Do not create registry keys merely because an executable AG Grid property exists; require a real configurable use case.

### 3. Runtime/compiler-owned infrastructure

Frontend constructs these rather than treating them as arbitrary persisted config. Examples include:

```text
serverSideDatasource
runtime context
compiled columnDefs
GridApi refs
lifecycle handlers
```

`dataAdapterKey` already identifies the frontend data/API boundary. The runtime will create the SSRM datasource from the resolved adapter rather than persisting a datasource object.

## Defaults / merge direction — LATEST

Current field relationship remains:

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
AG Grid defaultColDef

entity.fields[]
        ↓
AG Grid columnDefs[]
```

For future table/grid-level configuration, do **not** restrict the schema to only the handful of pagination/cache settings used by today's Transaction demo.

Preferred direction:

```text
frontend/application defaults
        +
normalized entity-level supported AG Grid configuration
        ↓
resolved declarative SSRM options
        +
runtime-owned options
        +
compiled defaultColDef/columnDefs
        ↓
AgGridReact
```

An entity/backend payload may contain only the few values it actually overrides. Missing values inherit frontend/application defaults or AG Grid defaults as appropriate.

The exact broad declarative SSRM option surface is **not yet finalized**. Start from AG Grid concepts rather than from a tiny `Pick` of today's demo options, then deliberately exclude/transform executable/runtime-owned pieces.

Existing repo evidence to consult:

- `frontend/src/shared/grid/config/defaultColDef.ts`
- `frontend/src/shared/grid/config/serverBackedGridDefaults.ts`
- `frontend/src/shared/grid/config/serverFilterParams.ts`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- concrete Client/Infinite/SSRM roots

These show existing application defaults + feature overrides and proven pagination/cache/filter behavior.

## `cellDataType` — FINALIZED CORE

The first configurable proof uses SSRM, so `ColDef.cellDataType` must be set explicitly because AG Grid inference is Client-Side Row Model only.

Current supported built-ins:

```text
text
number
boolean
date           (JavaScript Date)
dateString     (string date)
dateTime       (JavaScript Date)
dateTimeString (string date-time)
```

Current Transaction `transactionDate` is an ISO string, so an equivalent configurable field should use `dateString` unless an adapter deliberately converts it to a `Date`.

Native AG Grid cell-data-type parser/formatter/editor/renderer/filter behavior is the baseline. Custom config is an override/extension only when needed.

## Field core — FINALIZED

```text
field.id
→ stable configuration identity
→ intended future ColDef.colId / edit-conflict-validation identity

field.field
→ row/API value path
```

They may differ. Dot notation is supported.

Current field core uses:

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

## Filtering — FINALIZED CORE, DEFAULTS STILL TO DESIGN

```ts
interface FieldFilterDefinition<TFilterOption extends string = FilterOption> {
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}
```

The property name intentionally matches AG Grid `filterParams.filterOptions`.

```text
filter omitted → not filterable
filter present → exact non-empty allowed filterOptions
```

Shared server-query vocabulary:

```text
text:    contains, equals, notEqual, startsWith, endsWith
number:  equals, notEqual, greaterThan, greaterThanOrEqual,
         lessThan, lessThanOrEqual
date/dateString/dateTime/dateTimeString:
         equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

Existing `serverFilterParams.ts` also proves shared server-backed UX such as Apply/Reset, `maxNumConditions: 1` and `closeOnApply: true`. These should inform the upcoming filter-default/grid-level design instead of being duplicated on every field.

Do not expose unsupported end-to-end semantics merely because AG Grid supports them. Multiple conditions, `inRange`, blank/notBlank, Set Filter, Multi Filter, etc. require matching mapper/adapter/backend semantics.

## Layout/sizing — FINALIZED CORE

Current layout uses native AG Grid leaf names:

```text
initialHide
initialPinned
initialWidth XOR initialFlex
minWidth
maxWidth
resizable
```

The `layout` / `sizing` grouping is ours because it gives meaningful configuration structure; the leaf semantics/types align with AG Grid.

Initial values seed column state and should not continuously overwrite later Grid State/user choices. Access/security constraints may still override persisted user state later.

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

AG Grid supplies normal runtime callback/component params. Config params are extra declarative inputs only.

Formatter/renderer remain outside `fieldDefaults` until explicit disable/inheritance semantics are clean.

## Editing/editor/parser — FINALIZED CONFIG SHAPE

```text
editing omitted → not editable
editing present → potentially editable
```

Actual `editable` must compose access/authorization, row policy, conflict policy and other hard constraints.

Editor mapping:

```text
editor.key      → registry → AG Grid-compatible cellEditor
editor.params   → cellEditorParams
popup           → cellEditorPopup
popupPosition   → cellEditorPopupPosition
```

Parser mapping:

```text
parser.key → registry → AG Grid-compatible valueParser
```

No custom parser does not mean no parsing; the parser supplied by `cellDataType` may remain active.

Custom inputs (React/MUI/domain-specific editors) are explicitly supported.

## Durable value-stage distinction

```text
1. authoritative API value
2. effective grid value (API or LOCAL overlay)
3. AG Grid cellDataType baseline behavior
4. optional formatted/rendered display
5. editor candidate
6. native/custom valueParser output = LOCAL draft
7. validation
8. save mapping → backend payload          [later]
```

Parser is not universal normalization; programmatic application edits can bypass AG Grid `valueParser`.

## Backend/business authority — preserve

Later backend authority remains required for:

- accessible feature/entity/config projection;
- field/row authorization;
- masking/unmask state/capability;
- server sort/filter/search support;
- business validation/operation enforcement;
- authoritative data and save/action rejection.

Frontend consumes resolved configuration/access and provides UX. It does not replace backend authorization enforcement.

## Overall coverage snapshot

```text
FeatureDefinition                              DONE
EntityDefinition core                         PARTIAL
RowIdDefinition                               DONE
Field identity/binding                        DONE
cellDataType                                   DONE
sortable                                       DONE
filter filterOptions core                      DONE
layout/sizing                                  DONE
formatter/renderer descriptors                 DONE
editing/editor/parser                          DONE
AG Grid naming/type alignment guardrail        DONE
backend-store → normalize → compile boundary   DONE DIRECTION
broad SSRM declarative grid-options surface    NEXT
app/entity grid-option merge rules             NEXT
filter defaults/table-level filter behavior    NEXT
registry key→params→AG Grid impl typing         NEXT/RELATED
TypeDoc/generated type documentation           PLANNED, NOT INSTALLED YET
validation declarations                        AFTER ABOVE
server sort/filter/search mapping               NOT YET DESIGNED
read/write/save mapping                         NOT YET DESIGNED
access/security/masking                         NOT YET DESIGNED
data-adapter registry                           NOT YET DESIGNED
actions/business operations                     NOT YET DESIGNED
Grid State/access reconciliation                PRINCIPLES ONLY
runtime config version/schema validation        NOT YET DESIGNED
final runtime/compiler                          NOT YET DESIGNED
```

## Exact resume point for next chat

Do **not** jump directly to validation.

Resume with one coherent **grid-level/native configuration + normalization/registry-typing batch**:

1. inspect AG Grid 36.1 `GridOptions` / SSRM option types and current repo defaults;
2. decide the broad JSON-safe/native declarative SSRM configuration surface without limiting it to today's 5–7 demo properties;
3. define application/default + entity override merge semantics;
4. decide how filter defaults (Apply/Reset, max conditions, close-on-apply, debounce/default option where useful) participate;
5. explicitly classify executable/runtime-owned AG Grid properties rather than blindly exposing or omitting them;
6. design registry typing so registry outputs use AG Grid's real property/callback/component types and key-specific params can later be strongly typed;
7. keep backend/storage normalization separate from the normalized frontend config/AG Grid compiler;
8. then add TypeDoc/generated hierarchy tooling if practical and keep the curated hierarchy beside it.

After that continue with:

1. validation declarations;
2. server sort/filter/search mapping + searchability;
3. read/write/save mapping;
4. access/security/masking;
5. adapter/action/page/runtime/compiler layers.

## Current branch/checkpoint

Latest source/docs alignment commits in this session include:

- `64545ce4409705e44fa3cc872b1d4c368cc0c18c` — align configurable field names/types with AG Grid;
- `287f23653ca47b062591431fe89ef1a88f4f1235` — align public reference and normalization model;
- `5d63d6eb11120993dc35ca2117b8546d3ef1a5ac` — update concepts;
- `98aff53ed89138373d51861d63346c01975c0cb0` — update visual hierarchy and registry typing rule.

Do not claim full repository lint/typecheck/test passed for these connector-only changes; those checks have not been run in this session.
