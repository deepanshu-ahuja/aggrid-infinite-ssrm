# Configurable Feature / Metadata-Driven Grid — Consolidated Handoff

> **Status:** architecture/design context only. This document does **not** authorize implementation.
>
> A new chat should read this document first, inspect the current repository/GitHub state when needed, and then follow the user's next explicit instruction. The user may want more schema/design discussion before any code changes.

---

## 1. What we are building

The real unit is a **business feature/page**, not a standalone generic configurable grid and not an entity such as Loan or Finance.

Use a neutral example feature name such as `Review`.

A feature page can contain:

- an SSRM grid;
- page-level actions such as Approve / Reject;
- summaries or other sections;
- other feature-specific UI.

Inside that feature, the **entity/data context can vary**:

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

Those are allowed to have different columns, editing rules, actions, defaults, validation, presentation, API mapping, etc.

Therefore configuration identity is closer to:

```text
feature/view + entity/context
```

not simply:

```text
loanConfig
financeConfig
```

The configurable grid is an architectural capability underneath the feature; it is not the feature itself.

---

## 2. Feature-level vs shared-level reuse

The feature is the business ownership boundary, but not every reusable mechanism must remain inside the feature.

Use the normal ownership rule:

```text
feature-specific business meaning / composition
    → keep under the feature

genuinely reusable, domain-neutral mechanics
    → shared layer when reuse is real and useful
```

Examples that may become shared when the implementation proves the reuse:

- metadata/config validation primitives;
- registry-resolution helpers;
- safe nested-path read/write utilities;
- reusable renderer/editor/formatter plumbing;
- Grid State reconciliation helpers;
- generic typed adapter contracts;
- domain-neutral config-error/Error Boundary presentation.

Examples that normally remain feature-owned:

- Loan/Finance business definitions;
- feature workflow/actions;
- entity-specific datasource/request mapping;
- business-specific validation/action semantics;
- entity-specific renderers/editors that are not genuinely reusable.

Do not force code into `shared` just because it might theoretically be reused later. Equally, do not duplicate a stable domain-neutral mechanism once real reuse exists.

---

## 3. First implementation scope

The first real implementation should prove the architecture using **one new isolated configurable SSRM feature**.

Do **not** modify the existing proven Client, Infinite or SSRM Transaction grids to make this work.

Those existing three grids stay untouched during this experiment.

After configurable SSRM is genuinely proven, Client and Infinite can be considered separately.

Do not create one universal row-model implementation. Client, Infinite and SSRM should keep row-model-specific lifecycle/ownership where it matters.

---

## 4. Branch and PR #40

The real work should start from the latest `main` on the new configurable-feature branch.

PR #40 was created before requirements were fully discussed. It can be inspected as a **reference/experiment only**.

Do not:

- merge PR #40 into `main` for this work;
- treat PR #40's schema/architecture as approved merely because code exists;
- copy its decisions without reconciling them against this handoff and the current repository.

A future chat may inspect PR #40 to understand what was tried and may reuse an idea only if it still fits the approved design.

---

## 5. Frontend vs backend responsibility

Frontend access/configuration shapes the UX:

- feature/route visibility;
- column visibility;
- editable/read-only presentation;
- action visibility/disabled state;
- filter/search/etc. availability;
- renderer/editor/formatter choice;
- presentation defaults;
- Grid State reconciliation.

Backend remains authoritative for:

- authorization;
- protected data;
- updates and bulk updates;
- protected actions;
- authoritative validation;
- masking/unmasking sensitive values.

If a user's real permission changes while stale UI is open and they still submit an operation, the backend must reject it when no longer authorized.

Do not duplicate backend authorization logic in the frontend.

---

## 6. Access/configuration lifetime

Configuration and access are not expected to change frequently while the page is open.

Normal flow:

```text
application starts
    ↓
fetch current user/access
    ↓
routing determines feature access
    ↓
user enters feature
    ↓
resolve feature + entity definition
    ↓
apply current-user access projection
    ↓
reconcile valid user preferences
    ↓
build effective feature/grid inputs
    ↓
keep them stable for the page session
```

Do not build a hot-swapping system that dynamically removes columns/actions while the user has dirty edits.

If current-user information is refetched later:

- route-level changes can be handled by routing;
- inside-feature changes can take effect on reload/re-entry;
- live dirty-edit reconciliation is not required unless a future product requirement explicitly asks for it.

---

## 7. Temporary local demo controls

For the local experiment, keep at least these development choices in `localStorage`:

```text
current mock profile/role
current entity/data type
```

Examples:

```text
profileA / profileB
Loan / Finance
```

Switching them and refreshing/re-entering the feature should visibly prove different effective configurations.

The low-level grid must not contain scattered checks such as:

```ts
if (role === 'profileA') { ... }
if (entity === 'loan') { ... }
```

Role/profile and entity are resolved at the feature/config boundary.

---

## 8. Configuration layers

Keep these separate.

### 8.1 Feature + entity base definition

Says what a view can support.

Example:

```text
Review + Loan
```

may support certain columns, editing, renderers, page actions and initial state.

### 8.2 Current-user access projection

Says what this user actually receives/can use.

Example:

```text
base: Status supports editing
user: Status is read-only
effective: Status visible + read-only
```

or:

```text
base: Sensitive Reference supported
user: no access
effective: field absent
```

### 8.3 User presentation preferences

Saved Grid State/preferences may override **presentation defaults**, but never authorization/capability.

### 8.4 Runtime row/value state

Keep concepts such as these separate:

```text
maskable
canRequestUnmask
masked
```

A base definition can say a field supports masking, the access projection can say whether unmask is allowed, and a row can contain the current masked representation.

---

## 9. Effective resolution flow

Conceptually:

```text
Feature + Entity Base Config
             +
Resolved Current-User Access
             +
Valid Saved User Preferences
             ↓
      validate / reconcile
             ↓
frontend registries / mappers / adapters
             ↓
 strongly typed effective inputs
             ↓
 configurable SSRM feature
             ↓
 existing/proven SSRM mechanics
```

Low-level grid mechanics should not ask whether they are Loan, Finance or profileA. They receive resolved normal inputs.

---

## 10. Readability and comments are hard requirements

The configuration and non-obvious architecture code must be extremely easy for another developer to understand.

Bad:

```ts
// renderer config
renderer: { ... }
```

Better:

```ts
// Displays the business status using the registered status-pill renderer.
// The config stores only the registry key and JSON-safe params.
// The compiler resolves the key to the actual React component.
// Unknown keys are configuration errors and must fail validation.
renderer: {
  key: 'statusPill',
  params: { ... }
}
```

Comments/JSDoc should explain, where useful:

- what a property means;
- why it exists;
- who consumes it;
- what happens when it is omitted;
- what default/fallback is used;
- when an entity may override that default;
- frontend vs config/backend ownership;
- important lifecycle/precedence rules.

Defaults must never be "magic". If `sortKey`, a message key, renderer params, state defaults or another optional setting can fall back to something else, that must be obvious from types/comments/docs.

A maintained architecture/workflow document should accompany the implementation.

---

# 11. Configuration surface to review before freezing the schema

This does **not** mean exposing every AG Grid option as JSON. For each candidate, decide whether it belongs to business configuration, resolved authorization, user preference, frontend mechanics/registries or runtime row state.

---

## 11.1 Stable column ID vs value field/path

Do not make one property perform every responsibility.

Conceptually:

```text
column id
    → stable config/Grid-State identity

field / value path
    → where the row value comes from
```

Example:

```ts
{
  id: 'borrowerName',
  field: 'loan.borrower.name'
}
```

`id` and `field` are intentionally distinct.

---

## 11.2 Nested API values are a normal case

Real API data can be nested:

```json
{
  "loan": {
    "borrower": {
      "name": "Alice"
    }
  }
}
```

A config may therefore use:

```ts
field: 'loan.borrower.name'
```

Nested `a.b.c` paths are a real requirement, not an edge case.

For values that cannot be represented by a simple path, use a bounded frontend accessor/getter registry rather than arbitrary JavaScript in metadata.

---

## 11.3 Nested editing/write path

Reading a nested value is only half the requirement.

If it is editable, consider how the edited value is written back to local edit state and mapped into the save request.

Example:

```text
API row:     loan.pricing.interestRate = 0.075
display:     7.50%
editor:      7.5
save value:  0.075
```

The architecture must leave room for:

- nested read path;
- nested local write/update;
- parsing;
- normalization;
- lookup conversion;
- save-request mapping.

Do not assume `field` alone solves every editable value.

---

## 11.4 Value/data type

Consider logical data type where useful, for example:

```text
string
number
date
boolean
enum
currency
percentage
```

Do not expose AG Grid internals as business metadata unless there is a real need.

---

## 11.5 Server sort/filter/search mapping

The value path used to read a row may differ from the key expected by the backend query contract.

Example:

```ts
{
  id: 'borrowerName',
  field: 'loan.borrower.displayName',

  // Optional only when backend sort naming differs from the value path.
  sortKey: 'borrower_name',

  // Optional only when backend filter naming differs.
  filterKey: 'borrower_name'
}
```

Possible schema candidates:

- `sortKey`;
- `filterKey`;
- `searchKey`;
- server aliases.

Exact property names are **not finalized**.

The intended rule is:

```text
simple case
    → use a clearly documented default

different backend contract
    → allow an explicit override

complex transformation
    → keep it in the typed entity datasource/adapter mapper
```

For a simple field, do not force repetition such as:

```text
field = amount
sortKey = amount
filterKey = amount
```

if a clear documented default can derive it.

Do not turn each column config into an API implementation.

---

## 11.6 Translation / UI text keys

Use translation keys rather than scattering final English strings through config.

The translation resource should be organized around the **feature/page**, because the page owns more than the grid.

Conceptually:

```json
{
  "review": {
    "title": "Review",
    "sections": {
      "summary": {
        "title": "Summary"
      }
    },
    "actions": {
      "approve": "Approve",
      "reject": "Reject"
    },
    "grid": {
      "columns": {
        "loanAmount": {
          "label": "Loan Amount",
          "help": "Current loan amount"
        }
      }
    },
    "messages": {
      "loadFailed": "Unable to load this view.",
      "saveFailed": "Unable to save your changes.",
      "saveSucceeded": "Changes saved."
    }
  }
}
```

Grid/feature config references keys:

```ts
{
  id: 'loanAmount',
  field: 'loan.amount',
  labelKey: 'grid.columns.loanAmount.label',
  helpKey: 'grid.columns.loanAmount.help'
}
```

Resolution produces the final normal UI/AG Grid string.

The same feature translation resource can cover:

- page title;
- section labels;
- button/action labels;
- grid headers;
- help text;
- validation messages;
- empty-state text;
- loading/retry/error text;
- save/action success/error feedback.

The exact i18n library/file layout should follow repository conventions when implementation begins.

---

## 11.7 Translation defaults and entity overrides

Common text should have sensible defaults, while an entity can override where product wording genuinely differs.

Example:

```text
Review default save failure
    → "Unable to save your changes."

Review + Loan override
    → "Unable to save the loan changes."
```

Do not duplicate every message in every entity config.

Use a small, obvious fallback model, conceptually:

```text
entity-specific message key, when configured
        ↓ otherwise
feature/page default message key
        ↓ otherwise
shared safe generic fallback
```

A developer must be able to see clearly:

- which message is optional;
- which default applies when omitted;
- where the key is resolved;
- whether the message appears automatically for that operation.

---

## 11.8 Optional query/mutation feedback

Not every query or mutation needs a toast/message.

For normal application operations such as Save, Approve or Reject, configuration may optionally describe feedback while the actual API/mutation stays in executable frontend code.

Conceptual example:

```ts
{
  actions: {
    save: {
      adapterActionKey: 'saveRows',
      feedback: {
        successMessageKey: 'messages.loanSaveSucceeded',
        errorMessageKey: 'messages.loanSaveFailed'
      }
    }
  }
}
```

An entity can omit those overrides and inherit feature defaults.

Ownership remains:

```text
API/service function
    → frontend adapter/registry

TanStack query/mutation lifecycle, where appropriate
    → frontend feature composition

message keys / optional feedback preference
    → declarative config

final localized string
    → translation resolver
```

Success may intentionally show no message.

Do not display arbitrary raw backend exception text by default. Backend error codes/details can be mapped to known safe frontend messages where required.

Do not create a giant generic notification framework merely because some operations can display messages.

---

## 11.9 Renderer

Config identifies a registered renderer key and JSON-safe params, never a React component/function.

Example:

```ts
{
  renderer: {
    key: 'statusPill',
    params: {
      compact: true
    }
  }
}
```

Frontend registry:

```text
statusPill
    → actual React/AG Grid renderer
```

The component can still receive normal AG Grid renderer params such as value, row data, node, API, context, etc.

Do not duplicate information in config that AG Grid already supplies naturally.

If truly necessary, a bounded params-resolver key may exist for dynamic params that cannot be represented by JSON + normal AG Grid params. Do not make every param a callback.

---

## 11.10 Formatter

Config stores a key + JSON-safe params.

Example:

```ts
{
  formatter: {
    key: 'currency',
    params: {
      currencyCode: 'USD'
    }
  }
}
```

Frontend owns the executable formatter.

---

## 11.11 Editor

Custom React editors are supported.

Config stores a key + JSON-safe params.

Example:

```ts
{
  editing: {
    supported: true,
    editor: {
      key: 'statusSelect',
      params: {
        optionsSourceKey: 'loanStatuses'
      }
    }
  }
}
```

Frontend resolves the editor key to the actual component.

---

## 11.12 Editor/display/save value conversion

Real values may have different representations.

Examples:

```text
percentage:
API      0.075
display  7.50%
editor   7.5
save     0.075
```

```text
lookup:
API      "APR"
display  Approved
editor   Approved
save     "APR"
```

```text
date:
API      "2026-08-30"
display  "30 Aug 2026"
editor   date-input representation
save     "2026-08-30"
```

Therefore the schema review must consider:

- formatter;
- parser;
- normalizer;
- lookup mapping;
- value accessor when a path is insufficient;
- save conversion.

Executable conversion logic remains frontend-owned behind known keys/registries.

---

## 11.13 Editing capability

Hidden, visible read-only and visible editable are distinct states.

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

Effective config should be resolved before the low-level grid uses it.

---

## 11.14 Existing tracked editing stays authoritative

Do not create a metadata-specific editing engine.

Existing/proven mechanics should continue to own:

- dirty state;
- Save/Discard;
- single/bulk persistence where supported;
- BASE / LOCAL / REMOTE reconciliation;
- validation interaction;
- conflict handling.

Configuration supplies composition inputs, not a new editing state machine.

Do not add flags such as `tracked: true` unless a real requirement appears for an editable field that deliberately should not participate in tracked editing.

---

## 11.15 Validation

Validation stays independently reusable.

Config can identify rules/params:

```ts
validation: {
  rules: [
    { key: 'required' },
    { key: 'min', params: { value: 0 } }
  ]
}
```

Frontend registry owns actual validator functions.

Backend remains authoritative for final validation.

---

## 11.16 Lookups/options

Editors/renderers may require option sets such as statuses, categories, reasons or product codes.

Static options can be JSON-safe config where appropriate.

Dynamic options should resolve through a known frontend provider/query key.

Normal application queries can use TanStack Query where appropriate.

---

## 11.17 Stable row identity

Stable row identity should be a required contract, not an accidental assumption that every entity uses `id`.

Conceptually:

```ts
rowIdField: 'loanId'
```

or, only when computation is genuinely needed:

```ts
rowIdAccessorKey: 'reviewLoanRowId'
```

Stable identity is required for editing, selection, SSRM refresh, reconciliation and Save/Discard behavior.

Prefer a simple field/path when possible.

---

## 11.18 Datasource/API adapter

Loan and Finance may not share the same backend API contract.

Conceptually:

```text
Review + Loan config
    ↓
reviewLoan adapter key
    ↓
Loan request mapper / API service functions

Review + Finance config
    ↓
reviewFinance adapter key
    ↓
Finance request mapper / API service functions
```

The SSRM grid must not contain:

```ts
if (entity === 'loan') { ... }
if (entity === 'finance') { ... }
```

The adapter registry contains plain async service/API functions, not React hooks and not `useMutation()` instances.

Example conceptually:

```ts
const dataAdapterRegistry = {
  reviewLoan: {
    loadRows: loadLoanRows,
    saveRow: saveLoanRow,
    saveRows: saveLoanRows
  },
  reviewFinance: {
    loadRows: loadFinanceRows,
    saveRow: saveFinanceRow,
    saveRows: saveFinanceRows
  }
}
```

Exact adapter shape is not finalized.

### TanStack Query boundary

For normal application queries/mutations, the feature composition can use TanStack Query around those plain functions where appropriate.

Do **not** store TanStack hooks inside registries.

AG Grid SSRM block loading remains datasource-owned; do not wrap every SSRM block request in TanStack Query merely because TanStack exists in the app.

---

## 11.19 Page-level capabilities/actions

The page can contain more than the grid.

Bounded feature configuration may eventually vary small things such as sections/actions between Loan and Finance or between user access projections.

Do not build a generic page-builder.

For actions such as Approve/Reject:

```text
config
    → says whether the feature supports/exposes the action

frontend
    → owns handler, mutation, pending/success/error lifecycle

backend
    → authorizes execution
```

Do not build a giant generic action framework now.

---

## 11.20 Dependencies between fields/actions

Do not build a generic runtime dependency engine initially.

If Status is absent for a profile and an action that requires Status should also be absent, the resolved access/config should simply omit both.

If real configuration dependencies later become hard to maintain, explicit development-time metadata such as `requires: [...]` can be considered and validated.

Only introduce that when a real dependency justifies it.

---

## 11.21 Masking / sensitive data

Never send the clear sensitive value to the frontend and merely hide it in React.

Backend must return an authorized representation.

Keep separate:

```text
maskable
canRequestUnmask
masked
```

Unmasked values should not be persisted into localStorage, saved Grid State or long-lived user preferences.

---

## 11.22 Masking affects more than the cell renderer

Restricted/masked fields must not leak through secondary capabilities.

Consider removing/denying as required:

- filter;
- search;
- sort;
- copy/clipboard;
- export;
- tooltip;
- aggregation;
- other derived operations that could expose/infer the underlying value.

Start restrictive and only enable a capability when the real product/security rule says it is safe.

---

## 11.23 Initial Grid State and user preference precedence

Feature/entity config may define initial presentation defaults:

- order;
- widths;
- pinning;
- visibility;
- default sort;
- other genuine defaults.

If the user has no saved state, use those defaults.

If the user has saved presentation preferences, those preferences override the defaults where still valid.

But authorization/current configuration always wins.

A saved preference must never restore a removed or unauthorized column/capability.

---

## 11.24 Reconcile old saved state against new definitions

Saved Grid State may have been produced by an older definition.

Reconcile it so:

- surviving user preferences remain;
- removed columns stay removed;
- new columns receive sensible config defaults;
- unauthorized columns never return.

Do not treat an old saved state object as a complete replacement for the current definition.

---

## 11.25 Versioning

Include version concepts from the beginning, at least conceptually:

```text
schemaVersion
definitionVersion
```

This helps with compatibility, user-state reconciliation, caching and future remote config.

It does not imply live runtime hot updates.

---

## 11.26 Configuration validation

Validate configuration before rendering.

Examples:

- duplicate IDs;
- missing required row identity;
- unknown renderer/editor/formatter keys;
- invalid required properties;
- unsupported schema version;
- impossible shapes.

Because config is local/frontend-owned initially, tests should catch most mistakes during development/CI.

The same validator can later protect against incompatible backend-provided config.

---

## 11.27 Error ownership

Keep different errors separate.

```text
configuration error
    → controlled feature/view configuration failure

SSRM row-loading error
    → normal grid loading/retry handling

mutation/action error
    → normal operation error handling

unexpected React/runtime crash
    → Error Boundary
```

Do not route every failure through one generic error state.

A small controlled page-level invalid-config state is useful and not overengineering.

---

## 11.28 Native AG Grid first

Use AG Grid's native capabilities whenever they solve the problem.

Config/metadata should compile into normal AG Grid inputs.

Do not recreate native behavior in a vague custom grid engine without a concrete reason.

---

## 11.29 No giant universal wrapper

Do not create a universal `DynamicGrid`, giant `useGrid()` abstraction or one component controlled by `rowModel='client|infinite|ssrm'`.

The metadata/compiler layer should produce small strongly typed inputs for existing/proven mechanics.

Central principle:

> **Make configuration dynamic. Do not make the grid engine vague.**

---

# 12. Representative Python/backend data for the experiment

The Python backend should provide representative datasets/APIs for at least:

```text
Loan
Finance
```

The shapes should differ enough to prove real configuration behavior.

For example Loan might contain:

- loan ID;
- borrower nested object;
- amount;
- nested pricing/interest rate;
- status;
- sensitive reference;
- dates;
- editable fields.

Finance should have a meaningfully different shape and different editing/renderer/formatter needs.

Do not merely rename Transaction fields.

If masking is demonstrated, backend should return masked data directly for restricted profiles.

Only add backend endpoints/mutations required to prove agreed capabilities; do not overbuild backend infrastructure.

---

# 13. Proof matrix

A single entity + single profile is not enough to prove the architecture.

At minimum use something like:

```text
                 Profile A       Profile B

Review + Loan    effective A1    effective A2

Review + Finance effective B1    effective B2
```

Use the combinations to prove real differences in:

- columns;
- editing/read-only behavior;
- masking/restrictions;
- renderer/editor/formatter choices;
- initial state;
- saved-user-preference precedence;
- entity-specific datasource/API mapping.

The goal is architectural proof, not a giant demo.

---

# 14. Conceptual example only

> Exact property names below are illustrative and are **not** a finalized contract.

```ts
const reviewLoanDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,

  id: 'review.loan',

  rowIdentity: {
    field: 'loanId'
  },

  data: {
    adapterKey: 'reviewLoan'
  },

  translationNamespace: 'review',

  initialGridState: {
    sort: [
      {
        columnId: 'createdAt',
        direction: 'desc'
      }
    ]
  },

  columns: [
    {
      id: 'borrowerName',
      field: 'borrower.name',
      labelKey: 'grid.columns.borrowerName.label'
    },

    {
      id: 'interestRate',
      field: 'pricing.interestRate',
      labelKey: 'grid.columns.interestRate.label',

      formatter: {
        key: 'percentage',
        params: {
          decimalPlaces: 2
        }
      },

      editing: {
        supported: true,
        editor: {
          key: 'percentageInput'
        },
        valueParserKey: 'percentageInputToDecimal'
      },

      validation: {
        rules: [
          {
            key: 'range',
            params: {
              min: 0,
              max: 100
            }
          }
        ]
      }
    },

    {
      id: 'status',
      field: 'status.code',
      labelKey: 'grid.columns.status.label',
      sortKey: 'status_code',

      renderer: {
        key: 'statusPill',
        params: {
          compact: true
        }
      },

      editing: {
        supported: true,
        editor: {
          key: 'statusSelect',
          params: {
            optionsSourceKey: 'loanStatuses'
          }
        }
      }
    }
  ]
}
```

The current-user access projection reduces the base definition before the grid consumes it.

---

# 15. Implementation principles once explicitly approved

When implementation is eventually authorized:

1. inspect the repository and GitHub state first;
2. read `AGENTS.md` and all applicable project/grid rules;
3. read the current SSRM implementation fully;
4. read editing, validation, selection, Grid State, datasource/query-lifecycle code;
5. inspect PR #40 only as reference;
6. start from latest `main` on the new configurable-feature branch;
7. keep the existing three grids untouched;
8. use current SSRM behavior/UI as the baseline for the isolated feature;
9. reuse proven mechanics rather than rewriting them;
10. extract domain-neutral shared pieces only where concrete reuse is real;
11. keep business-specific composition under the feature;
12. add unusually clear comments/JSDoc and architecture/flow documentation;
13. keep code strongly typed;
14. prefer native AG Grid;
15. keep role/entity resolution outside low-level grid mechanics;
16. keep executable behavior in frontend registries/adapters;
17. keep config declarative/JSON-safe where practical;
18. validate config;
19. test resolver/compiler/config and real-grid behavior;
20. do not automatically migrate existing grids after success;
21. do not merge without explicit approval.

---

# 16. Explicit non-goals for now

Do not build these unless a real future requirement appears:

- live hot-swapping of config/permissions while editing;
- dynamic dirty-edit reconciliation after role changes;
- generic runtime dependency engine;
- giant configurable action framework;
- generic page builder;
- universal Client/Infinite/SSRM grid engine;
- arbitrary JavaScript in metadata;
- every AG Grid option exposed as configuration;
- complex remote-config fallback/retry system;
- frontend duplication of backend authorization.

---

# 17. How the next chat should use this file

This is the **single consolidated context handoff**.

The next chat should read it completely first, then inspect the repository/current GitHub state when needed for the user's next request, including PR #40 as reference only.

This file intentionally does **not** force the first next-chat task. The user may choose to:

- continue design discussion;
- ask for the proposed full schema;
- ask to compare this design with the current repo/PR #40;
- ask for an implementation plan;
- or explicitly approve implementation.

Do not begin code changes merely because this document exists.

Do not assume PR #40 is the desired implementation simply because it exists.

Do not mistake illustrative property names in this handoff for finalized contracts.
