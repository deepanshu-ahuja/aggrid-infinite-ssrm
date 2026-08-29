# Configurable Table Architecture — Standalone Overview

## Purpose

Modern business applications often need one logical table experience to present different shapes and capabilities to different users. The variation may come from business context, authorization, data sensitivity, field-level access, or workflow rules.

A scalable design should not require the frontend to hardcode every possible table shape or to understand backend role logic. Instead, the backend should return a resolved, declarative description of what the current user/session may see and do, while the frontend remains responsible for turning supported metadata into real UI behavior.

The target architecture is:

```text
Current user/session
        ↓
Backend resolves business context + authorization
        ↓
JSON-safe view/table metadata + authorized row data
        ↓
Frontend metadata compiler / registries
        ↓
React + AG Grid behavior
```

The key principle is:

> **Backend decides WHAT is allowed and configured. Frontend decides HOW supported configuration becomes executable UI behavior.**

---

## Why this is required

A table cannot be assumed to have one permanent set of columns or permissions.

For example, the same logical table family may need to support cases where:

- one user can see five fields while another can see ten;
- a field is visible for one user but unavailable for another;
- a visible field is read-only for one user and editable for another;
- a sensitive field is masked for one user and eligible for an explicit unmask request for another;
- two business contexts share some fields but have different access to those fields;
- different renderers, editors, formatting rules, validation rules, or actions are needed;
- row-level or field-level restrictions vary even within the same table;
- an operation must be disabled because a required field/capability is not available to the current user.

If these decisions are permanently hardcoded in frontend role checks, the frontend becomes tightly coupled to authorization policy and must be changed whenever backend policy evolves.

A metadata-driven contract avoids that coupling.

---

## Backend responsibility

The backend should be authoritative for business and security decisions. The frontend should consume a **resolved result**, not reverse-engineer permissions from role names.

The backend should eventually determine, as applicable:

- which views/routes the current user/session may access;
- which fields/columns are available;
- whether a field is hidden, read-only, editable, or otherwise restricted;
- whether a field is sensitive/maskable;
- whether the value currently returned is masked;
- whether the user may request an unmasked value;
- which business actions are available;
- row-level and field-level eligibility;
- business validation metadata;
- server-supported sorting/filtering capabilities;
- business-managed option/lookup sources;
- the actual authorized row data.

The backend may internally use roles, groups, entitlements, attributes, policy engines, record ownership, classifications, temporary grants, or any other authorization model. The frontend should not need to know that implementation.

It should receive the resolved answer.

### Security rule

Frontend configuration is not a security boundary.

If a user is not allowed to receive a sensitive value, the backend should not send the real value and rely on the browser to visually hide it. The backend should return an appropriately masked/redacted representation and re-authorize any later unmask request.

Likewise, backend APIs must independently enforce edit/action/export permissions even when the UI already hides or disables those operations.

---

## Frontend responsibility

The frontend should remain responsible for executable UI mechanics.

Examples include:

- React components;
- AG Grid lifecycle and GridApi interactions;
- Client-Side, Infinite, and Server-Side Row Model mechanics;
- datasource/cache/store lifecycle;
- selection state machines;
- tracked editing and dirty-state handling;
- conflict reconciliation;
- actual renderer/editor/formatter implementations;
- loading/error/retry presentation;
- theme and styling implementation;
- supported event-handler implementations;
- validation-engine execution;
- state-persistence mechanics.

The backend should never send executable JavaScript, React components, callback functions, or arbitrary expressions for the browser to execute.

---

## Do not use AG Grid `ColDef` as the backend contract

An AG Grid column definition commonly contains executable values such as:

```ts
cellRenderer: SomeReactComponent
cellEditor: SomeEditor
editable: (params) => ...
valueFormatter: (params) => ...
cellRendererParams: (params) => ...
```

Those are frontend implementation details and are not suitable as a backend JSON contract.

Instead, the backend should send JSON-safe application metadata and the frontend should translate supported keys into real AG Grid configuration.

```text
JSON-safe table metadata
        ↓
frontend compiler / resolvers
        ↓
real ColDef[] + callbacks + components
```

---

## Example field metadata

A field may be described declaratively:

```json
{
  "id": "status",
  "field": "status",
  "header": "Status",
  "dataType": "text",
  "minWidth": 130,
  "sortable": true,
  "filter": {
    "type": "text"
  },
  "renderer": {
    "key": "statusBadge",
    "params": {
      "compact": true
    }
  },
  "editor": {
    "key": "statusSelect",
    "params": {
      "optionsSourceKey": "statusOptions"
    }
  },
  "validation": {
    "ruleKey": "STATUS_ALLOWED",
    "params": {}
  }
}
```

The metadata contains no React component or function.

The frontend owns allowlisted registries such as:

```text
statusBadge
→ StatusBadgeRenderer

statusSelect
→ StatusSelectEditor

currency
→ CurrencyFormatter

STATUS_ALLOWED
→ supported validation implementation
```

This same pattern can be used for renderers, editors, formatters, validation rules, supported behaviors, action handlers, parameter resolvers, and other executable frontend capabilities.

---

## Renderer/editor parameters

A backend may provide JSON-safe parameters when a supported frontend component needs configuration.

Example:

```json
{
  "renderer": {
    "key": "money",
    "params": {
      "currencyField": "currency",
      "showSymbol": true
    }
  }
}
```

The frontend renderer receives normal row/cell context and interprets the approved parameters.

If a use case requires dynamic parameter calculation, the metadata may refer to a supported frontend resolver key rather than transmitting a function. Arbitrary backend expressions should not be executed by the browser.

---

## Field identity and data binding

A field definition should distinguish stable UI identity from data binding.

```json
{
  "id": "customerBalance",
  "field": "balance",
  "header": "Customer Balance"
}
```

- `id` is a stable UI/configuration identity and can participate in persisted grid state.
- `field` identifies where the value is read/written in the row data contract.

They may often be identical, but they should not be assumed to mean the same thing. Display-only/action/computed columns may have a stable column ID without mapping directly to one response field.

The frontend should not infer business fields by inspecting arbitrary response keys or by reading a column header.

---

## Authorization projection

It is useful to distinguish:

```text
Table/view definition
= what the business view can support

Resolved authorization
= what this user/session may actually see/do

Runtime row data
= what values/capabilities are currently delivered
```

A definition might describe ten possible fields, while the resolved current-user view contains only six.

For a visible field, resolved authorization may also indicate capabilities such as:

```json
{
  "fieldId": "customerName",
  "visible": true,
  "access": "read",
  "canRequestUnmask": true
}
```

Another user may receive a different projection for the same underlying field definition.

The frontend should consume the resolved projection rather than contain business-role `if/else` logic.

---

## Sensitive and masked fields

Three concepts should remain separate:

```text
maskable
→ the field supports sensitive-data treatment

currently masked
→ the value delivered for this row is currently masked/redacted

can request unmask
→ the current user/session may initiate an authorized unmask operation
```

A mask-capable field does not automatically imply that every user can unmask it.

An unmask flow should remain authoritative:

```text
user requests unmask
        ↓
backend re-authorizes request
        ↓
optional audit / approval / policy workflow
        ↓
backend returns permitted value or denies request
```

The grid should not need to know how the authorization decision is internally produced.

---

## Editors and input capability

Field metadata may declaratively describe whether a field is editable and which supported editor/input behavior is required.

Examples:

```json
{
  "field": "effectiveDate",
  "editable": true,
  "editor": {
    "key": "date"
  }
}
```

```json
{
  "field": "category",
  "editable": true,
  "editor": {
    "key": "select",
    "params": {
      "optionsSourceKey": "categoryOptions"
    }
  }
}
```

The frontend should use native AG Grid editors where appropriate and frontend-owned custom editors where required.

---

## Validation

Validation should also be declarative at the configuration boundary while execution remains frontend-owned and authoritative validation remains backend-owned.

A possible field shape is:

```json
{
  "field": "amount",
  "validation": {
    "ruleKey": "NUMERIC_AMOUNT",
    "params": {
      "min": 0,
      "max": 1000000,
      "decimalPlaces": 2
    },
    "helpText": "Enter a positive amount with up to two decimals."
  }
}
```

The exact rule-catalog/schema can evolve, but the important boundary is stable:

```text
metadata identifies a supported validation capability + parameters
        ↓
frontend executes known client validation
        ↓
backend validates again when data is persisted
```

The backend must never send arbitrary JavaScript validation logic for the browser to execute.

---

## Events and business behaviors

Presentation keys should not silently imply business logic.

For example:

```text
rendererKey = "statusBadge"
```

should mean only that the field uses a supported status presentation component. It should not automatically mean that status-specific business actions must run.

Where metadata-driven behavior is required, it should be declared separately through supported semantic/behavior/action keys.

Conceptually:

```json
{
  "field": "status",
  "semanticKey": "status",
  "behaviors": [
    {
      "event": "valueChanged",
      "handlerKey": "statusChanged"
    }
  ]
}
```

The frontend maps `statusChanged` to an allowlisted implementation.

This keeps presentation, data meaning, and executable business behavior separate.

---

## Missing-field dependencies

Dynamic authorization means a business capability must never assume that every possible field is available.

If a feature depends on a field/capability that the current user is not authorized to receive, the resolved UI should intentionally omit or disable that dependent feature.

```text
required capability available
→ enable supported behavior

required capability intentionally unavailable
→ omit/disable dependent behavior

invalid configuration references a required capability that should exist
→ controlled configuration error
```

The frontend should not crash or silently read undefined data because a field was removed by authorization.

---

## Row-level and field-level runtime restrictions

Some permissions cannot be expressed only once at table-definition level. Different rows may have different eligibility, and a field may be editable on one row but read-only on another.

The architecture should therefore allow runtime row/field capabilities to be delivered separately from the static field definition when required.

The table-definition metadata describes supported behavior; runtime authorized data/capabilities determine what is allowed for the specific row.

---

## Three AG Grid row models remain distinct

Configuration-driven tables should not erase the differences between AG Grid row models.

```text
resolved table definition
        ↓
row-model-specific composition
        ├── Client-Side
        ├── Infinite
        └── Server-Side (SSRM)
```

The declarative table definition can provide inputs such as columns, field behavior, validation, and capabilities, while each row model keeps its correct loading, selection, pagination, cache/store, refresh, and lifecycle mechanics.

A metadata system should not force Client-Side, Infinite, and SSRM into one identical implementation.

---

## Configuration compiler / registry boundary

A clean architecture keeps metadata away from low-level grid algorithms.

```text
backend metadata
        ↓
validate schema + resolve supported keys
        ↓
metadata compiler / registries
        ↓
normal strongly typed inputs
        ├── column definitions
        ├── editing options
        ├── validation rules
        ├── business actions
        ├── row interaction rules
        └── row-model composition
        ↓
existing grid mechanics
```

Shared selection, loading, editing, conflict, retry, freshness, and lifecycle algorithms should not need to understand the entire metadata schema.

This boundary prevents a large remote configuration object from spreading through every shared hook and makes the system easier to test and evolve.

---

## Versioning and validation of metadata

Backend-provided metadata should be versioned and validated before it is compiled.

Example:

```json
{
  "schemaVersion": 1,
  "definitionVersion": 42
}
```

The frontend should reject or handle unsupported schema versions and unknown critical registry keys predictably.

An unknown renderer/editor/action/validation key should result in a controlled configuration failure or defined fallback, not arbitrary execution or an unexplained runtime crash.

---

## Grid-state reconciliation

Persisted user grid state must never override current authorization.

If a user previously had access to a column and later loses access, saved column order/visibility/width state must not restore that unauthorized column.

Persisted state should always be reconciled against the currently resolved authorized table definition before being applied.

---

## What should not become remote configuration

The goal is not to expose every AG Grid option through JSON.

Remote/declarative metadata should be reserved for meaningful business variability, authorization, and supported presentation/behavior choices.

Low-level implementation details should remain frontend code, including:

- arbitrary React component code;
- arbitrary JavaScript callbacks;
- AG Grid internal lifecycle implementation;
- datasource request-order algorithms;
- selection algorithms;
- conflict state machines;
- cache/store ownership;
- generic error/retry mechanics;
- theme implementation;
- arbitrary expressions supplied by a server.

This prevents the metadata layer from becoming a second programming language for the frontend.

---

## Target result

The desired end state is a system in which backend teams can express the resolved business shape and permissions of a table through a stable JSON-safe contract, while frontend teams maintain a controlled library of supported UI capabilities.

```text
Business policy / authorization
        ↓
backend-resolved declarative metadata
        ↓
frontend compiler + allowlisted registries
        ↓
row-model-specific grid composition
        ↓
React + AG Grid
```

This gives the application flexibility without sacrificing security, type safety, testability, or the row-model-specific behavior required by AG Grid.