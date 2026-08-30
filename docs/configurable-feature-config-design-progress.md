# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature contract design on `configurable-feature-grid`.

Repository/source/docs are authoritative. Read in this order after root `AGENTS.md` and current GitHub state:

1. `docs/configurable-feature-handoff.md` — current architecture handoff;
2. `docs/configurable-feature/configuration-reference.md` — current public contract;
3. `docs/configurable-feature/type-hierarchy.md` — portable relationship map + supplemental Mermaid;
4. this file — exact status and resume point.

## Design-phase rules

- Stay on `configurable-feature-grid`; do not create another branch unless explicitly asked.
- Do not open/merge a PR unless explicitly asked.
- Existing Transaction Client/Infinite/SSRM grids remain untouched during the initial configurable experiment.
- First configurable implementation remains SSRM-only unless direction changes.
- Backend metadata never chooses row model.
- SSRM datasource loading remains datasource-owned, not TanStack Query.
- AG Grid 36.1 is the implementation reference; native capability first.
- Do not add a universal AG Grid wrapper or giant `useGrid`.
- No console logging merely to inspect flow.

## Mandatory normalization boundary

```text
frontend-supported configuration design
        ↓
may be stored/managed using backend/database representation
        ↓
backend runtime JSON
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
compiler + registries/adapters
        ↓
AG Grid
```

Normalization remains even when backend/storage names currently match normalized frontend names exactly.

If storage/wire names differ later, transform once at the boundary. Example:

```text
backend columnDefaults
→ normalizer
→ normalized defaultColDef
→ compiler
```

Raw backend configuration is never spread directly into `AgGridReact`.

## AG Grid naming/type rule

```text
same concept + same value semantics
→ use AG Grid property name
→ derive/reuse AG Grid type where practical

same final AG Grid destination but persisted semantics differ
→ explicit application descriptor name
→ registry/compiler maps to native AG Grid property
```

This distinction prevents both unnecessary rename layers and misleading fake-native properties.

## Latest contract cleanup — DONE

The public source contract was re-audited against AG Grid 36.1 and updated.

### Renames/direct-native alignment

```text
field.id                → field.colId
entity.fieldDefaults    → entity.defaultColDef
```

`colId` now directly represents AG Grid `ColDef.colId` and is the stable Grid State/API/edit-conflict-validation identity. `field` remains the API row value path.

`defaultColDef` now uses AG Grid's real property name because its normalized supported values have the same semantics. The value remains a bounded `ConfigurableDefaultColDef`, not arbitrary persisted `ColDef`.

### Removed unnecessary wrappers

Removed:

```text
layout
sizing
FieldLayoutDefinition
FieldSizingDefinition
FieldSizingConstraintsDefinition
```

Fields/defaults now expose native leaves directly:

```text
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
```

The earlier custom `initialWidth XOR initialFlex` rule was removed. Follow AG Grid's native width/flex behavior instead of maintaining a parallel sizing model.

### Filtering name corrected

Old shape:

```text
filter: { filterOptions: [...] }
```

was misleading because AG Grid `ColDef.filter` has different value semantics.

Current shape:

```text
filtering: { filterOptions: [...] }
```

Compiler intent:

```text
filtering
→ appropriate ColDef.filter
+ filterParams.filterOptions
```

`filterOptions` itself keeps the AG Grid leaf name because that leaf has the same semantics.

### Renderer/editor native parameter leaves

Updated nested leaves:

```text
renderer.params           → renderer.cellRendererParams
editor.params             → editor.cellEditorParams
editor.popup              → editor.cellEditorPopup
editor.popupPosition      → editor.cellEditorPopupPosition
```

These values have native AG Grid semantics, so the native names are clearer.

Formatter/parser `params` remain custom because AG Grid has no direct `valueFormatterParams` / `valueParserParams` ColDef properties.

## Entity generic clarification — DONE

`EntityDefinition<TLabelKey, TFieldDefinition>` is now explicitly documented as reusable and business-agnostic.

```text
FeatureDefinition.entities record key
→ actual entity identity, e.g. "transaction" or "loan"

TLabelKey
→ allowed translation-key type

TFieldDefinition
→ allowed field-definition shape
```

The source now includes `@typeParam` documentation so TypeDoc/IDE hover explains this directly.

## Current public hierarchy

```text
FeatureDefinition
└── EntityDefinition
    ├── RowIdDefinition
    ├── ConfigurableDefaultColDef
    └── FieldDefinition[]
        ├── FieldFilteringDefinition
        ├── FieldFormatterDefinition
        ├── FieldRendererDefinition
        └── FieldEditingDefinition
            ├── FieldEditorDefinition
            └── FieldValueParserDefinition
```

Current field core:

```text
colId
field
labelKey
cellDataType
sortable?
filtering?
initialHide?
initialPinned?
initialWidth?
initialFlex?
minWidth?
maxWidth?
resizable?
formatter?
renderer?
editing?
```

## Native vs custom examples

Direct native normalized values:

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

Intentionally application-specific descriptors:

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
registry keys/custom params
```

Rationale examples:

```text
labelKey != headerName
because labelKey must be translated first

rowId { path } != getRowId
because getRowId is executable runtime behavior

formatter { key, params } != valueFormatter
because valueFormatter is executable behavior
```

## `cellDataType`

Current built-ins:

```text
text
number
boolean
date           → JavaScript Date
dateString     → string date
dateTime       → JavaScript Date
dateTimeString → string date-time
```

Configurable proof uses SSRM, so `cellDataType` must be set explicitly. Native AG Grid type behavior remains the baseline.

## Filtering status

Field-level operator vocabulary remains bounded by the existing server-query semantics:

```text
text: contains, equals, notEqual, startsWith, endsWith
number: equals, notEqual, greaterThan, greaterThanOrEqual,
        lessThan, lessThanOrEqual
date/dateString/dateTime/dateTimeString:
        equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

Existing `serverFilterParams.ts` proves Apply/Reset, `maxNumConditions: 1` and `closeOnApply: true`. The upcoming grid/filter-default batch still needs to decide how common Simple Filter defaults combine with field `filtering.filterOptions`.

## Formatter / renderer / editor / parser status

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

Registry outputs should use the real AG Grid implementation types where practical.

## Generated documentation

TypeDoc tooling is configured:

```text
TypeDoc 0.28.x
+ typedoc-plugin-markdown 4.x
+ typedoc.json
+ npm run docs:configurable
```

The generated output under `docs/configurable-feature/generated/` was produced before the latest contract rename/cleanup and therefore must be regenerated after pulling this head:

```bash
npm run docs:configurable
```

Then review and commit the generated Markdown. Do not hand-edit generated TypeDoc pages as the normal maintenance workflow.

## Coverage snapshot

```text
FeatureDefinition                              DONE
EntityDefinition generic meaning               DONE / clarified
RowIdDefinition                               DONE
Field colId/field identity split               DONE
cellDataType                                  DONE
sortable                                      DONE
filtering/filterOptions core                   DONE
native layout/sizing leaves                    DONE
ConfigurableDefaultColDef                      DONE core
formatter/renderer descriptors                 DONE core
editing/editor/parser                          DONE core
AG Grid naming/type guardrail                  DONE
backend/store → normalize → compile boundary   DONE DIRECTION
portable hierarchy + Mermaid                   DONE
TypeDoc + Markdown tooling                     CONFIGURED
generated TypeDoc after latest rename          NEEDS REGENERATION
broad SSRM declarative GridOptions surface     NEXT
app/entity grid-option merge rules             NEXT
filter defaults/table-level filter behavior    NEXT
registry key→params→AG Grid impl typing         NEXT/RELATED
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

## Exact resume point

After regenerating TypeDoc and running the normal source validation locally, resume one coherent **grid-level/native configuration + normalization/registry-typing batch**:

1. inspect AG Grid 36.1 `GridOptions` / SSRM option types and existing repo defaults;
2. design the broad JSON-safe/native declarative SSRM configuration surface without limiting it to today's demo values;
3. define application defaults + entity override/merge semantics;
4. design common filter defaults and merge behavior with `fielding`/`filtering.filterOptions` (use the actual source name `filtering`; do not introduce another alias);
5. classify supported native declarative vs executable-configurable vs runtime-owned properties;
6. design registry typing so key-specific params and resolved implementations use real AG Grid types where practical;
7. preserve mandatory backend/storage normalization even when names match.

Then continue with validation declarations, server sort/filter/search mapping, read/write/save mapping, access/security/masking, and adapter/action/page/runtime/compiler layers.

## Validation/testing status

These latest changes are public type-contract/JSDoc/docs changes made through GitHub connector writes. Full repository lint/typecheck/tests have not been run on this head. Do not claim them green until they are actually executed.
