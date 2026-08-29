# Metadata-Driven Table Architecture Proposal

> **Status:** Architecture proposal / discussion document. This is not yet an implemented or accepted runtime contract.
>
> The purpose of this document is to capture the proposed direction clearly enough that it can be reviewed, shared, challenged, and refined before implementation begins.

## 1. Why this architecture is needed

The current project proves Client-Side, Infinite, and Server-Side Row Model (SSRM) grid mechanics using a concrete Transactions feature. That is useful for validating row-model behavior, but a production application can require a much more dynamic table shape.

A single logical page or table family may need to vary by current user/session in ways such as:

- which routes or views are available;
- which columns exist for the current user;
- column labels, widths, ordering and filtering behavior;
- whether a field is visible, hidden, read-only or editable;
- whether a field supports sensitive-data masking;
- whether the current user may request an unmasked value;
- which renderer/editor/formatter is used;
- editor options or other renderer/editor parameters;
- field validation metadata and help text;
- which table/business actions are available;
- row-level or field-level restrictions;
- whether dependent behavior should be disabled when a required field/capability is not available.

The frontend should therefore be designed so that the source of table/application metadata can change later without forcing the grid implementation to be rewritten.

The intended migration path is:

```text
TODAY
local JSON-safe configuration
        ↓
configuration provider
        ↓
frontend metadata compiler/resolvers
        ↓
real AG Grid configuration + React components

FUTURE
backend metadata APIs
        ↓
same configuration provider contract
        ↓
same frontend metadata compiler/resolvers
        ↓
real AG Grid configuration + React components
```

The important goal is not to make every AG Grid option remote-configurable. The goal is to make **business-driven variability and authorization declarative**, while keeping executable UI mechanics in normal frontend code.

---

## 2. Core ownership rule

The architecture should follow this boundary:

```text
Backend / authoritative policy layer
    decides WHAT the current user/session may see or do

Frontend
    decides HOW supported metadata becomes React + AG Grid behavior
```

### Backend should eventually be authoritative for

- resolved route/view access;
- which fields/columns the current user may receive;
- read/edit/action authorization;
- field sensitivity and current masking state;
- whether unmask may be requested;
- row-level business eligibility;
- authoritative business validation;
- server-supported filtering/sorting where applicable;
- business-managed lookup/options data where applicable;
- the actual authorized row data.

### Frontend should remain authoritative for

- React components;
- AG Grid lifecycle/event wiring;
- Client/Infinite/SSRM mechanics;
- datasource/cache/store lifecycle;
- selection state machines;
- tracked edit state;
- BASE/LOCAL/REMOTE conflict reconciliation;
- actual renderer/editor/formatter functions;
- retry/loading presentation;
- theme/styling implementation;
- GridApi usage;
- frontend registry implementations;
- generic grid mechanics that do not represent business authorization.

A backend should never send executable JavaScript or React components.

---

## 3. Do not use backend AG Grid `ColDef` as the contract

AG Grid `ColDef` is not a transport format. Real column definitions commonly contain functions and components such as:

```ts
cellRenderer: StatusCell
cellEditor: StatusEditor
editable: (params) => ...
valueFormatter: (params) => ...
cellRendererParams: (params) => ...
```

Those values cannot safely or meaningfully be represented by a backend JSON API.

The proposed boundary is therefore:

```text
JSON-safe application metadata
        ↓
frontend compiler / registry resolution
        ↓
AG Grid ColDef[]
```

The metadata describes supported business/UI intent. Frontend registries turn stable string keys into executable code.

---

## 4. Architectural layers

The proposal separates several concerns that must not be collapsed into one giant configuration object.

```text
Application/session access manifest
        ↓
Base table/view definition
        ↓
Resolved current-user access projection
        ↓
Runtime row/field capabilities + authorized data
        ↓
Frontend registries and metadata compiler
        ↓
Client / Infinite / SSRM grid foundation
```

### 4.1 Application/session access manifest

This answers:

> Which application views/routes can the current user/session access?

It should not require the frontend to understand role/group policy.

Temporary local development may simulate role mappings, but the generic application shell should consume a resolved manifest rather than contain logic such as:

```ts
if (role === 'A') ...
if (role === 'B') ...
```

A future backend could return a resolved manifest similar to:

```json
{
  "schemaVersion": 1,
  "views": [
    {
      "id": "transactions.primary",
      "label": "Transactions",
      "route": "/transactions",
      "componentKey": "dynamicGridPage",
      "tableDefinitionKey": "transactions.primary"
    },
    {
      "id": "portfolio.primary",
      "label": "Portfolio",
      "route": "/portfolio",
      "componentKey": "dynamicGridPage",
      "tableDefinitionKey": "portfolio.primary"
    }
  ]
}
```

Frontend owns the actual component registry:

```ts
const pageRegistry = {
  dynamicGridPage: DynamicGridPage,
  dashboardPage: DashboardPage,
};
```

The backend/local metadata selects only supported keys.

### 4.2 Base table/view definition

The base definition describes what a view **can** contain and how supported fields are intended to behave in general.

It is not automatically the exact projection that every user receives.

For example, a base definition may describe ten possible fields while one current user receives six and another receives all ten.

### 4.3 Resolved current-user access projection

The current-user projection answers questions such as:

- is this field available to this user/session?
- is it visible?
- is it read-only or editable?
- may the current user invoke an action?
- may the current user request an unmasked value?

The frontend should consume the resolved result rather than independently calculate authorization from roles.

### 4.4 Runtime row/field capabilities

Some restrictions may vary by row rather than only by table/user.

Examples:

- one row editable, another read-only;
- one row may allow a business action, another may not;
- one sensitive value may currently be masked;
- a field may be temporarily locked for one row.

Runtime capabilities belong with authoritative row data or a related runtime-capability contract, not in static base table metadata.

### 4.5 Frontend registries and compiler

Metadata remains JSON-safe. Frontend registries resolve keys into actual code and AG Grid options.

Example:

```text
renderer.key = "statusBadge"
        ↓
rendererRegistry["statusBadge"]
        ↓
StatusBadgeCellRenderer
        ↓
AG Grid cellRenderer
```

This is the bridge that makes local configuration replaceable by backend metadata later.

---

## 5. Proposed JSON-safe table definition shape

The exact TypeScript interfaces should be designed during implementation, but the following shows the intended responsibility split.

```json
{
  "schemaVersion": 1,
  "definitionVersion": 1,
  "id": "transactions.primary",
  "rowIdField": "id",
  "rowModel": "infinite",
  "dataSourceKey": "transactions",
  "columns": [
    {
      "id": "reference",
      "field": "reference",
      "semanticKey": "reference",
      "header": "Reference",
      "dataType": "text",
      "layout": {
        "minWidth": 150
      },
      "sort": {
        "enabled": true
      },
      "filter": {
        "type": "text"
      }
    },
    {
      "id": "status",
      "field": "status",
      "semanticKey": "status",
      "header": "Status",
      "dataType": "text",
      "renderer": {
        "key": "statusBadge",
        "params": {
          "compact": true
        }
      },
      "editing": {
        "supported": true,
        "editor": {
          "key": "statusSelect",
          "params": {
            "optionsSourceKey": "transactionStatuses"
          }
        }
      },
      "validation": {
        "ruleSetKey": "STATUS_STANDARD"
      }
    }
  ]
}
```

Everything in this transport shape must remain JSON-safe.

---

## 6. Column identity: `id`, `field`, and `semanticKey`

These concepts should be separate even when they often contain the same string.

### `id`

Stable UI/column identity.

Useful for:

- Grid State;
- column ordering;
- column visibility;
- metadata references;
- dependency checks.

### `field`

Where the column reads/writes its value in the row payload.

Example:

```json
{
  "id": "displayAmount",
  "field": "amount",
  "header": "Amount"
}
```

The frontend should not guess which response property belongs to a column by reading headers or inspecting arbitrary object keys.

### `semanticKey`

Optional stable business/UI meaning used by supported frontend behavior modules.

Example:

```json
{
  "id": "transactionStatus",
  "field": "statusCode",
  "semanticKey": "status"
}
```

A semantic key avoids coupling business behavior to transport field names.

It also avoids a different and dangerous coupling:

> **Business behavior should not be inferred from renderer keys.**

`renderer.key = "statusBadge"` means how a value is presented. It should not silently mean "execute status business logic."

Presentation and behavior must remain separate.

---

## 7. Field configuration should be rich but bounded

A field definition may eventually need to describe many supported concerns. That does not mean exposing every AG Grid property through JSON.

The application schema should include only product-relevant concepts that are intentionally supported.

A field may reasonably contain categories such as:

```text
identity
- id
- field/dataPath
- semanticKey

presentation
- header
- dataType
- width/minWidth/maxWidth
- default visibility
- pinning where product-supported

query behavior
- sortable
- filter type
- filter metadata

rendering
- renderer key
- renderer JSON params
- formatter key
- formatter JSON params

editing
- editing supported
- editor key
- editor JSON params
- options source key

validation
- rule-set/rule key
- configurable validation params
- help text

sensitivity
- whether the field supports masking semantics

behavior/dependencies
- explicit behavior/event binding keys where needed
- required semantic fields/capabilities where needed
```

The schema should not become a remote clone of the full AG Grid API.

---

## 8. Renderers, editors, formatters, and parameters

### 8.1 Renderer registry

Metadata:

```json
{
  "renderer": {
    "key": "statusBadge",
    "params": {
      "compact": true,
      "showIcon": true
    }
  }
}
```

Frontend:

```ts
const rendererRegistry = {
  statusBadge: StatusBadgeCell,
  sensitiveText: SensitiveTextCell,
  link: LinkCell,
};
```

Compiler:

```text
metadata renderer key
→ registry lookup
→ actual React component
→ AG Grid cellRenderer
```

### 8.2 Editor registry

Metadata:

```json
{
  "editing": {
    "supported": true,
    "editor": {
      "key": "select",
      "params": {
        "optionsSourceKey": "statuses"
      }
    }
  }
}
```

Frontend can resolve native AG Grid editors first where possible and custom editors only when needed.

```text
text   → native text editor
number → native number editor
date   → native date editor
select → supported select editor
specialized keys → custom registered editors
```

### 8.3 Formatter registry

Metadata:

```json
{
  "formatter": {
    "key": "currency",
    "params": {
      "currencyField": "currency"
    }
  }
}
```

Frontend registry owns the actual formatter function.

### 8.4 Dynamic renderer/editor params

A backend cannot send a params function.

For common cases, a registered component should receive ordinary AG Grid context/row data plus JSON metadata and resolve values itself.

Example:

```json
{
  "renderer": {
    "key": "money",
    "params": {
      "currencyField": "currency"
    }
  }
}
```

The renderer can read:

```text
params.data["currency"]
```

If genuinely complex parameter derivation is needed, a controlled frontend `paramsResolverKey` registry can be introduced:

```json
{
  "renderer": {
    "key": "specialStatus",
    "paramsResolverKey": "specialStatusParams"
  }
}
```

This should be an exception, not the default. Otherwise the application would slowly recreate arbitrary JavaScript using string keys.

---

## 9. Event handlers and business behavior

This area needs careful design and is intentionally not considered final yet.

There are two different categories of events.

### 9.1 Generic grid events

Examples:

- selection changes;
- pagination changes;
- datasource lifecycle;
- filter changes required by selection semantics;
- tracked edit bookkeeping;
- Grid State changes.

These remain normal frontend/grid-foundation code and should not become remote metadata handlers.

### 9.2 Field/business-specific behavior

A field may require behavior that cannot be inferred purely from its renderer/editor.

Possible declarative shape:

```json
{
  "semanticKey": "status",
  "behaviors": [
    {
      "event": "valueChanged",
      "handlerKey": "statusChanged",
      "params": {
        "refreshDependentActions": true
      }
    }
  ]
}
```

Frontend:

```ts
const fieldBehaviorRegistry = {
  statusChanged: handleStatusChanged,
};
```

The backend/local configuration selects only registered supported behaviors; it never supplies executable code.

### Important rule

Do **not** infer business behavior from:

```text
rendererKey
header text
field name guessing
```

If behavior exists, give it an explicit semantic/behavior identity.

The exact event-binding schema remains an open design point and should be finalized only after concrete use cases are enumerated.

---

## 10. Missing-column and dependency handling

Authorization means frontend code cannot assume that every possible column is present.

This creates an important rule:

> No feature should blindly read a field merely because a base definition normally contains it.

If one feature depends on another field/capability, that dependency should be explicit.

Possible metadata:

```json
{
  "id": "approvalAction",
  "requires": {
    "semanticFields": ["status", "owner"]
  }
}
```

Compiler/runtime behavior can then be deliberate:

```text
all required capabilities available
→ enable feature

required capability missing because of resolved authorization
→ omit/disable feature intentionally

invalid configuration references unavailable requirement unexpectedly
→ controlled configuration error / development warning
```

A renderer should also avoid assuming sibling fields exist unless its definition declares or safely checks those dependencies.

This becomes especially important when two users looking at the same logical table receive different authorized column projections.

---

## 11. Authorization model: do not encode roles in generic frontend code

During local development it is acceptable to simulate:

```text
local profile A
→ view X
→ fields 1, 2, 3, 6
→ field 2 read-only
→ field 3 maskable
```

But this mapping should live behind a temporary authorization/configuration provider.

The generic frontend should consume a resolved access projection.

Future backend authorization may involve any combination of:

- roles;
- groups;
- entitlements;
- domain scope;
- region;
- record ownership;
- data classification;
- temporary privileges;
- policy engines;
- other rules unknown to the frontend.

The frontend should not need to change when those policy internals change.

---

## 12. Base definition versus current-user projection

This distinction is fundamental.

```text
BASE DEFINITION
what this kind of table/view can support
        +
CURRENT-USER ACCESS
what this user/session may currently access/do
        =
RESOLVED TABLE CONFIGURATION
what the frontend may actually render/use
```

Example:

```text
Base definition has 10 possible columns.

User/session A
→ receives 6 visible fields
→ 2 editable
→ 1 sensitive field may request unmask

User/session B
→ receives all 10
→ 6 editable
→ sensitive field remains read-only/masked
```

The backend may eventually choose to return these as separate endpoints or one already-resolved effective definition. Either can work if the conceptual separation remains clear.

---

## 13. Sensitive data and masking

Masking must be treated as a security/data-delivery concern, not merely visual styling.

### 13.1 Definition-level capability

Base metadata may declare:

```json
{
  "sensitivity": {
    "maskable": true
  }
}
```

This means the field participates in sensitive-value handling.

It does **not** mean every user may unmask it.

### 13.2 Current-user entitlement

Resolved access may declare:

```json
{
  "visible": true,
  "read": true,
  "edit": false,
  "canRequestUnmask": true
}
```

### 13.3 Runtime value state

The row payload may indicate that the value currently delivered is masked.

Possible wire shapes must still be decided, for example:

```json
{
  "customerReference": {
    "displayValue": "****1234",
    "masked": true
  }
}
```

or another typed field representation.

### 13.4 Security rule

If the current user is not allowed to see the real value, the backend should not send the real value and ask the frontend to visually hide it.

Frontend-only masking is not sufficient protection because the raw value would still exist in network responses/browser memory/devtools.

### 13.5 Unmask flow

A future flow could be:

```text
user requests unmask
        ↓
frontend calls authoritative operation
        ↓
backend re-checks permission/policy
        ↓
optional reason/approval/workflow/audit
        ↓
backend returns permitted value or rejects request
```

The grid foundation should not care what authorization mechanism is used behind that operation.

### 13.6 Filtering/sorting masked fields

This requires explicit policy.

A user who cannot see a raw value may or may not be allowed to:

- filter by the raw value;
- search against it;
- sort using it;
- export it.

Those rules must ultimately be backend-authoritative rather than inferred by the frontend.

---

## 14. Read-only, hidden, editable, and maskable are different concepts

Do not collapse these states.

A field may be:

```text
not available at all
visible + read-only
visible + editable
visible + masked
visible + masked + allowed to request unmask
visible + unmasked + read-only
visible + unmasked + editable
```

The exact allowed combinations depend on product/security rules.

The metadata/access model must be expressive enough to represent these independently.

---

## 15. Runtime row-level and field-level authorization

Table-level metadata is not enough if permissions vary by row.

The existing project already has generic row interaction concepts such as:

```text
enabled
selectionDisabled
readOnly
```

A more dynamic application may eventually need finer capabilities such as:

```text
row action allowed/blocked
field A editable, field B read-only for this row
unmask permitted for this row/field
business action eligibility reasons
```

The architecture should support runtime capability metadata when a real product need appears, but should not pre-build an extremely complex permission engine without concrete requirements.

Backend remains authoritative and must re-check all modifying/unmask/export operations even when the frontend has already disabled the corresponding UI.

---

## 16. Validation metadata: declarative, but exact rule schema still open

Validation belongs naturally in the metadata architecture, but the exact rule representation remains a separate design decision.

The important requirements are already clear:

- metadata must be JSON-safe;
- validation must not require executable backend-provided JavaScript;
- a rule key alone may be insufficient when configuration values are needed;
- fields may require help text;
- frontend should validate immediately where possible for UX;
- backend must validate authoritatively again;
- structured backend field errors must map back to the same field validation state;
- rejected LOCAL input should not silently disappear;
- validation errors and edit conflicts are separate states and may coexist.

A provisional keyed shape could be:

```json
{
  "validation": {
    "ruleSetKey": "NUM_ABC",
    "params": {
      "max": 1000000,
      "decimalPlaces": 2
    },
    "helpText": "Enter the approved amount."
  }
}
```

Another possible design is a separate rule-definition catalog loaded once and referenced by keys from fields.

That decision is intentionally **not finalized by this proposal**.

### Frontend validator registry concept

Regardless of the final metadata shape, frontend executable validators should be allowlisted code:

```ts
const validatorRegistry = {
  required: validateRequired,
  maxLength: validateMaxLength,
  min: validateMin,
  max: validateMax,
  decimalPlaces: validateDecimalPlaces,
};
```

No arbitrary expressions/functions should be executed from metadata.

---

## 17. Conflict handling remains separate from validation configuration

The existing BASE/LOCAL/REMOTE conflict model represents a different problem from validation.

```text
Validation
→ is the user's/local value acceptable?

Conflict
→ did authoritative remote data diverge from the BASE while a LOCAL edit exists?
```

Metadata may declaratively indicate that a field participates in tracked editing or a supported conflict policy, for example conceptually:

```json
{
  "editing": {
    "supported": true,
    "tracked": true,
    "conflictPolicyKey": "baseLocalRemote"
  }
}
```

But the actual conflict state machine remains frontend capability code, not JSON logic.

Runtime conflict state should remain separate from static field metadata.

Similarly, validation state should remain separate from conflict state so neither overwrites the other.

---

## 18. Business actions

Table/row actions may also need declarative identity.

Metadata can describe which supported action is present:

```json
{
  "actions": [
    {
      "key": "setStatus",
      "label": "Update Status",
      "requires": {
        "semanticFields": ["status"]
      }
    }
  ]
}
```

Frontend action registry owns executable behavior.

Resolved access decides whether the current user may see/invoke the action.

Backend still authorizes the operation at execution time.

The selected-action `clear/preserve` lifecycle can remain an action-level frontend policy; it should not become an implicit universal grid default.

---

## 19. Data source ownership

This architecture does not require every table to discover its API by guessing response keys or embedding arbitrary URLs into column definitions.

The data source boundary can remain explicit.

Possible metadata:

```json
{
  "dataSourceKey": "transactions"
}
```

Frontend/API registry:

```ts
const dataSourceRegistry = {
  transactions: transactionsDataSource,
  portfolio: portfolioDataSource,
};
```

If a future backend standardizes one generic metadata-driven data API, this boundary can evolve later.

The key requirement is that column `field`/`dataPath` values explicitly match the row payload contract. The frontend should never guess the mapping by reading labels or arbitrary response keys.

---

## 20. Configuration precedence

Once multiple configuration layers exist, precedence must be deterministic.

A useful conceptual order is:

```text
frontend safe defaults
        ↓
base table/view definition
        ↓
resolved current-user access projection
        ↓
runtime row/field capability
        ↓
transient UI/application state
```

Examples:

- frontend default min width applies only when the definition does not specify one;
- base definition may say editing is supported;
- resolved authorization may reduce that to read-only;
- runtime row capability may further lock one particular row;
- frontend must never use a later UI state to grant access denied by an earlier authoritative layer.

Authorization should only reduce/shape capability; frontend state must not escalate it.

---

## 21. Grid State must reconcile with authorization

Persisted Grid State creates a subtle security/correctness issue.

Example:

```text
Day 1
user can access columns A, B, C, D
→ Grid State stores order/visibility/width

Day 2
authorization removes column C
```

Restoring yesterday's Grid State must not recreate or expose column C.

Rule:

```text
current authorized compiled columns
        ↓
reconcile persisted Grid State
        ↓
apply state only to still-allowed columns
```

Persisted client preferences are subordinate to current authorization/configuration.

---

## 22. Schema/version compatibility

If backend configuration can evolve independently from frontend releases, versioning is mandatory.

Recommended metadata includes:

```json
{
  "schemaVersion": 1,
  "definitionVersion": 17
}
```

### `schemaVersion`

Describes the transport/schema contract the frontend compiler understands.

### `definitionVersion`

Identifies a particular configuration revision and may support caching/invalidation/audit.

Unknown schema versions or unknown required registry keys should fail predictably rather than silently rendering incorrect UI.

Possible controlled behavior:

```text
unknown optional feature
→ omit with diagnostic where safe

unknown required renderer/editor/behavior
→ configuration error state

unsupported schema version
→ refuse to compile definition
```

---

## 23. Registry validation and safety

Every remote/local executable reference must be allowlisted.

Examples:

```text
renderer key
editor key
formatter key
validator key
behavior/event handler key
action key
page component key
params resolver key
```

The compiler must reject or safely handle unknown values.

This is important for:

- type safety;
- predictable releases;
- security;
- preventing backend metadata from becoming an unbounded scripting language;
- testability.

---

## 24. Caching and invalidation

Table/application metadata is not the same lifecycle as row data.

Do not fetch full definitions repeatedly for every Infinite/SSRM block.

Likely ownership:

```text
application/session metadata
→ normal application API boundary / TanStack Query cache

row data
→ Client collection query OR AG Grid Infinite/SSRM datasource lifecycle
```

Important future questions include:

- when authorization changes, how is metadata invalidated?
- do definitions have ETags/version numbers?
- does sign-out clear metadata cache?
- can permissions change mid-session?
- should a sensitive-data privilege expiry invalidate unmasked values?

These can be designed when backend behavior becomes concrete.

---

## 25. Local-now, API-later provider boundary

The frontend should not import local JSON directly throughout grid components.

Instead define a provider/service boundary conceptually like:

```ts
interface ApplicationConfigurationProvider {
  getApplicationManifest(): Promise<ApplicationManifest>;
  getTableDefinition(key: string): Promise<TableDefinition>;
  getResolvedAccess(key: string): Promise<ResolvedAccess>;
}
```

### Initial provider

```text
LocalConfigurationProvider
→ static JSON-safe objects
→ temporary local access profiles
```

### Future provider

```text
ApiConfigurationProvider
→ backend metadata endpoints
```

Everything below this provider should consume the same validated internal metadata model.

This prevents frontend implementation from being coupled to whether backend metadata exists today.

---

## 26. Compiler responsibility

The metadata compiler should have one clear job:

```text
validated JSON-safe definition
+ resolved access
+ supported registries
        ↓
compiled runtime table model / AG Grid ColDef[]
```

The compiler may:

- remove unauthorized fields;
- apply read-only/edit permissions;
- resolve renderer/editor/formatter keys;
- resolve supported filter types;
- attach validation descriptors to frontend validation mechanics;
- verify dependency requirements;
- reject unsupported required registry keys;
- produce runtime configuration for the correct row-model root.

The compiler should **not** become a universal React/AG Grid wrapper.

Concrete Client/Infinite/SSRM roots should still own lifecycle and native row-model behavior where appropriate.

---

## 27. Native AG Grid first still applies

Metadata-driven architecture does not change the project's existing native-first rule.

For each capability:

```text
1. native AG Grid capability
2. row-model-specific native capability
3. custom frontend capability only for a real semantic gap
```

Examples:

- metadata `editor.key = "number"` can compile to native number editor;
- metadata `filter.type = "text"` can compile to the supported native text filter;
- custom renderer keys exist only when product presentation requires them;
- custom selection state still exists only where row-model semantics require it.

---

## 28. What should NOT become metadata-driven

Do not remotely configure implementation internals merely because it is technically possible.

Avoid turning these into backend JSON:

- raw React component code;
- arbitrary JavaScript expressions;
- datasource lifecycle algorithms;
- GridApi event code;
- selection algorithms;
- conflict reconciliation implementation;
- retry/cancellation algorithms;
- theme implementation;
- every possible AG Grid option;
- internal hooks;
- generic application state machines.

This would create a remote programming language rather than a maintainable metadata contract.

---

## 29. Security rules

1. Frontend visibility is UX, not authorization.
2. Backend must independently authorize every protected read/write/action/export/unmask request.
3. Sensitive raw values should not be sent when the user is not permitted to see them.
4. Frontend config must never be able to escalate backend capability.
5. Unknown remote registry keys must not execute arbitrary code.
6. Persisted Grid State must never restore unauthorized fields.
7. Export/filter/search behavior on sensitive fields requires explicit policy.
8. Runtime changes in authorization may require invalidating cached definitions and sensitive values.

---

## 30. Testing expectations for this capability

When implementation begins, tests should cover at least the following boundaries.

### Schema/compiler

- valid metadata compiles to expected runtime config;
- unknown schema version is rejected;
- unknown required renderer/editor/action/behavior key is handled predictably;
- JSON metadata remains function-free;
- `field` mapping is explicit and deterministic.

### Authorization projection

- unauthorized columns are absent;
- read-only access cannot become editable through base definition/UI state;
- editable access compiles correctly when allowed;
- dependent actions/features are omitted/disabled when required fields are missing;
- Grid State cannot resurrect unauthorized columns.

### Registries

- renderer key resolves expected component;
- editor key resolves native/custom editor correctly;
- JSON params pass through safely;
- formatter/params resolvers behave deterministically.

### Sensitive data

- masked state renders correctly;
- unmask action only appears when resolved capability allows it;
- raw value is not assumed to exist in masked payloads;
- sensitive filter/export behavior follows explicit policy.

### Validation/editing

- declarative validation metadata reaches the validation engine;
- backend field errors map to the correct row/field;
- validation and conflict state can coexist;
- invalid LOCAL input remains visible until corrected/reverted;
- missing validation rule keys fail safely.

### Row-model integration

- Client, Infinite and SSRM compile the same logical field metadata into their appropriate native/runtime mechanics without forcing identical lifecycle implementation.

---

## 31. Suggested implementation phases

No implementation should start merely because this document exists. After architecture review, an incremental sequence could be:

### Phase 1 — JSON-safe internal schema

- define TypeScript metadata contracts;
- define schema validation;
- define local provider boundary;
- no backend dependency yet.

### Phase 2 — frontend registries + compiler

- renderer registry;
- editor registry;
- formatter registry;
- supported filter mapping;
- column compiler;
- explicit field/semantic identity;
- dependency validation.

### Phase 3 — local access projections

- simulate multiple authorized table projections locally;
- prove one base definition can produce different field sets/read-only/editable states;
- prove missing-column dependencies degrade safely;
- keep mock role/profile logic isolated behind provider.

### Phase 4 — sensitive field capability shape

- definition-level maskable capability;
- resolved user capability;
- runtime masked representation;
- controlled unmask action boundary.

### Phase 5 — validation metadata integration

- finalize rule-key/rule-object contract;
- frontend validation registry;
- help/error presentation;
- backend validation error mapping;
- validation/conflict coexistence.

### Phase 6 — remote metadata provider

When backend endpoints become available:

```text
replace LocalConfigurationProvider
with ApiConfigurationProvider
```

The grid/compiler architecture should remain unchanged.

---

## 32. Important open decisions before implementation

The following points remain deliberately open and require discussion:

1. Does backend eventually return base definitions and access projections separately, or one already-resolved effective definition?
2. What is the exact validation rule contract: `ruleSetKey + params`, inline rules, separate rule catalog, or a hybrid?
3. What exact field/business event binding model is needed, and which concrete events justify metadata bindings?
4. How should runtime per-row/per-field capabilities be represented without bloating every row response?
5. What is the final wire representation for masked values?
6. Which sensitive operations require explicit reason/audit/approval flow?
7. How should server filtering/search behave for masked fields?
8. Which column dependencies should be metadata-declared versus encapsulated inside registered frontend components?
9. Which table actions belong in metadata and which stay feature composition?
10. How much of row-model choice belongs in metadata versus route/component composition?
11. How should configuration/cache invalidation behave when entitlements change mid-session?
12. What is the exact merge/reconciliation policy between persisted Grid State and new definition versions?

These questions should be resolved from actual use cases rather than by building a generic framework for every hypothetical scenario.

---

## 33. Proposed standing principles

If this architecture is accepted, the implementation should preserve these principles:

> **Business policy is declarative; executable UI logic is frontend code.**

> **Backend authorization is authoritative; frontend capability is only presentation/interaction guidance.**

> **Metadata must remain JSON-safe so local definitions can later be replaced by API responses.**

> **Do not send AG Grid `ColDef` from backend. Compile application metadata into `ColDef` on frontend.**

> **Do not infer business behavior from renderer names, headers, or guessed fields. Use explicit semantic/behavior identities.**

> **A missing authorized field must not break dependent logic. Dependencies must be explicit or safely encapsulated.**

> **Sensitive values must be protected at the data/API boundary, not merely visually masked in React.**

> **Validation and conflict state are separate concerns even when both affect the same edited cell.**

> **Native AG Grid first; metadata selects supported capabilities rather than recreating AG Grid as JSON.**

> **Start local, preserve the provider boundary, and replace the source with backend APIs later without rewriting the table engine.**
