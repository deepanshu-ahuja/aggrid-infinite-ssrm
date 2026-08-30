# Configurable Feature / Metadata-Driven Grid — Consolidated Handoff

> **Status:** architecture/design context only. This document does **not** authorize implementation.
>
> A new chat should read this document first, inspect the current repository/GitHub state when needed, and then follow the user's next explicit instruction. The user may want more schema/design discussion before any code changes.

---

## 1. What we are building

The real unit is a **business feature/page**, not a standalone generic configurable grid and not an entity such as Loan or Finance.

Use a neutral example feature name such as `Review`.

A feature page can contain:

- a grid;
- page-level actions such as Approve / Reject;
- summaries or other sections;
- other feature-specific UI.

Inside that one feature, the **entity/data context can vary**:

```text
Review + Loan
Review + Finance
Review + SomeOtherEntity
```

A different feature may also use Loan but require a different Loan view/configuration:

```text
Review + Loan
AnotherFeature + Loan
```

Those are allowed to have different columns, editing rules, actions, defaults, validation, presentation, etc.

Therefore configuration identity is closer to:

```text
feature/view + entity/context
```

and not simply:

```text
loanConfig
financeConfig
```

---

## 2. Feature ownership vs shared reuse

The feature is the **business ownership/composition boundary**, but not every reusable mechanism has to remain feature-local.

Use this rule:

```text
feature-specific business meaning/composition
    -> feature layer

genuinely reusable, domain-neutral mechanics
    -> shared layer when real reuse exists
```

Things that may become shared when the implementation proves the boundary include:

- configuration-validation primitives;
- generic registry-resolution helpers;
- safe nested-path read/write helpers;
- reusable renderer/editor/formatter plumbing;
- domain-neutral config-to-AG-Grid compiler helpers;
- reusable Grid State reconciliation helpers;
- generic typed adapter contracts;
- shared config-error/Error Boundary presentation primitives.

Things that normally remain feature-owned include:

- Loan/Finance business definitions;
- feature-specific page workflow/actions;
- entity-specific request mapping;
- business-specific validation/action semantics;
- entity-specific renderer/editor behavior when it is not truly reusable.

Do **not** force something into `shared` because it might theoretically be reused someday. Equally, do not duplicate a stable domain-neutral mechanism once genuine reuse exists.

The exact boundary should follow the repository's current conventions and the concrete implementation, not a hypothetical generic framework.

---

## 3. First proof: new isolated SSRM feature

Start by proving the architecture with **one new isolated configurable SSRM feature**.

The existing three proven grids must remain untouched during this experiment:

- existing Client grid;
- existing Infinite grid;
- existing SSRM grid.

Use their behavior/mechanics as reference/reusable foundation where appropriate, but do not refactor them merely to enable the experiment.

After configurable SSRM is genuinely proven, configurable Client and Infinite versions may be considered separately.

Do not build one universal row-model engine. Client, Infinite and SSRM keep their row-model-specific lifecycles where those differ.

---

## 4. Branch decision and PR #40

A **new branch from the latest `main`** is the real working branch for this direction.

Initially that branch should contain only this handoff document.

Conceptually:

```text
latest main
    -> new configurable-feature branch
    -> this handoff only
    -> further discussion/schema review
    -> implementation only after explicit approval
```

PR #40 was created before the requirements were fully discussed. It must be treated only as a **reference experiment**.

Important rules:

- do not merge PR #40 into `main` for this work;
- do not use its implementation as the architectural foundation merely because code already exists;
- a future chat may inspect it to understand what was tried;
- reuse an idea only when it aligns with this handoff, current repository conventions, and the user's later approved design;
- whether PR #40 is closed can be decided separately.

---

## 5. Frontend vs backend responsibility

The frontend must not become a duplicate backend authorization engine.

### Frontend responsibility

Frontend access/configuration shapes the correct UX, for example:

- whether a route/feature is shown;
- whether a column is present;
- visible vs read-only vs editable;
- whether an action is shown/disabled;
- whether filter/search/copy/export/etc. is available;
- renderer/editor/formatter selection;
- presentation defaults;
- user Grid State reconciliation.

### Backend responsibility

Backend remains authoritative for:

- authorization;
- protected/sensitive data;
- saves and bulk updates;
- Approve/Reject or other protected operations;
- authoritative validation;
- masking/unmasking policy and returned sensitive values.

If a user's permission changes while stale frontend UI is still open and the user submits an operation, backend must reject it when no longer authorized.

Do not build complicated live permission reconciliation just to reproduce backend security checks in the frontend.

---

## 6. Access/configuration lifetime

Configuration and role/access are not expected to change frequently while a page is open.

Normal flow:

```text
application starts
    -> fetch current user/access
    -> routing determines accessible features
    -> user enters feature
    -> resolve feature + entity base config
    -> apply current-user access projection
    -> reconcile valid saved user preferences
    -> build effective page/grid inputs
    -> keep that result stable for the page session
```

Do not build a hot-swapping system where columns/actions are continuously added/removed while someone has dirty edits.

If current-user information is later refetched periodically:

- feature-level loss of access can be handled by routing;
- inside-feature changes can take effect on reload/re-entry;
- no complex dirty-edit reconciliation is required unless a future real requirement asks for it.

---

## 7. Temporary local demo choices

For the local proof, keep at least these two temporary selections in `localStorage`:

### Current mock role/profile

Examples:

```text
profileA
profileB
```

This simulates a future backend-resolved current-user access projection.

### Current entity/data type

Examples:

```text
Loan
Finance
```

Changing these and refreshing/re-entering the feature should visibly prove different effective configurations.

The low-level grid must not contain scattered code such as:

```ts
if (role === 'profileA') { ... }
if (entity === 'loan') { ... }
```

Role/profile and entity are resolved at the feature/configuration boundary.

---

## 8. Keep the configuration layers distinct

### A. Feature + entity base definition

This says what the feature *can support* for that entity.

Example: `Review + Loan` may support Amount, Status, Borrower information, selected editing, masking, specific renderers/editors, default state and feature actions.

### B. Current-user access projection

This says what the current user actually gets.

Example:

```text
base definition:
Status supports editing

user access:
Status visible but read-only

effective result:
Status visible + read-only
```

Or:

```text
base definition:
SensitiveReference exists

user access:
no access

effective result:
field absent
```

### C. Runtime row/value state

This is separate from both definition and entitlement.

For sensitive data, concepts such as these are distinct:

```text
maskable
canRequestUnmask
masked
```

### D. User presentation preferences

Saved Grid State is also separate. It can override configured presentation defaults only where the current effective definition/authorization still permits it.

---

## 9. Effective flow

```text
Feature + Entity Base Definition
             +
Resolved Current-User Access
             +
Valid Saved User Preferences
             v
      validate / reconcile
             v
 frontend registries / mappers
             v
 strongly typed effective inputs
             v
 configurable SSRM feature
             v
 existing/proven SSRM/editing/state mechanics
```

Low-level SSRM mechanics should not ask whether the data is Loan, Finance or profileA. They should receive already-resolved normal inputs.

---

## 10. Readability/comments/documentation are hard requirements

This architecture must be unusually easy for another developer to understand.

Configuration and non-obvious flow/registry/lifecycle code need clear comments that explain **meaning and ownership**, not vague comments that repeat syntax.

Bad:

```ts
// renderer config
renderer: { ... }
```

Good:

```ts
// Displays the business status using the shared status-pill renderer.
// The config stores only a registry key and JSON-safe params; the compiler
// resolves the key to the actual React renderer. Unknown keys are invalid.
renderer: {
  key: 'statusPill',
  params: { compact: true },
}
```

Useful comments should explain where relevant:

- what a property means;
- why it exists;
- who consumes it;
- what happens when it is omitted;
- config-owned vs frontend-owned responsibility;
- important lifecycle/precedence decisions.

Do not comment every trivial line. Comment reasoning, ownership and flow.

Maintain architecture/workflow documentation with diagrams where that materially improves understanding.

---

# 11. Configuration surface that must be considered before freezing the schema

The goal is **not** to expose every AG Grid option. The goal is to review realistic variability once so the schema does not begin artificially tiny and repeatedly break as real cases appear.

For each property, decide whether it belongs to:

- business/product config;
- resolved authorization;
- user preference;
- frontend registry/mechanic;
- runtime row/value state.

The following are real candidates.

---

## 11.1 Stable column ID vs field

Each column should have an explicit stable configuration identity.

Conceptually:

```ts
{
  id: 'borrowerName',
  field: 'borrower.name',
}
```

`id` is stable configuration/Grid-State identity.

`field` describes where the value comes from when a direct data path is sufficient.

Do not assume `id` and `field` are always the same.

An optional semantic/business key may exist where real business behavior needs it, but do not infer business meaning from renderer names.

---

## 11.2 Nested API values / dot paths are a normal requirement

API rows can be nested:

```json
{
  "loan": {
    "borrower": {
      "name": "Alice"
    }
  }
}
```

Configuration must consider paths such as:

```text
loan.borrower.name
```

A simple nested field can conceptually be represented as:

```ts
field: 'loan.borrower.name'
```

Do not design around flat API rows only.

If a value cannot be expressed safely as a direct field path, use a **bounded frontend accessor/getter registry**, not arbitrary executable JavaScript in metadata.

Conceptually:

```ts
{
  id: 'borrowerDisplay',
  valueAccessorKey: 'borrowerDisplay',
}
```

Only use such an accessor when a direct path is genuinely insufficient.

---

## 11.3 Nested editing/writing is separate from nested reading

Reading `a.b.c` is only half the problem.

Example row:

```json
{
  "loan": {
    "pricing": {
      "interestRate": 0.075
    }
  }
}
```

Config may read:

```text
loan.pricing.interestRate
```

But editing can involve:

```text
API value       0.075
Display         7.50%
Editor input    7.5
Save value      0.075
```

The architecture therefore has to consider:

- nested read path;
- updating the local nested edit value;
- editor representation;
- parser/normalizer;
- save-request mapping.

Do not assume `field` alone solves every editable nested value.

---

## 11.4 Data type

A logical/application type may be useful for consistent behavior:

```text
string
number
date
boolean
enum
currency
percentage
```

Only model this where it provides real product/application value. Do not simply expose AG Grid internals as metadata.

---

## 11.5 Labels/help/tooltips

Consider where genuinely required:

- header/label;
- description/help;
- tooltip metadata.

---

## 11.6 Presentation defaults

The feature/entity definition may supply defaults such as:

- width/minWidth/maxWidth;
- initial visibility;
- initial order;
- pinning;
- default sort;
- supported filtering;
- other genuine product presentation defaults.

These are defaults, not user preferences.

---

## 11.7 Renderers

Config contains a **registry key**, not a React component/function.

Conceptually:

```ts
renderer: {
  key: 'statusPill',
  params: {
    compact: true,
  },
}
```

Frontend registry resolves:

```text
statusPill -> actual React/AG Grid renderer
```

The renderer already receives AG Grid's normal params such as value/data/node/api information.

Config may add extra JSON-safe params through the normal cell-renderer-param mechanism.

Do not duplicate information in metadata when the renderer can read it from AG Grid's own params.

If truly dynamic component params are needed beyond JSON + normal AG Grid params, allow a bounded frontend resolver key. Do not make every parameter a callback.

---

## 11.8 Formatters

Same model:

```ts
formatter: {
  key: 'currency',
  params: {
    currencyCode: 'USD',
  },
}
```

Executable formatter remains frontend code.

---

## 11.9 Editors and editor params

Custom React editors are valid and expected.

Conceptually:

```ts
editing: {
  supported: true,
  editor: {
    key: 'statusSelect',
    params: {
      optionsSourceKey: 'loanStatuses',
    },
  },
}
```

Frontend resolves:

```text
statusSelect -> actual React editor
loanStatuses -> actual option/query/provider logic
```

The editor itself receives normal AG Grid editor params plus our allowed extra params.

---

## 11.10 Display value, editor value and save value can differ

These are real cases and must be considered when the schema is reviewed.

### Percentage

```text
API      0.075
Display  7.50%
Editor   7.5
Save     0.075
```

### Date

```text
API      "2026-08-30"
Display  "30 Aug 2026"
Editor   date/input representation
Save     "2026-08-30"
```

### Lookup

```text
API      "APR"
Display  Approved
Editor   Approved
Save     "APR"
```

Therefore consider frontend-owned concepts such as:

- formatter;
- parser;
- normalizer;
- lookup mapping;
- save conversion.

The exact property names are **not finalized**. The principle is:

```text
config identifies known behavior
frontend registry owns executable behavior
```

---

## 11.11 Read-only/editable/hidden are distinct

Example:

```text
Loan base definition:
Amount supports editing

Profile A:
Amount editable

Profile B:
Amount read-only

Profile C:
Amount absent
```

Resolve this before low-level grid mechanics consume the field definition.

---

## 11.12 Existing tracked editing must remain the editing engine

Do not create a separate metadata editing state machine.

When a field is effectively editable, reuse the proven mechanics for:

- dirty tracking;
- Save/Discard;
- single-row save;
- bulk save where supported;
- BASE / LOCAL / REMOTE reconciliation;
- conflict handling;
- validation interaction.

Configuration supplies composition inputs; it does not rewrite those algorithms.

Do not invent a `tracked: true` flag unless a real case appears where something is editable but intentionally must not participate in tracked editing.

---

## 11.13 Validation

Validation remains independently reusable.

Metadata/config may identify stable rule keys and JSON-safe params:

```ts
validation: {
  rules: [
    { key: 'required' },
    {
      key: 'range',
      params: { min: 0, max: 100 },
    },
  ],
}
```

Frontend owns validator functions.

Backend remains authoritative for final validation.

Existing invalid-edit behavior should remain consistent with the established editing/validation mechanics.

---

## 11.14 Lookups/options

Editors/renderers may need option sets such as statuses, categories or reason codes.

Static JSON-safe options may live in config when appropriate.

Dynamic options should resolve through a known frontend provider/query key.

Normal application data queries for these can use TanStack Query where appropriate.

---

## 11.15 Stable row identity is required

Do not casually assume every entity uses a property called `id`.

The feature/entity contract should explicitly provide stable row identity, conceptually through a path or, only when necessary, a bounded frontend accessor.

Example:

```ts
rowIdentity: {
  field: 'loanId',
}
```

This matters for:

- editing;
- selection;
- SSRM refresh;
- reconciliation;
- Save/Discard;
- stable row behavior.

Prefer a simple path when possible.

---

## 11.16 Datasource/API adapters

Loan and Finance may use different backend contracts.

Conceptually:

```text
Review + Loan
    -> Loan adapter
    -> Loan request mapper / service functions

Review + Finance
    -> Finance adapter
    -> Finance request mapper / service functions
```

The reusable grid must not contain:

```ts
if (entity === 'loan') { ... }
if (entity === 'finance') { ... }
```

Config may identify a known adapter key:

```ts
data: {
  adapterKey: 'reviewLoan',
}
```

Frontend executable code may look conceptually like:

```ts
const dataAdapterRegistry = {
  reviewLoan: {
    loadRows: loadLoanRows,
    saveRow: saveLoanRow,
    saveRows: saveLoanRows,
  },
  reviewFinance: {
    loadRows: loadFinanceRows,
    saveRow: saveFinanceRow,
    saveRows: saveFinanceRows,
  },
};
```

Those are **plain async service/API functions**, not React hooks.

Exact adapter shape is not finalized. Loading and write adapters may be separated if the concrete architecture is clearer that way.

---

## 11.17 TanStack Query boundary

The user is **not** asking to use TanStack Query for AG Grid SSRM row/block loading.

For normal application/API queries and mutations, use TanStack Query where it fits the established architecture, for example:

- user/session queries;
- option/lookup queries;
- page-action mutations;
- normal write mutations where the current editing design uses them.

The registry contains plain service functions; React composition can wrap those functions in `useQuery` / `useMutation` where appropriate.

Do not store TanStack hooks or mutation instances in registries.

AG Grid SSRM datasource lifecycle should remain responsible for SSRM row/block requests.

---

## 11.18 Server sort/filter/search mapping

Do not assume a UI field/path always maps 1:1 to backend query syntax.

Different entity adapters may need to map:

- sort fields;
- filter fields/operators;
- search fields;
- SSRM block/range requests;
- UI IDs/paths to backend field names.

Keep those mappings in a typed adapter/mapper boundary rather than scattering entity checks through grid code.

---

## 11.19 Feature/page capabilities

The feature page is bigger than the grid.

Example:

```text
Review + Loan
    -> summary section
    -> Approve
    -> Reject
    -> SSRM grid

Review + Finance
    -> small section differences
    -> perhaps different supported page actions
    -> SSRM grid
```

Leave room for bounded feature-level configuration where real differences appear.

Do **not** build a generic page-builder.

---

## 11.20 Actions

Page/grid actions remain real frontend behavior.

Config may eventually indicate that an action is supported/visible/disabled.

Frontend owns actual handler/mutation/pending/error behavior.

Backend authorizes execution.

Do not build a giant generic action framework now.

If a user's access projection removes a field/action combination, the resolved configuration can simply omit both. Do not invent complex runtime authorization dependency logic.

---

## 11.21 Dependencies between fields/actions

Do not build a generic dependency engine initially.

Example:

```text
Profile B does not receive Status
and Profile B also does not receive Approve
```

Then no runtime dependency resolver is necessary.

If real config dependencies later become hard to maintain, a development-time concept such as:

```ts
requires: ['currencyCode']
```

may be introduced and validated.

Only add it after a real requirement proves the need.

---

## 11.22 Masking/sensitive data

Never send the clear sensitive value to the frontend and merely obscure it in React.

Backend must return the authorized representation.

Keep separate concepts such as:

```text
maskable
canRequestUnmask
masked
```

If unmask is supported, clear values must not be persisted into:

- localStorage;
- saved Grid State;
- long-lived user preferences.

A fresh page/session gets whatever representation backend currently authorizes.

---

## 11.23 Masking affects secondary capabilities too

If the current user is restricted from the underlying value, avoid side channels.

Depending on policy, remove/disable:

- filter;
- search;
- copy/clipboard;
- export;
- tooltip;
- sort;
- aggregation;
- any other derived operation that could expose or infer the protected value.

Start restrictive. Allow a capability only when the real product/security requirement says it is safe.

---

## 11.24 Initial Grid State and user preferences

A feature/entity definition may provide presentation defaults:

- order;
- width;
- pinning;
- visibility;
- default sort;
- other genuine defaults.

If the user has no saved preferences, use configured defaults.

If the user has saved preferences, the user's presentation preferences override those defaults where still valid.

But current authorization/effective configuration always wins.

Saved state must never restore a field or capability that is no longer available.

---

## 11.25 Reconcile saved state across definition changes

Do not treat saved Grid State as a complete replacement for new configuration defaults.

Example:

```text
definition v3 -> 8 columns
definition v4 -> 10 columns
```

Reconcile so that:

- surviving user preferences are retained;
- removed columns remain removed;
- new columns receive sensible configured defaults;
- unauthorized columns never return.

---

## 11.26 Schema/definition versions

Include version concepts from the beginning, at least conceptually:

```text
schemaVersion
definitionVersion
```

`schemaVersion` identifies the metadata contract shape.

`definitionVersion` identifies a particular feature/entity definition revision.

This helps with user-state reconciliation, caching/invalidation and future remote config compatibility.

It does **not** imply live runtime configuration updates.

---

## 11.27 Configuration validation

Validate config before rendering.

Examples of invalid configuration:

- duplicate column IDs;
- missing required row identity;
- unknown renderer/editor/formatter keys;
- invalid required properties;
- unsupported schema version;
- logically impossible config shapes that the chosen contract can detect.

Because config is frontend-owned initially, tests should catch these during development/CI.

The same validator can later protect the app from incompatible backend-provided configuration.

---

## 11.28 Error ownership and Error Boundary

Keep these separate:

### Configuration error

Example: unknown renderer key.

Handle through controlled feature/view configuration failure.

### SSRM row-loading error

Example: row endpoint returns 500.

Use normal grid loading/retry behavior.

### Mutation/action error

Example: save or Approve request fails.

Use the normal mutation/action error flow.

### Unexpected React/runtime crash

Use a React Error Boundary around the feature/page.

A small controlled invalid-config state is worthwhile:

```text
resolve/load config
    -> validate
    -> valid: render feature
    -> invalid: controlled "Unable to load this view" state
```

Do not build complex remote-config fallback/retry systems until there is a real requirement.

---

## 11.29 Native AG Grid first

Use AG Grid's native behavior when it solves the problem.

Configuration/metadata should compile into normal AG Grid inputs.

Do not recreate native mechanics inside a custom framework without a concrete reason.

---

## 11.30 No giant universal wrapper

Do not create a vague abstraction such as:

```text
UniversalGrid
DynamicGridEngine
useGridEverything()
rowModel="client|infinite|ssrm"
```

The metadata/compiler layer should produce small strongly typed inputs for proven mechanics.

Central principle:

> **Make configuration dynamic. Do not make the grid engine vague.**

---

# 12. Representative Python/backend data for the proof

The Python backend should provide enough representative data to genuinely prove the architecture.

At minimum consider:

```text
Loan dataset
Finance dataset
```

The shapes should differ enough to prove real configuration behavior rather than merely renaming Transaction columns.

A Loan row could include examples such as:

- loan ID;
- nested borrower object;
- amount;
- nested pricing/interest rate;
- status;
- sensitive reference/account field;
- date;
- editable field(s).

A Finance row should have a meaningfully different shape and some different renderer/editor/formatter/editability requirements.

If masking is demonstrated, the backend should return masked data directly for restricted profiles.

If unmask is demonstrated, use a mock authorized endpoint that returns the clear value only for the allowed case.

Only add endpoints/mutations required to prove agreed capabilities. Do not overbuild the backend merely for the demo.

---

# 13. Proof matrix

One entity and one profile is not enough because accidental hardcoding could appear configurable.

At minimum prove something like:

```text
                 Profile A       Profile B

Review + Loan    effective A1    effective A2
Review + Finance effective B1    effective B2
```

Use that to prove meaningful differences such as:

- visible/hidden columns;
- editable/read-only fields;
- masked/restricted fields;
- renderer/editor/formatter differences;
- nested fields;
- initial state;
- user Grid State precedence;
- entity-specific datasource/request mapping.

The goal is architectural proof, not a huge demo.

---

# 14. Illustrative config shape only

The following is **not a finalized contract**. It exists only so another chat understands the intended type of separation.

```ts
const reviewLoanDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,

  id: 'review.loan',
  entity: 'loan',

  rowIdentity: {
    field: 'loanId',
  },

  data: {
    adapterKey: 'reviewLoan',
  },

  initialGridState: {
    sort: [
      { columnId: 'createdAt', direction: 'desc' },
    ],
    pinnedColumns: ['status'],
  },

  pageCapabilities: {
    actions: ['approve', 'reject'],
  },

  columns: [
    {
      id: 'borrowerName',
      field: 'borrower.name',
      header: 'Borrower',
      filter: { supported: true },
    },
    {
      id: 'interestRate',
      field: 'pricing.interestRate',
      header: 'Interest Rate',
      formatter: {
        key: 'percentage',
        params: { decimalPlaces: 2 },
      },
      editing: {
        supported: true,
        editor: { key: 'percentageInput' },
        valueParserKey: 'percentageInputToDecimal',
      },
      validation: {
        rules: [
          {
            key: 'range',
            params: { min: 0, max: 100 },
          },
        ],
      },
    },
    {
      id: 'status',
      field: 'status.code',
      header: 'Status',
      renderer: {
        key: 'statusPill',
        params: { compact: true },
      },
      editing: {
        supported: true,
        editor: {
          key: 'statusSelect',
          params: {
            optionsSourceKey: 'loanStatuses',
          },
        },
      },
    },
    {
      id: 'accountReference',
      field: 'account.reference',
      header: 'Account Reference',
      sensitivity: {
        maskable: true,
      },
    },
  ],
};
```

A current-user projection could reduce that definition:

```ts
const profileBLoanAccess = {
  columns: {
    borrowerName: { visible: true },
    interestRate: {
      visible: true,
      editable: false,
    },
    status: {
      visible: false,
    },
    accountReference: {
      visible: true,
      masked: true,
      canRequestUnmask: false,
      filter: false,
      sort: false,
      copy: false,
      export: false,
    },
  },

  pageCapabilities: {
    actions: [],
  },
};
```

The grid consumes the **effective result**. It does not interpret `profileB` itself.

Again: property names above are illustrative. The concrete schema must be reviewed against the real repository and full use cases before being frozen.

---

# 15. Registry/compiler mental model

Configuration may identify keys such as:

```text
renderer key  = statusPill
editor key    = statusSelect
formatter key = percentage
adapter key   = reviewLoan
```

Frontend registries resolve them to actual executable implementations:

```text
statusPill  -> StatusPillRenderer
statusSelect -> StatusSelectEditor
percentage  -> percentageFormatter
reviewLoan  -> Loan service/request adapter
```

Conceptual flow:

```text
declarative config
    -> validate keys/shape
    -> resolve known frontend implementations
    -> compile small normal typed feature/ColDef inputs
    -> feed proven page/grid mechanics
```

Backend must never send:

- React components;
- arbitrary JavaScript functions;
- AG Grid callback functions;
- executable code.

---

# 16. Implementation principles once the user explicitly approves implementation

1. Inspect current GitHub/repository state first.
2. Read root `AGENTS.md` and all applicable project/grid rules.
3. Read the current SSRM implementation fully.
4. Read current editing, validation, selection, Grid State, datasource and query-lifecycle code.
5. Inspect PR #40 only as reference.
6. Continue from this new branch, which was created from current `main` and initially contains only this handoff.
7. Keep the existing Client/Infinite/SSRM grids untouched.
8. Use the current SSRM feature behavior as the baseline/reference for the new isolated feature.
9. Reuse proven mechanics rather than rewriting them.
10. Extract genuinely domain-neutral reusable mechanisms to shared only when the concrete implementation proves that boundary.
11. Keep business-specific composition under the feature.
12. Keep code strongly typed.
13. Prefer native AG Grid.
14. Keep role/entity resolution outside low-level grid mechanics.
15. Keep executable behavior in frontend registries/adapters.
16. Keep config declarative/JSON-safe where practical so it can later come from backend.
17. Validate configuration.
18. Add focused tests for configuration/resolution/compiler behavior and real-grid behavior.
19. Add/update architecture/workflow and manual verification documentation as required by repository rules.
20. Use clear explanatory comments for non-obvious ownership/lifecycle/flow.
21. Do not automatically migrate the original three grids after the experiment succeeds.
22. Do not merge without explicit user approval.

---

# 17. Explicitly not required now

Do not build these unless a real future requirement appears:

- live config/permission hot-swapping while editing;
- dirty-edit reconciliation after a role changes remotely;
- generic dependency engine;
- giant configurable action framework;
- generic page builder;
- universal Client/Infinite/SSRM component;
- arbitrary JavaScript in metadata;
- every AG Grid option exposed in config;
- complicated remote-config fallback/retry architecture;
- frontend duplication of backend authorization.

---

# 18. Intended developer experience

The architecture should make a future addition look roughly like:

```text
Add Review + NewEntity
    -> write a clear base definition
    -> add only the frontend registry/adapter implementations it genuinely needs
    -> define access projection(s)
    -> reuse SSRM/editing/validation/Grid-State/shared mechanics
```

Adding a new entity should **not** require rewriting grid lifecycle logic.

At the same time, low-level shared grid code should not learn every Loan/Finance/business concept.

---

# 19. How a new chat should use this document

This is the **single consolidated context handoff**.

A new chat should read it completely first. It should then inspect current repository/GitHub state when required for the user's next request, including PR #40 as reference only.

This file intentionally does **not** decide what the user's first request in the new chat must be. The user may choose to:

- continue architecture discussion;
- ask to review/propose the complete concrete schema;
- compare this design with the current repository;
- ask for an implementation plan;
- or explicitly approve implementation.

A separate short starting prompt can be created later once the user decides how they want to start that chat.

Do not mistake illustrative config property names for finalized contracts.

Do not assume PR #40 is the desired architecture simply because it exists.

Do not start implementation merely from reading this document; follow the user's next explicit instruction.
