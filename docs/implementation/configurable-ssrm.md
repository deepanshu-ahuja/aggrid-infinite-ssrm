# Configurable SSRM runtime

The isolated `/configurable-ssrm` route now proves a business-agnostic configurable SSRM feature/runtime rather than a Transaction-only configurable grid.

Existing `/client`, `/infinite`, `/ssrm`, and `/ssrm-native-editing` remain independent Transaction references and are not refactored through this path.

## Current implemented flow

```text
frontend base FeatureDefinition
("what can this feature support?")
        +
frontend-only simulated current-user access profile
("what may this user receive/do?")
        ↓
resolveFeatureAccess
        ↓
resolved feature/entities/fields
        ↓
active entity choice
        ↓
ConfigurableSsrmEntityGrid<TData>
        ↓
application configurable-SSRM defaults + resolved entity.gridOptions
        ↓
compiler / registries
        ↓
native GridOptions + ColDef[] + getRowId
        ↓
AgGridReact SSRM lifecycle
        ↓
entity-specific rows loader
        ↓
native editing / validation
        ↓
useGridDraftEditing BASE + LOCAL
```

AG Grid still owns native grid/editing behavior. The configurable compiler does not create a replacement grid API.

## Generic feature/entity boundary

`FeatureDefinition` is business-agnostic. Entity identity lives in `FeatureDefinition.entities` keys.

The current FE-only Review example defines one feature with two genuinely different entity/data shapes:

```text
review
├── loan
│   ├── LoanReviewRow
│   └── borrower / principal / status / internalScore
└── finance
    ├── FinanceReviewRow
    └── facility / counterparty / exposure / currency / reviewStatus
```

The shared `ConfigurableSsrmEntityGrid<TData>` has no knowledge of Loan, Finance, Transaction, roles, or localStorage. It receives an already-resolved `EntityDefinition`, an entity-specific `GridRowsLoader<TData>`, registries, and a label resolver. The concrete SSRM lifecycle remains visible inside this root.

The old Transaction configurable consumer files remain as earlier proof/reference code, but `/configurable-ssrm` now renders the Review feature so the route proves that the configurable runtime is not Transaction-shaped.

## Base definition versus current-user projection

The base feature/entity definition describes everything that business context can support.

A separate current-user access projection narrows it:

```text
base entity fields/capabilities
        +
current-user projection
        ↓
resolved entity
```

Current access semantics are intentionally small:

- omitting a feature means the user cannot access that feature;
- omitting an entity means the user cannot access that entity;
- omitting a field means the field is not delivered to the configurable grid;
- field access `read` forces that resolved field to `editable: false`;
- field access `edit` preserves the base field's editability but can never promote a base read-only field.

This means authorization removes unavailable configuration rather than merely applying CSS hiding.

`configuration.access.ts` validates references to entity keys and field `colId` values and fails controlledly for an invalid local/access projection.

## FE-only development profiles

There is no real authentication/authorization backend for this configurable experiment yet. The current implementation intentionally simulates already-resolved current-user access in frontend code.

The profile selector is stored in localStorage:

```text
aggrid.devAccessProfile
```

Supported values:

```text
loanOnly
financeOnly
loanAndFinance
loanReadOnly
```

Default when missing/invalid:

```text
loanAndFinance
```

The currently opened entity is a separate localStorage value:

```text
aggrid.devActiveEntity = loan | finance
```

This separation is important. A simulated user with `loanAndFinance` access can open Loan or Finance independently; profile identity does not double as navigation state.

After changing either localStorage value, reload `/configurable-ssrm`.

These localStorage values are development tooling only and are **not a security boundary**. Later backend authorization should replace the development access provider with a resolved current-user manifest while the resolver/grid boundary stays stable.

## Trusted local configuration versus future backend JSON

The Review base feature is authored as typed frontend code and uses TypeScript `satisfies FeatureDefinition<...>`. It is not forced through the backend/storage `unknown` normalization boundary merely to imitate a transport that does not exist yet.

Current rule:

```text
trusted frontend-authored configuration
        ↓
TypeScript + controlled compiler assertions
        ↓
compiler
```

Future backend/storage rule:

```text
backend/storage JSON (`unknown`)
        ↓
runtime validation / normalization
        ↓
normalized frontend configuration
        ↓
same access/compiler/runtime pipeline
```

`configuration.normalizer.ts` remains available for a real runtime JSON boundary and for the earlier backend-like Transaction proof. It is not required simply because a local frontend object could theoretically be stored remotely later.

## Defaults and compilation

`configuration.defaults.ts` defines application policy for the configurable SSRM path.

The defaults reuse server-backed pagination/cache values, use `invalidEditValueMode = "block"`, enable native multi-row selection and Cell Selection, and provide common one-condition Simple Filter behavior.

The configurable defaults explicitly set `defaultColDef.sortable = false` and `defaultColDef.filter = false`. A server-backed configurable field must opt into query behavior only when its data adapter can execute matching semantics.

`entity.gridOptions` overrides application defaults. The existing deterministic nested merge semantics remain unchanged.

Each resolved field becomes a normal `ColDef`. The compiler maps `labelKey` to `headerName`, keeps native declarative properties native, resolves registered formatter/parser/validator behavior, merges native `getValidationErrors`, and compiles `rowId.path` to AG Grid `getRowId` plus the draft-state row accessor.

## Current Review data source

Loan and Finance currently use tiny frontend-only in-memory row loaders. This is deliberate for the access/profile experiment: it proves different row data types and entity definitions without inventing backend Loan/Finance APIs before those contracts exist.

The local loaders do not implement server sort/filter semantics, and the Review entity fields therefore leave sorting/filtering disabled. The previous Transaction adapter remains the reference for real server query mapping.

When a real entity backend is introduced, supply a feature-owned `GridRowsLoader<TData>`/request mapper. Do not infer arbitrary backend query fields from configured AG Grid columns.

## Editing

Resolved `editable` metadata drives native AG Grid editing. `read` access is applied before compilation, so native single-cell editing, Fill Handle, clipboard and other edit entry points see the same final editability.

The generic root composes `useGridDraftEditing` and retains only dirty BASE + LOCAL fields by stable row ID. Save/read-write mapping is still not implemented on this route.

## Current limits

The configurable Review runtime does **not** yet implement:

- real backend authentication/authorization;
- backend-provided feature/access metadata;
- business actions/action authorization;
- masking/unmask flows;
- configurable Save/read/write mapping;
- row-specific authorization/capability payloads;
- Grid State/access reconciliation;
- runtime config schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE/conflict/concurrency/versioning.

These remain separate contracts rather than speculative properties added to the current metadata surface.

## Source and verification

Key source:

- `frontend/src/shared/grid/configurable/configuration.access.ts`
- `frontend/src/shared/grid/configurable/ConfigurableSsrmEntityGrid.tsx`
- `frontend/src/features/review/configurable/reviewConfigurableFeature.ts`
- `frontend/src/features/review/ReviewConfigurableSsrmFeature.tsx`
- `frontend/src/shared/grid/configurable/configuration.compiler.ts`
- `frontend/src/shared/grid/configurable/configuration.defaults.ts`

Focused tests cover access projection and the existing compiler/defaults/normalizer contracts. Playwright covers localStorage profile/entity selection, entity/field removal, read-only projection, and native validation + BASE/LOCAL editing on the real `/configurable-ssrm` route.

Manual verification steps are in [`testing/configurable-ssrm-manual-testing.md`](testing/configurable-ssrm-manual-testing.md).

Do not treat documented manual steps as executed unless they were actually run.
