# Configurable Feature Concepts

Plain-language meanings for the implemented configurable SSRM model.

## Core meanings

```text
Feature definition
→ overall configurable business feature.

Entity key
→ stable business/configuration identity inside a feature.

Entity definition
→ one configurable data context.

Data adapter key
→ frontend-owned API/loading/request-mapping registry selector.

Row identity
→ JSON-safe row field/path compiled into AG Grid getRowId.

Grid options
→ bounded JSON-safe native AG Grid options.

Field definition
→ one normalized native-first column definition.

colId
→ stable AG Grid column/config identity.

field
→ actual row/API value path.

validationRules
→ declarative rule keys/params/messages resolved by frontend validators.

valueFormatterKey / valueParserKey
→ safe frontend selectors for executable AG Grid callbacks.
```

## Trust boundary

```text
backend/storage JSON
→ validate + normalize ALWAYS
→ defaults + merge
→ registry resolution + compilation
→ AG Grid
```

TypeScript does not validate backend JSON, even when the property names match AG Grid exactly.

## Native-first rule

Use AG Grid names and types when the concept and persisted value semantics are native. Use a custom application descriptor only when persisted JSON cannot safely carry the native executable value.

That is why `filter` / `filterParams` / `cellEditor` / `cellRenderer` keep native names, while `valueFormatterKey` / `valueParserKey` are application registry selectors.

## Defaults are runtime application policy

The configurable SSRM application defaults reuse the existing server-backed pagination/cache settings. They explicitly disable default sorting/filtering until a field enables them because the application's global AG Grid defaults are intentionally broader than the server contract.

`entity.gridOptions` then overrides those defaults with deterministic nested merge behavior.

## Server filtering

A native filter is configurable only when the active data adapter/backend can execute the same model semantics. JSON-safe does not imply server-safe. The current flat contract supports one Simple Filter condition per field.

## Business policy remains runtime-owned

Metadata may say `editable: true`. The final native `ColDef.editable` can still be a frontend business/access callback. This single native callback governs normal editing, Fill Handle, paste, Ctrl+D/Ctrl+Enter and other AG Grid edit entry points. The application does not implement separate range-edit eligibility logic.

Likewise, `isRowSelectable` stays executable runtime business policy.

## Validation

Configuration carries rule declarations, not validator functions.

```text
validationRules
→ frontend validator registry
→ native editor getValidationErrors
→ AG Grid commit/block lifecycle
```

Invalid values blocked by AG Grid never enter draft state.

## Lightweight draft state

The configurable SSRM route composes `useGridDraftEditing` from the native-editing reference:

```text
rowId
└── dirty field
    ├── baseValue
    └── value
```

It stores no full SSRM blocks and adds no React Query original-row cache.

## Current first consumer

The Transaction configurable definition is intentionally written as backend-like `unknown` JSON and immediately normalized. Its runtime adapter still owns the existing Transaction endpoint and `mapTransactionGridRequest`.

The shared compiler does not know Transaction field allowlists or backend query payloads.

## Current deliberate limits

Save/read/write mapping, actions, security/masking, Grid State/access reconciliation, runtime config schema/versioning, grouping/pivot/tree/aggregation, and concurrency/conflict semantics remain later contracts.

See `docs/implementation/configurable-ssrm.md` for implemented truth.
