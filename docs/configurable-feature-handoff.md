# Handoff: Configurable / Metadata-Driven Feature + Grid Architecture

> **Status:** consolidated architecture/design context only. This document does **not** authorize implementation.
>
> This document is deliberately based on the original 48-point handoff and updates it with the later discussion. A new chat should be able to read this **single file** and understand the full context without needing the earlier chat.
>
> Where later discussion changed an earlier idea, the later decision wins. Illustrative property names are examples, not finalized API contracts.
>
> Before implementation, a new chat must inspect the current repository/GitHub state and follow the user's next explicit instruction. The user may first want further schema/design discussion.

---

# 1. Terminology and scope

Do **not** use the word “adjustment” for this work. That terminology overlaps with a real project and should stay out of this personal/reference project.

Use neutral terminology such as:

- configurable feature;
- configurable grid;
- metadata-driven grid;
- dynamic table;
- configurable feature grid;
- configurable SSRM grid;
- a neutral feature name such as `Review` or `Correction`.

The repository already has three proven Transaction-based grid implementations:

- Client-Side Row Model;
- Infinite Row Model;
- SSRM.

The configurable work is a **new architectural exploration** and must not initially destabilize those three implementations.

A major clarification from later discussion is that the real product unit is **the business feature/page**, not Loan, Finance, Transaction, or a standalone “configurable grid”.

Conceptually:

```text
Review feature/page
    ├── page-level UI / sections / actions
    └── SSRM grid
            ↑
       entity context
       Loan / Finance / ...
```

Loan, Finance, etc. are different entity/data contexts **inside** that feature.

Another feature may also use Loan but require a different Loan view/configuration:

```text
Review + Loan
AnotherFeature + Loan
```

Those two Loan configurations may differ because the business purpose is different.

For the first configurable implementation, prove the architecture with **SSRM only**. Existing Client/Infinite/SSRM Transaction grids remain untouched during this experiment.

---

# 2. What problem we are actually trying to solve

The goal is not simply to make `columnDefs` come from JSON.

The goal is to support a real feature/page whose entity/data context may vary and whose effective UI may vary based on resolved user access.

For example:

```text
Review + Loan
Review + Finance
```

may share the same overall feature purpose while having different:

- row/data shapes;
- columns;
- nested field paths;
- renderers/editors/formatters;
- validation;
- datasource/request mapping;
- save/mutation mapping;
- page-level capabilities;
- initial Grid State defaults.

Within one base feature/entity definition, the current user's resolved access can further change:

- which fields are available;
- read-only vs editable state;
- masking/unmask capability;
- filter/sort/search/export/copy capability;
- actions or sections the user is allowed to see/use.

The configuration identity is therefore closer to:

```text
feature/view + entity/context
```

not merely `loanConfig` or `financeConfig`.

The grid must not contain scattered checks such as:

```ts
if (entity === 'loan') { ... }
if (role === 'roleA') { ... }
```

Those choices should be resolved at the feature/configuration boundary.

---

# 3. Three concepts must remain separate

There are at least three separate concerns.

## A. Feature/entity base definition

This represents what a particular feature + entity view is capable of containing.

Example:

```json
{
  "id": "customerName",
  "field": "borrower.customer.name",
  "dataType": "text",
  "sensitive": {
    "maskable": true
  }
}
```

This says the field exists in the base definition and can support masking. It does **not** mean every user can see it or unmask it.

## B. Resolved authorization/access projection

This represents what the current user/session is actually allowed to see or do.

Example:

```json
{
  "customerName": {
    "visible": true,
    "access": "read",
    "canRequestUnmask": false
  },
  "balance": {
    "visible": true,
    "access": "edit",
    "canRequestUnmask": true
  }
}
```

The frontend should consume the **resolved result**, not understand backend role/group/entitlement algorithms.

During development, local mock role/profile mappings may simulate this future result, but they must be isolated behind a provider/resolver boundary.

## C. Runtime row/value state

A field being maskable and a user being allowed to request unmasking does not mean the currently returned value is unmasked.

Keep these distinct:

```text
maskable
    = field type supports masking

canRequestUnmask
    = current user/session may request unmasking

masked
    = current delivered value is masked
```

Do not collapse them into one boolean.

---

# 4. Sensitive data must be protected by the backend

Frontend-only masking is not security.

If the user is not currently authorized to receive the true value, the backend should return a masked representation. Do not send the raw value and merely hide it in React.

If unmasking exists, the likely flow is:

```text
masked value returned
        ↓
user requests unmask
        ↓
frontend calls authoritative endpoint
        ↓
backend rechecks authorization/policy
        ↓
optional reason/approval/AI/workflow/audit
        ↓
backend returns permitted value
```

The grid architecture consumes the result; it does not care how the backend reached the authorization decision.

Sensitive-field filtering, sorting and other secondary capabilities also require explicit policy consideration.

---

# 5. Shared fields and entities across different business features/views are normal

Two different feature/view definitions may contain some of the same logical fields.

The same field may have different access/presentation in different views or for different users.

Likewise, the same entity can appear in multiple features:

```text
Review + Loan
AnotherFeature + Loan
```

and those Loan configurations can differ because the business purpose differs.

Therefore:

```text
entity != complete configuration identity
```

---

# 6. Backend should eventually own business policy and authorization

The long-term scalable direction remains:

```text
Backend decides WHAT is permitted/configured
                     ↓
JSON-safe declarative metadata + authorized data
                     ↓
Frontend decides HOW supported metadata becomes UI behavior
```

Backend should eventually be authoritative for things such as:

- accessible features/routes/views;
- fields that may be returned;
- field visibility;
- read/edit authorization;
- masking state/capability;
- unmask eligibility;
- row-level restrictions;
- business action availability;
- server-supported sort/filter behavior;
- business-managed validation configuration;
- lookups/options when business-managed;
- authoritative data;
- business operation authorization.

A later clarification is important: **the frontend should not try to duplicate backend authorization enforcement**.

If stale frontend UI attempts Save, bulk update, Approve/Reject, etc. after server-side permission changed, backend is responsible for rejecting the unauthorized operation.

Frontend is primarily responsible for correct UX based on the access snapshot it received.

---

# 7. Backend must NOT remotely program React or AG Grid

Backend configuration must remain JSON-safe.

It must not contain:

- React components;
- JavaScript functions;
- AG Grid callbacks;
- executable expressions;
- arbitrary script;
- serialized executable `ColDef` functions.

The backend should **not** directly return an executable AG Grid `ColDef[]`.

The architecture should be:

```text
JSON-safe metadata
        ↓
frontend compiler/resolver
        ↓
real strongly typed AG Grid ColDef[] / feature inputs
        ↓
AgGridReact / feature components
```

---

# 8. Metadata says WHAT; frontend code knows HOW

Key principle:

```text
metadata/configuration describes WHAT behavior is requested
frontend capability code knows HOW that behavior is implemented
```

Example:

```json
{
  "renderer": {
    "key": "statusBadge"
  }
}
```

Frontend owns:

```ts
rendererRegistry = {
  statusBadge: StatusBadgeRenderer
}
```

The same bounded registry/resolver pattern can apply where genuinely needed to:

- renderers;
- editors;
- formatters;
- parsers/normalizers;
- non-trivial value accessors;
- validators;
- bounded behaviors/event handlers;
- page/component keys;
- datasource/service adapters;
- save/mutation functions;
- lookup/options providers;
- specialized parameter resolvers;
- translation/message resolution.

Unknown required keys must fail in a controlled, diagnosable way.

Registries contain plain frontend functions/components/providers. React hooks and TanStack Query hooks must **not** live inside registries.

React/feature composition may use the plain service functions with TanStack Query for normal application queries/mutations where appropriate.

AG Grid SSRM row/block loading remains owned by the SSRM datasource lifecycle.

---

# 9. Field identity, value paths and server-query identity must be explicit

Do not infer a data field from the header name or arbitrary response keys.

Distinguish conceptually:

```text
id
field/value path
server query key(s), when different
```

`id` is the stable UI/configuration identity used for Grid State, persistence, references, etc.

`field` is the exact property/path used to read the row value.

Nested API paths are normal:

```text
borrower.customer.name
loan.pricing.interestRate
a.b.c
```

Server sorting/filtering/search may use different keys.

Illustrative example:

```ts
{
  id: 'borrowerName',
  field: 'loan.borrower.displayName',
  sortKey: 'borrower_name',
  filterKey: 'borrower_name'
}
```

Exact names are not finalized.

Desired rule:

```text
simple case
    → clear documented default

different backend contract
    → optional explicit server key

complex request transformation
    → typed datasource/adapter mapper
```

Do not make developers repeat identical values when a safe default exists, but every default/fallback must be documented clearly.

---

# 10. Semantic field identity may also be needed

A field may require a stable business-semantic identity beyond presentation.

Conceptually:

```json
{
  "id": "status",
  "field": "status",
  "semanticKey": "status"
}
```

Very important:

```text
renderer key != business semantic key
```

Do not infer business meaning from renderer names.

---

# 11. Renderers, editors, formatters and value conversion

The complete design must consider these from the beginning.

A field may conceptually provide:

```json
{
  "renderer": {
    "key": "statusBadge",
    "params": {}
  },
  "editor": {
    "key": "statusSelect",
    "params": {}
  },
  "formatter": {
    "key": "currency",
    "params": {}
  }
}
```

Params remain JSON-safe.

Real cases require thinking about:

```text
API/raw value
displayed value
editor value
local edited value
save payload value
```

Those may differ.

Example:

```text
API:      0.075
display:  7.50%
editor:   7.5
save:     0.075
```

or a lookup:

```text
API:      "APR"
display:  "Approved"
editor:   "Approved"
save:     "APR"
```

Therefore the schema review must consider formatting, parsing, normalization, lookup mapping, nested reads/writes and save-request mapping.

Executable transformations stay in frontend registries/adapters.

---

# 12. Dynamic renderer/editor params

Many renderer/editor parameters can simply be JSON values.

AG Grid already supplies runtime params such as value, data, node, api, context, etc.

Preferred approach:

```text
config supplies JSON-safe extra params
+
component reads normal AG Grid params/data
```

Do not immediately make every parameter a JavaScript callback.

Only when genuinely needed should a bounded `paramsResolverKey`-like concept map to an allowlisted frontend function.

---

# 13. Event handlers / behaviors are a separate problem

Business behavior may respond to things such as value changed, cell clicked, selection changed or domain events.

Metadata must not send executable handlers.

A possible direction is a bounded behavior key resolved frontend-side, but the **exact behavior/event schema is not finalized** and should be driven by real use cases.

Settled principle:

```text
renderer/editor key != business behavior key
```

Presentation and semantics must not be secretly coupled.

---

# 14. Dependencies must be deliberate, but do not build a generic runtime dependency engine upfront

A user may not receive a field at all.

The preferred first approach is that the **resolved effective configuration is already internally consistent**.

Example:

```text
Profile B

Status column
    → absent

Approve action that requires Status
    → absent
```

Then no runtime dependency engine is required.

If real dependencies later become difficult to maintain, a bounded declaration such as:

```json
{
  "requires": ["currencyCode"]
}
```

may be introduced for config validation.

That would catch invalid configuration, not create a giant runtime framework.

---

# 15. Hidden, read-only and editable are not the same

Do not collapse everything into visible/not visible.

For a field:

```text
not authorized
    → absent/unavailable

authorized read-only
    → visible but not editable

authorized editable
    → visible and editable
```

For rows, existing generic interaction concepts such as enabled / selectionDisabled / readOnly remain important.

---

# 16. Row-level and field-level authorization may coexist

A future backend may resolve:

```text
field editable generally
but this row is read-only
```

or:

```text
action available only for some rows
```

The exact wire shape is not finalized.

The architecture should leave room for resolved runtime row capabilities without rebuilding the entire table definition per row.

This is different from live role/config hot-swapping. Configuration/access snapshot is expected to stay stable for the page session.

---

# 17. Actions are part of the feature architecture, but keep them bounded

A configurable feature page may eventually need actions such as Approve, Reject, Change Status, Reassign, Export, Unmask, etc.

The same rule applies:

```text
config may identify supported action declaratively
frontend owns executable UI/handler
backend authorizes execution
```

Actions belong to the feature/page, not a generic grid engine.

Do not prematurely build one giant generic action system.

Normal application mutation lifecycle may use TanStack Query where appropriate.

Optional success/error feedback can use translation/message keys, and an operation may intentionally show no success message.

---

# 18. Validation is independent from configurable metadata

Validation is required even if configurable tables are never implemented.

Therefore:

```text
validation capability MUST NOT depend on metadata runtime architecture
```

Static fields can use validation directly.

Later metadata simply becomes another way to produce inputs to the same validation engine.

---

# 19. Validation rule direction

Use stable known rule keys with JSON-safe params rather than arbitrary executable rules.

Conceptually:

```json
{
  "validation": {
    "rules": [
      { "key": "required" },
      {
        "key": "numberRange",
        "params": {
          "min": 0,
          "max": 100000
        }
      }
    ]
  }
}
```

The exact final representation remains open.

Settled principles:

- frontend owns executable validator functions;
- config/backend sends known keys + JSON-safe params/messages;
- backend remains authoritative;
- client validation improves UX but is not the security/business authority.

---

# 20. Validation UX requirements

Invalid LOCAL edits should generally:

```text
remain visible
remain dirty
show field error
block relevant Save
allow correction or Discard
```

The invalid value should not silently snap back merely because it fails validation.

Backend structured field errors should map into the same validation state where practical.

---

# 21. Validation and edit conflicts are separate

Validation asks:

```text
Is LOCAL acceptable?
```

Conflict asks:

```text
Did REMOTE diverge from BASE while LOCAL exists?
```

A field can be invalid only, conflicted only, both, or neither.

Do not merge validation and conflict state into one model.

---

# 22. Existing conflict algorithm remains frontend code

Current reconciliation semantics remain frontend executable behavior:

```text
REMOTE == BASE
→ keep LOCAL dirty

REMOTE == LOCAL
→ automatically clean

REMOTE differs from BASE and LOCAL
→ conflict
→ keep LOCAL visible
→ remember REMOTE
```

Resolution remains:

```text
Use server
→ REMOTE wins
→ local draft clears

Keep my edit
→ LOCAL remains dirty
→ REMOTE becomes new BASE
→ conflict clears
```

Metadata must not encode this algorithm in JSON.

---

# 23. Full configuration surface must be thought through before implementation

Do not build a tiny schema and repeatedly defer everything else.

Before building the configurable runtime, intentionally review the **complete realistic feature/grid surface**.

Where genuinely applicable, consider:

### Identity / binding

- feature/view ID;
- entity/context ID;
- stable column ID;
- nested response-data field/value path;
- semantic key;
- required row identity field/path or bounded accessor;
- data type;
- computed/display-only values.

### Presentation / translation

- label/header translation key;
- description/help translation key;
- tooltip;
- width/min/max width;
- default visibility/order/pinning;
- initial Grid State defaults;
- formatter + params;
- renderer + params.

### Editing / values

- read-only/editable semantics;
- editor + params;
- parsing/normalization;
- lookup code/display mapping;
- nested write handling;
- save-payload mapping.

### Validation

- rules;
- params;
- message/help keys;
- backend field-error mapping where practical.

### Data/query support

- datasource/adapter key;
- sort/filter/search capability;
- optional server sort/filter/search keys;
- complex request mapping in adapter;
- response mapping;
- mutation/save mapping.

### Security/access

- field visibility;
- read/edit authorization;
- sensitivity/masking capability;
- runtime masked state;
- unmask capability;
- row runtime capabilities;
- filter/search/sort/copy/export implications for restricted values.

### Feature/page behavior

- bounded page sections/capabilities where genuinely variable;
- page/grid actions;
- optional success/error message keys;
- behavior/event bindings only when real use cases require them;
- dependencies only when real dependencies justify them.

### State/lifecycle compatibility

- Grid State identity;
- base/entity initial defaults;
- user preference precedence;
- authorization reconciliation;
- schema version;
- definition version;
- config validation/error handling.

For each candidate decide deliberately whether it is:

```text
business/product configuration
resolved access/runtime capability
user preference
frontend registry/adapter/mechanic
```

This does **not** mean every AG Grid option becomes JSON-configurable.

---

# 24. What must stay frontend-owned

Frontend continues owning executable mechanics such as:

- React components/lifecycle;
- AG Grid lifecycle and GridApi interactions;
- renderer/editor implementations;
- formatter/parser/normalizer functions;
- non-trivial value accessors;
- validators;
- event-handler functions;
- selection algorithms;
- Infinite/SSRM datasource lifecycle;
- request freshness/cancellation/retry/teardown;
- tracked editing state;
- BASE/LOCAL/REMOTE reconciliation;
- conflict resolution;
- Grid State mechanics;
- theme;
- generic error presentation mechanics;
- translation resolution;
- datasource/request adapters;
- save/mutation service functions;
- TanStack Query hooks/orchestration for normal app queries/mutations where appropriate;
- row-model-specific refresh mechanics.

---

# 25. Do not create a giant dynamic grid abstraction

Avoid a giant `useDynamicGridEverything(metadata)` or universal wrapper that drives loading, selection, editing, validation, actions, rendering, routing, authorization and lifecycle.

Safer model:

```text
metadata
   ↓
compiler / resolvers / registries
   ↓
small strongly typed inputs
   ↓
existing focused mechanics
```

The compiler/resolver layer is an isolation boundary between declarative configuration and proven frontend runtime code.

---

# 26. Important conclusion about existing reusable logic

Many lower-level mechanics are already reasonably generic, including concepts such as tracked editing, row IDs, BASE/LOCAL/REMOTE reconciliation, request freshness, selection semantics, datasource lifecycle helpers, Grid State and validation mechanics.

Transaction-specific code is more concentrated in feature composition: columns, editable field list, request mapping, actions, renderer/editor wiring, persistence wiring and APIs.

Therefore configurable architecture should primarily replace/configure **feature-composition inputs**, not rewrite underlying algorithms.

A later clarification is important: reuse is **not limited to the feature folder**.

If a mechanism is genuinely domain-neutral and reusable across features/row models, it may belong in the shared layer.

Rule:

```text
business/entity-specific composition
    → feature level

genuinely reusable domain-neutral mechanic
    → shared level

uncertain/experimental abstraction
    → keep local until proven
```

---

# 27. Do NOT refactor the existing three grids yet

Even if existing shared functions look generic, do not immediately restructure `/client`, `/infinite` and `/ssrm` around the new metadata architecture.

The configurable architecture is still unproven.

Keep the experiment isolated.

---

# 28. Build a new isolated configurable SSRM feature

The safer direction is:

```text
existing Client Transaction grid
    → untouched

existing Infinite Transaction grid
    → untouched

existing SSRM Transaction grid
    → untouched

NEW configurable business feature/page
    → isolated SSRM experiment
```

Use a neutral feature name such as `Review`.

Inside that feature, support at least two entity contexts such as Loan and Finance.

Do not try to prove Client + Infinite + SSRM simultaneously.

---

# 29. Start the new feature from proven SSRM behavior

The new configurable feature may start from a copy/parallel composition of the current SSRM feature so existing UI/behavior remains a concrete reference.

Isolation and behavioral parity are more important than immediate deduplication.

Reuse a proven shared/domain-neutral mechanism when clearly safe, but do not modify mature SSRM behavior merely to shorten the experiment.

---

# 30. Treat shared mechanics carefully during the experiment

Do not casually modify proven shared hooks/mechanics merely to make the experimental implementation shorter.

Especially protect SSRM lifecycle, selection, tracked editing, conflicts, request freshness, Save/Discard behavior and teardown.

At the same time, do not prohibit shared reuse where the contract is already clearly domain-neutral and appropriate.

---

# 31. What the configurable SSRM feature is meant to prove

The new feature should answer questions such as:

- Can one JSON-safe feature/entity definition safely create real ColDefs/feature inputs?
- Can the same feature switch Loan/Finance-like entity definitions without entity conditionals inside low-level grid mechanics?
- Are renderer/editor/formatter registries sufficient?
- Are params structured correctly?
- Are nested `a.b.c` paths supported cleanly?
- How are display/editor/save value conversions handled?
- How should server sort/filter/search mapping work?
- How should bounded behaviors/handlers be represented if a real use case needs them?
- How does resolved authorization alter columns/capabilities?
- Can masking remain backend-authoritative?
- Are restricted secondary capabilities safe?
- Can validation integrate without depending on metadata?
- Can existing edit/conflict mechanics consume compiled inputs?
- Can feature/page actions remain bounded?
- Can initial Grid State defaults combine with user preferences safely?
- Can old user preferences reconcile with current authorization/version?
- Can translations resolve page labels, grid headers, help and errors?
- Can entity-specific message overrides fall back to feature defaults?
- Where should datasource/request/save mapping live?
- Can config errors be caught in tests and handled safely at runtime?
- Which pieces are genuinely shared, feature-specific or row-model-specific?

---

# 32. Do not replace the current grids automatically after the experiment

Success does not mean immediately rewriting Client, Infinite or SSRM Transaction grids.

After the experiment, evaluate whether the new boundary is actually cleaner, native-first, understandable and regression-safe.

Only then consider selective migration.

---

# 33. There is still no universal row-model implementation

Client, Infinite and SSRM remain different row models.

The application/frontend chooses the row model for its product surface.

Backend metadata should not dynamically decide Client vs Infinite vs SSRM per user/entity.

For the current experiment, frontend chooses SSRM.

If configurable Client or Infinite versions are needed later, build row-model-specific compositions on the proven metadata concepts.

---

# 34. Possible future shape after the experiment

Conceptually:

```text
Feature/entity metadata
        ↓
compiler / resolvers
        ↓
strongly typed config
        ↓
Configured SSRM root
        ↓
existing/proven SSRM mechanics
```

Later, only if genuinely needed:

```text
metadata
   ↓
shared compiler concepts
  /       |       \
Client  Infinite  SSRM
 root     root     root
  ↓        ↓        ↓
native   native   native
```

This still does not imply one universal `DynamicGrid`.

---

# 35. Application/view manifest and route access idea

A future backend could return a resolved application/view manifest.

Conceptually:

```json
{
  "schemaVersion": 1,
  "views": [
    {
      "id": "some.business.view",
      "labelKey": "someView.title",
      "route": "/some-view",
      "componentKey": "configurableFeaturePage"
    }
  ]
}
```

Frontend owns the executable page/component registry.

Feature-level access is naturally handled by routing.

Current user/session information may initially be fetched once on application load.

If the app later refetches user/session access, routing can check whether the current feature is still allowed and redirect if necessary.

Do not add continuous polling/live removal of feature internals merely because a future manifest may exist.

---

# 36. Datasource and mutation/service configuration

Avoid arbitrary backend-provided URLs as the first abstraction.

Different entities may have different paging, sort/filter/search mapping, response shapes, transformations and save payloads.

Prefer a known frontend adapter key.

Conceptually:

```json
{
  "dataSourceKey": "reviewLoan"
}
```

mapped to plain typed frontend service functions:

```ts
const adapterRegistry = {
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

These are plain async functions, not React hooks and not `useMutation()` instances.

Normal application queries/mutations may use these functions through TanStack Query in the React/feature layer where appropriate.

AG Grid SSRM row/block loading stays datasource-owned.

Column-to-server query mapping must be deliberate.

Simple case:

```text
field = amount
sort/filter key defaults clearly to amount
```

Different backend contract:

```text
field = loan.borrower.displayName
sortKey = borrower_name
filterKey = borrower_name
```

Complex request transformation remains in the typed entity adapter rather than turning column config into an API implementation.

---

# 37. Configuration versioning is important

Conceptually include:

```json
{
  "schemaVersion": 1,
  "definitionVersion": 17
}
```

Frontend should detect unsupported schemas or required registry keys.

Do not silently render incorrect behavior when configuration is incompatible.

---

# 38. Configuration/access caching, lifetime and invalidation

Feature/entity definitions and authorization metadata are application/session/page configuration, separate from SSRM row data.

They should not be fetched for every SSRM data block.

Later discussion deliberately simplified runtime behavior:

- config and role/access changes are expected to be infrequent;
- current-user/access may initially be fetched once on app load;
- when a feature is entered, resolve feature/entity config + user access;
- keep the resulting effective configuration stable for that page session;
- do not hot-swap columns/actions while the user is editing.

If a future app refetches user/session access, feature-level changes can be handled by routing and inside-feature changes can take effect on reload/re-entry.

Do not build sophisticated live dirty-edit reconciliation unless a future product requirement explicitly asks for it.

Backend remains authoritative for stale-UI operations.

---

# 39. Grid State defaults, user preferences and current authorization

A feature/entity definition may define initial presentation defaults such as:

- column order;
- widths;
- pinning;
- visibility;
- default sort;
- other genuine product defaults.

If the user has no saved preferences, use those defaults.

If the user has saved preferences, user presentation preferences override applicable defaults.

But current authorization/configuration always wins.

A saved preference must never resurrect:

- an unauthorized field;
- a field removed from the current definition;
- a capability no longer allowed.

Reconciliation should be sensible/property-by-property rather than “saved state exists, ignore all new defaults”.

If a new definition version adds a column, surviving user preferences may remain while the new column receives its configured default.

---

# 40. Local configuration now versus future backend configuration

During development, configuration can be local JSON-safe frontend data behind provider interfaces.

The local experiment should keep at least these temporary choices in `localStorage`:

```text
current mock profile/role
current entity/data context
```

Examples:

```text
profileA / profileB
Loan / Finance
```

Changing them and refreshing/re-entering the feature should visibly demonstrate different effective configurations.

The grid itself must not contain scattered `if role === ...` / `if entity === ...` logic.

Later the provider may call backend APIs without redesigning the compiler/grid runtime.

---

# 41. Backend team should not be forced to implement everything immediately

Frontend can establish provider/contract boundaries first.

Backend can later supply resolved access, table definitions, validation metadata, lookup sources, etc.

Temporary local logic must stay behind those boundaries and not leak into grid internals.

---

# 42. Native AG Grid remains the first choice

For every behavior:

```text
AG Grid native capability first
        ↓
actual row-model capability
        ↓
Enterprise/Community capability
        ↓
custom application behavior only for a real semantic gap
```

Metadata is not an excuse to reimplement AG Grid behavior.

---

# 43. Configuration must not become “every AG Grid option in JSON”

Only product/business-variable aspects should become metadata candidates.

React lifecycle, datasource callbacks, GridApi, request sequencing, editing state machine, selection implementation, retry/destroy behavior, etc. stay frontend code.

---

# 44. Documentation and code readability are part of the architecture

This is a hard requirement.

Configuration and non-obvious architecture code must be unusually easy for another developer to understand.

Do not write vague comments such as:

```ts
// renderer config
```

Prefer comments/JSDoc that explain, where useful:

- what the property means;
- why it exists;
- who consumes it;
- what happens when omitted;
- what default/fallback is used;
- when an entity may override that default;
- what is frontend-owned vs config/backend-owned;
- important precedence/lifecycle rules.

Defaults must never be “magic”.

If `sortKey`, a translation/message key, state default, renderer param or another optional setting falls back to something else, that behavior should be obvious from type names/comments/docs.

Maintain architecture/workflow documentation with readable diagrams when they materially help.

Example flow:

```text
Feature + Entity Base Definition
             +
Resolved User Access
             +
Valid User Preferences
             ↓
validate / resolve / compile
             ↓
registries + adapters + translations
             ↓
strongly typed feature/grid inputs
             ↓
SSRM feature page
```

The goal is that a developer can configure a new entity without reverse-engineering resolver internals.

---

# 45. Updated implementation sequence

Current direction:

```text
1. Validation remains independent and usable by static grids.

2. Start the real configurable work from latest main on a NEW branch.

3. PR #40 was started before requirements were finalized.
   Inspect it only as reference; do not blindly continue its design.

4. Build one NEW isolated business feature/page using SSRM.

5. Keep existing Client/Infinite/SSRM Transaction grids untouched.

6. Use at least two entity contexts (e.g. Loan and Finance)
   and two local mock access profiles.

7. Python provides representative SSRM data/API contracts.

8. Before coding runtime/schema, review/propose the complete config surface.

9. Prove compiler/resolver/registry/adapter/translation boundaries
   without creating one giant dynamic grid abstraction.

10. Reuse proven domain-neutral shared mechanics where clearly safe.
    Keep uncertain/business-specific experimentation local until proven.

11. Add exceptionally clear comments and architecture/workflow docs.

12. Only after SSRM is genuinely proven, separately evaluate
    configurable Client and Infinite versions.

13. Success does not automatically authorize migration of existing grids.

14. Never merge without explicit user approval.
```

---

# 46. Important non-goals

Do not:

- rewrite all three row models at once;
- create a universal `AgGridReact` wrapper;
- create a giant `useDynamicGrid()` / `useGrid()` hook;
- make shared editing understand the whole metadata object;
- make shared selection understand table metadata;
- make backend send React components/functions;
- deserialize executable JavaScript;
- send arbitrary executable backend `ColDef`;
- infer business semantics from renderer names;
- assume every user receives every field;
- expose raw sensitive values and merely mask them visually;
- treat hidden and read-only as equivalent;
- blindly execute logic depending on a field removed by effective access;
- build a generic runtime dependency engine without a real need;
- build a giant configurable action framework;
- build a generic page builder;
- make backend choose Client/Infinite/SSRM dynamically;
- wrap every SSRM block load in TanStack Query;
- put React/TanStack hooks inside registries/adapters;
- continuously hot-swap role/config columns while a user is editing;
- duplicate backend authorization enforcement in frontend;
- make every AG Grid option configurable;
- hide defaults/fallbacks inside undocumented resolver behavior;
- refactor proven grids merely to reduce temporary duplication;
- migrate existing grids before the new architecture proves itself;
- treat PR #40 as finalized architecture merely because code exists there.

---

# 47. Core architecture in one diagram

```text
                 BUSINESS FEATURE / PAGE

        Feature + Entity Base Definition
               (e.g. Review + Loan)
                        +
              Resolved User Access
                        +
              Authorized Runtime Data
                        +
             User Presentation State
                        │
                        ▼
                  JSON-safe inputs
                        │
                        ▼
        FRONTEND VALIDATION / RESOLUTION
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
     ColDefs       page/actions      data adapters
 renderers/editors translations      query/mutations
 formatters/parsers bounded behavior request mapping
        │               │                │
        └───────────────┼────────────────┘
                        ▼
             proven frontend mechanics
                        ▼
                  AG Grid / SSRM
```

For the initial experiment, runtime row model underneath this diagram = SSRM only.

---

# 48. Most important principle to preserve

The project must not lose its existing strength merely to become “dynamic”.

The configurable system should remove **domain hardcoding from composition**, while preserving **strong frontend ownership of executable mechanics**.

In short:

```text
Make configuration dynamic.
Do NOT make the grid engine vague.
```

and:

```text
Prove the new architecture beside the current architecture first.
Do NOT rewrite proven behavior while still discovering the abstraction.
```

---

# 49. Nested read paths, editable nested values and save mapping are real requirements

Nested API values are normal, not edge cases.

Config must support paths such as:

```text
a.b.c
borrower.customer.name
loan.pricing.interestRate
```

For a read-only field, a path may be enough.

For an editable nested value, consider the whole flow:

```text
read nested value
    ↓
format/display
    ↓
native/custom editor
    ↓
parse/normalize edited value
    ↓
update local edit model
    ↓
map into save payload
```

Do not assume AG Grid `field` alone solves every write/save contract.

Prefer simple field/path behavior where possible; use bounded frontend accessors/parsers/normalizers/save mappers only when the real data shape requires them.

---

# 50. Translation resources are feature/page-oriented

Use translation keys rather than scattering final English strings throughout feature/entity/grid configuration.

The translation resource should be rooted around the **feature/page**, because the page owns more than the grid.

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

The config can store keys:

```ts
{
  id: 'loanAmount',
  field: 'loan.amount',
  labelKey: 'grid.columns.loanAmount.label',
  helpKey: 'grid.columns.loanAmount.help'
}
```

During resolution/compilation, those keys become the normal final strings passed to the page/grid.

The same translation system can serve page titles, sections, action labels, grid headers, help, validation messages, empty/loading/retry/error text and operation feedback.

The exact i18n library/file layout should follow repository conventions when implementation begins.

---

# 51. Defaults and entity-specific translation/message overrides

Common UI/error text should have sensible defaults.

Example:

```text
feature default:
"Unable to save your changes."
```

An entity may override when genuinely needed:

```text
Review + Loan:
"Unable to save the loan changes."
```

Do not duplicate every message in every entity config.

Use a small, documented fallback chain, conceptually:

```text
entity-specific message key, if configured
        ↓ otherwise
feature/page default message key
        ↓ otherwise
shared safe generic translated fallback
```

A developer configuring a new entity must understand which key is optional, what happens when omitted, which default applies and whether an entity can override it.

---

# 52. Optional API/query/mutation feedback messages

For normal operations such as Save, Approve or Reject, executable API/mutation behavior remains frontend code.

Configuration may optionally provide translation/message keys for user feedback.

Illustrative only:

```ts
{
  save: {
    actionKey: 'saveRows',
    feedback: {
      successMessageKey: 'messages.loanSaveSucceeded',
      errorMessageKey: 'messages.loanSaveFailed'
    }
  }
}
```

Rules:

```text
plain API/service function
    → frontend adapter/registry

TanStack Query lifecycle, where appropriate
    → React/feature composition

message keys / optional feedback preference
    → declarative config

localized final text
    → translation resolver
```

A successful operation may intentionally show **no message**.

Do not show arbitrary raw backend exception text to the user by default. Map known backend error cases to known frontend message keys when product requirements need that behavior.

---

# 53. Restricted or masked fields must not leak through secondary capabilities

Masking is wider than the visible renderer.

If the user is not authorized to receive the underlying value, consider removing/disabling capabilities that can reveal or infer it, including:

- filter;
- search;
- copy/clipboard;
- export;
- tooltip;
- sort;
- aggregation;
- other derived operations.

Start restrictive.

Only enable such capabilities when the real product/security contract says they are safe.

If unmask exists, do not persist unmasked values into localStorage, saved Grid State or long-lived user preferences.

A fresh page/session should receive whatever representation backend currently authorizes.

---

# 54. Configuration validation and error ownership

Validate configuration before rendering.

Examples of configuration problems:

- duplicate column IDs;
- missing required row identity;
- unknown renderer/editor/formatter/parser key;
- unsupported schema version;
- invalid required properties;
- inconsistent required configuration.

Because configs are frontend-owned initially, automated tests should catch these during development/CI.

Still keep a small controlled page-level failure:

```text
resolve config
    ↓
validate
    ↓
valid
    → render feature

invalid
    → controlled "Unable to load this view" state
```

Keep error ownership separate:

```text
configuration error
    !=
SSRM row-loading error
    !=
normal mutation/action error
    !=
unexpected React crash
```

Use a React Error Boundary for unexpected component/runtime crashes.

Do not build a complicated remote-config recovery system before one is needed.

---

# 55. Required row identity

Stable row identity should be a required feature/entity contract rather than casually assuming every entity uses `id`.

Conceptually:

```ts
rowIdField: 'loanId'
```

or, only when necessary:

```ts
rowIdAccessorKey: 'reviewLoanRowId'
```

Exact schema naming is open.

Prefer a simple field/path where possible.

Stable identity is critical for selection, editing, Save/Discard, conflict reconciliation, SSRM refresh and stable row behavior.

---

# 56. Representative local data and proof matrix

The Python backend should provide enough representative data/API behavior to prove the architecture.

At minimum use two meaningfully different entity contexts, for example:

```text
Loan
Finance
```

Do not merely rename Transaction columns.

Use data shapes that exercise real concerns such as nested values, different editable fields, renderers/editors/formatters, validation, sensitive/masked fields and different datasource/request mapping.

Also use at least two local mock access profiles.

Conceptually:

```text
                 Profile A       Profile B

Review + Loan    effective A1    effective A2
Review + Finance effective B1    effective B2
```

This should expose accidental hardcoding without turning the experiment into a huge demo.

If masking is demonstrated, restricted backend responses must already be masked.

---

# 57. The config should be easy for another developer to author

A major quality requirement is not merely that the compiler works.

A developer adding a new entity config should be able to understand the schema quickly.

Types, comments/JSDoc and architecture docs should make clear:

- required vs optional properties;
- defaults;
- fallback precedence;
- frontend registry keys;
- translation-key resolution;
- nested field behavior;
- server query key behavior;
- base definition vs resolved access;
- which executable behavior lives in registries/adapters;
- what user preferences may override;
- what authorization always wins over.

Do not rely on tribal knowledge or require a developer to trace several resolver functions just to understand a simple configuration.

---

# 58. New branch and PR #40

The finalized direction is to build the real experiment from the latest `main` on a **new branch**.

The branch for this work is:

```text
configurable-feature-grid
```

This handoff document lives on that branch before implementation starts.

PR #40 was created before these requirements were finalized.

Therefore:

- do not merge PR #40 into `main` merely to continue;
- a new chat may inspect PR #40 for useful ideas;
- it must not assume PR #40's schema/architecture is the desired final design;
- reuse an idea only after reconciling it with this handoff and the current repository;
- decide later whether PR #40 should be closed.

The existing three reference grids remain the source of current proven behavior.

---

# 59. How a new chat should use this handoff

This document is intended to be the single detailed context file for the next chat.

The next chat should:

```text
1. read this file completely;
2. inspect current repository/GitHub state when asked/needed;
3. read AGENTS.md and applicable project/grid rules before changes;
4. inspect current SSRM/editing/validation/Grid State/data-source code;
5. inspect PR #40 only as reference;
6. follow the user's next instruction.
```

The next instruction may be **discussion only**.

For example, the user may first ask the new chat to:

- show the proposed complete schema;
- explain each config area;
- challenge missing requirements;
- classify config vs frontend mechanic;
- compare possible registry/adapter shapes.

Do **not** start implementation merely because this handoff exists.

Wait for explicit user approval before code/branch/PR/doc/CI changes beyond what the user specifically requests.
