# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature contract design on `configurable-feature-grid`.

Primary architecture: `docs/configurable-feature-handoff.md`  
Public reference: `docs/configurable-feature/configuration-reference.md`  
Documentation standard: `docs/configurable-feature/documentation-standard.md`

## Working rules

- Stay on `configurable-feature-grid`; no new working branch unless explicitly requested.
- Discuss/design related properties in coherent batches, not one property at a time.
- Source TypeScript contains sufficiently finalized contracts only.
- Backend configuration stays JSON-safe and declarative; executable functions/components remain frontend-owned behind registries/adapters.
- Strong frontend typing does not validate backend JSON; runtime schema/registry validation remains mandatory.
- Reuse native AG Grid behavior where it already gives the right primitive.
- Shared contracts stay feature/entity/row-model neutral; business-specific values/policy remain feature/entity owned.
- Keep unresolved/deferred items here so chat memory is unnecessary.

## Overall coverage snapshot

```text
FeatureDefinition                       DONE
EntityDefinition                        PARTIAL, core/fields/defaults done
RowIdDefinition                         DONE
FieldDefinition core                    DONE
  identity / API binding / label        DONE
  semantic data type                    DONE
  sortable capability                   DONE
  filter capability/operators           DONE
Field defaults + layout/sizing          DONE
Formatter/display-value contract        DONE
Renderer selection contract             DONE
Editing capability/editor/parser        DONE
Formatter/renderer/editor/parser
  runtime registries                    NOT YET DESIGNED IN DETAIL
Validation declarations                 NEXT
Server sort/filter/search mapping       NOT YET DESIGNED
Request/save field mapping              NOT YET DESIGNED
Access/security/masking                  NOT YET DESIGNED
Data-adapter registry contract          NOT YET DESIGNED
Actions/business operations             NOT YET DESIGNED
Grid State/preferences reconciliation   PARTIAL PRINCIPLES ONLY
Config validation/versioning            NOT YET DESIGNED
Final runtime/compiler composition      NOT YET DESIGNED
```

## Finalized root/entity decisions

### Feature

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

- `featureKey` is stable programmatic feature identity.
- Entity identity is the `entities` record key.
- No duplicate `supportedEntities` or `entityKey`.

### Entity

Current entity shape includes:

```ts
labelKey
dataAdapterKey
rowId
fieldDefaults?
fields
```

- `labelKey` is a full explicit translation key.
- `dataAdapterKey` resolves the frontend data/API adapter for load/save/request-response mapping.
- `rowId.path` explicitly identifies stable business-row identity and supports dot notation.
- `fieldDefaults` is optional common field config compiled into AG Grid `defaultColDef` on top of `baseDefaultColDef`.
- `fields` is a readonly ordered list; array order is initial column order, stable identity is field `id`.

## Default-column relationship — finalized

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

Use AG Grid's native `ColDef` over `defaultColDef` precedence for normal overrides. Do not invent a general merge engine.

`fieldDefaults` is deliberately not named `defaultColDef`; it is a bounded public configuration contract, not unrestricted AG Grid configuration.

Current defaults:

```ts
interface FieldDefaultsDefinition {
  sortable?: boolean;
  layout?: FieldLayoutDefinition;
}
```

Do not automatically make every future field behavior defaultable. A defaulted behavior needs clear inheritance and clean explicit override/disable semantics.

## Field core — finalized

Important identity split:

```text
field.id
→ stable configuration identity

field.field
→ API row value location
```

They may differ. `field` supports dot notation and may be strongly narrowed in frontend-owned definitions.

`labelKey` is explicit and full. `dataType` is:

```ts
"text" | "number" | "boolean" | "date" | "dateTime"
```

`sortable` omission inherits resolved `defaultColDef`.

## Filtering — finalized core

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

```text
filter omitted → not filterable
filter present → exact non-empty allowed operator list
```

No `filterable` boolean.

Shared vocabulary matches existing server-backed filter support:

```text
text:    contains, equals, notEqual, startsWith, endsWith
number:  equals, notEqual, greaterThan, greaterThanOrEqual,
         lessThan, lessThanOrEqual
date:    equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

Feature-specific operator keys are allowed only with matching bounded query/backend semantics.

Future configurable compiler must explicitly turn filtering off when `filter` is absent even though shared `baseDefaultColDef` currently has `filter: true`.

## Layout/sizing — finalized

```ts
interface FieldLayoutDefinition {
  initialVisible?: boolean;
  initialPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

Compiler mapping:

```text
initialVisible → inverse of initialHide
initialPinned  → initialPinned
initialWidth   → initialWidth
initialFlex    → initialFlex
minWidth       → minWidth
maxWidth       → maxWidth
resizable      → resizable
```

- `initialWidth` and `initialFlex` mutually exclusive.
- Runtime JSON validation must enforce same rule.
- Initial state seeds columns without continuously overriding Grid State/user changes.
- min/max/resizable remain continuing constraints.
- Reject invalid numeric combinations.

## Formatter — finalized config shape

```ts
interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  key: TFormatterKey;
  params?: ConfigurationJsonObject;
}
```

- registry key + JSON-safe params only;
- compiler resolves to frontend function and AG Grid `valueFormatter`;
- display behavior must not mutate raw data or redefine save/query meaning;
- AG Grid may use formatter output for clipboard/export, so configurable export behavior must be deliberate;
- formatter functions must tolerate transient invalid LOCAL drafts instead of crashing rendering.

Existing Transaction evidence: amount currency formatting and transaction-date formatting use `valueFormatter`.

## Renderer — finalized config shape

```ts
interface FieldRendererDefinition<TRendererKey extends string = string> {
  key: TRendererKey;
  params?: ConfigurationJsonObject;
}
```

- key resolves to frontend React renderer;
- params remain JSON-safe;
- compiler maps to `cellRenderer` / renderer params;
- formatter + renderer may coexist;
- renderer can consume raw and formatted values;
- do not use renderer as a generic escape hatch for actions/access/editing/query behavior.

Existing Transaction evidence: Status uses a React renderer. Access and row actions also use renderers, but those non-data concerns remain separate future configuration areas.

Formatter/renderer are intentionally not in `fieldDefaults` yet because a default behavior must also have clean explicit disable semantics for an individual field. Do not rely on undocumented null/undefined clearing or hidden repair logic.

## Editing — finalized config shape

```ts
interface FieldEditingDefinition<
  TEditorKey extends string = string,
  TParserKey extends string = string,
> {
  editor?: FieldEditorDefinition<TEditorKey>;
  parser?: FieldValueParserDefinition<TParserKey>;
}
```

`FieldDefinition.editing?: ...` has these semantics:

```text
editing omitted → field not editable
editing present → field potentially editable
```

Presence does **not** mean unconditional `editable: true`. The compiler's AG Grid editability callback must compose:

- current resolved access/authorization;
- feature/entity row edit policy;
- tracked-editing conflict policy;
- other current hard constraints.

This preserves existing architecture: feature decides WHAT may edit, shared tracked editing owns HOW edits are tracked/reconciled.

### Editor

```ts
FieldEditorDefinition<TEditorKey>
```

- custom editor selected by frontend registry key;
- optional JSON-safe params;
- optional popup mode;
- popup position `over | under` valid only with `popup: true`;
- compiler maps key → `cellEditor`, params → `cellEditorParams`, popup → `cellEditorPopup`, position → `cellEditorPopupPosition`.

When `editing` exists but `editor` is omitted, compiler may use AG Grid's data-type-selected provided editor. Do not create trivial wrappers just to reproduce native editors.

Existing Transaction evidence:

- account/date/status use custom editors where richer UI/behavior is needed;
- number fields use AG Grid provided number editor;
- account/date popup editors use the AG Grid popup primitives.

### Parser

```ts
interface FieldValueParserDefinition<TParserKey extends string = string> {
  key: TParserKey;
  params?: ConfigurationJsonObject;
}
```

Compiler resolves parser key to frontend behavior and maps it to AG Grid `valueParser`.

Parser output is the **LOCAL draft value**, not the backend save payload.

No parser means editor-produced value becomes local draft unchanged.

AG Grid may also use value parsers for clipboard/fill/import-style flows. Configurable runtime must make that behavior deliberate.

### Value stages — durable distinction

```text
1. authoritative API row value
2. effective grid value (API or LOCAL draft overlay)
3. formatted display value
4. editor-produced candidate
5. optional parser output = LOCAL draft value
6. validation of LOCAL draft
7. save mapping → backend payload          [later]
```

Do not collapse these stages.

### Stable edit identity — important compiler requirement

Configurable dirty/conflict/validation state should key by stable `FieldDefinition.id`.

The actual row value is read/written through `FieldDefinition.field` (or a later bounded accessor). The existing Transactions implementation can use one string for both only because its editable field names happen to equal row property names. Reusable configurable editing must not rely on that coincidence.

### Parser is not a universal normalizer

AG Grid `valueParser` applies to editor/import candidate paths. Programmatic current-page/bulk edits can bypass it. Therefore parser is not advertised as universal normalization.

If later requirements need canonicalization across *every* local edit source, design a separate normalization stage and route every edit source through it explicitly.

## JSON-safe params — finalized base

Public configuration supports recursive JSON-safe values/objects for registry params. Functions, React elements, class instances and other executable values are not valid backend configuration.

Runtime registry validation must check both configured key existence and allowed params shape.

## Current generic strategy

Frontend definitions can narrow field ID/path/translation/data type/custom filter keys/formatter/renderer keys. Editing is one nested generic definition rather than adding separate editor/parser generics directly to the already-large `FieldDefinition` signature.

Do not add generic parameters merely to simulate type safety before a registry's real key-to-param contract exists.

## Provisional / must revisit

- Strong `dataAdapterKey` typing with adapter registry.
- Row-ID path typing if a clean reusable field-path type is introduced.
- Translation key generation/inference and resource structure.
- Formatter/renderer/editor/parser registry implementation and key-to-param typing.
- Whether formatter/renderer/editing become defaultable only after clean disable/inheritance semantics exist.
- Export/copy formatter policy and parser import/clipboard policy.
- Accessor/resolver support only for real non-path fields.
- Runtime config schema/version/error reporting.

## Exact resume point

Resume with **validation declarations**, then continue in larger batches:

1. validation declarations:
   - validator registry keys + JSON-safe params;
   - local vs server validation ownership;
   - message/translation handling;
   - editor/helper-text integration without duplicating rules;
2. server sort/filter/search mapping + searchability;
3. read/write/save mapping;
4. access/security/masking;
5. then adapter/action/page/runtime/compiler layers.

Do not reopen settled field identity/filter/layout/display/editing decisions without a concrete conflict.

## Recent commits / state

- `6c861354b74c793d08fe60a2e937bf710d6762c9` — align field defaults with AG Grid `defaultColDef` and rename initial-state properties.
- `dd1aa71106cc62c3de9fffbf0b365afd04293033` — configurable formatter/renderer display contracts.
- No test/lint/typecheck result should be claimed for connector-only type/docs commits unless actually executed.
