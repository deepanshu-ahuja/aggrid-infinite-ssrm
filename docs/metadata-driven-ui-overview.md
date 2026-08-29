# Metadata-Driven UI Architecture — One-Time Overview

> **Purpose:** This is a one-time, high-level architecture snapshot intended for sharing with backend engineers, architects, leads, or other stakeholders.
>
> It is **not** the maintained technical source of truth. Detailed and evolving frontend design decisions belong in [`metadata-driven-table-architecture.md`](./metadata-driven-table-architecture.md).

## 1. Goal

The application should support tables and views whose shape can vary by business context and by the current user's resolved access.

Examples of variation include:

- which routes/views the current user may access;
- which columns are available;
- column labels, widths, ordering and filter/sort capability;
- whether a visible field is read-only or editable;
- whether a field is sensitive and currently masked;
- whether the user may request an unmasked value;
- which renderer, editor or formatter should be used;
- which business actions are available;
- validation metadata and help text;
- row-level or field-level restrictions.

The frontend should be built so that this configuration can be local today and supplied by backend APIs later without redesigning the table implementation.

```text
TODAY
local JSON-safe configuration
        ↓
frontend configuration provider
        ↓
frontend compiler / registries
        ↓
React + AG Grid

FUTURE
backend metadata / authorization APIs
        ↓
same frontend configuration provider contract
        ↓
same frontend compiler / registries
        ↓
React + AG Grid
```

The objective is **not** to make the backend remotely program React or AG Grid. The backend should provide declarative business metadata and resolved authorization; the frontend should translate supported metadata into executable UI behavior.

---

## 2. Core ownership boundary

### Backend / policy layer

The backend should eventually be authoritative for **what the current user/session is allowed to see or do**.

That includes, where applicable:

- accessible views/routes;
- visible/available fields;
- read/edit/action authorization;
- sensitive-data policy;
- whether a value is currently masked;
- whether unmask may be requested;
- row-level and field-level business eligibility;
- authoritative validation;
- server-supported sorting/filtering;
- business-managed lookup/options data;
- the actual authorized row data.

The frontend should not permanently hardcode role names such as `ROLE_A`, `ROLE_B`, etc. The backend may use roles, groups, entitlements, region, ownership, temporary access or any other policy model internally. The frontend should consume the **resolved result**.

### Frontend

The frontend should remain authoritative for **how supported metadata becomes real UI behavior**.

That includes:

- React components;
- AG Grid lifecycle and `GridApi` usage;
- Client-Side / Infinite / SSRM mechanics;
- datasource/cache/store lifecycle;
- selection mechanics;
- tracked editing;
- conflict reconciliation;
- actual renderer/editor/formatter functions;
- loading/retry/error presentation;
- theme and styling implementation;
- registry implementations;
- metadata-to-AG-Grid compilation.

The backend must never send executable JavaScript, React components or arbitrary functions.

---

## 3. JSON-safe table metadata

The transport/configuration contract should be application metadata, **not AG Grid `ColDef`**.

A simplified field definition could look like:

```json
{
  "id": "status",
  "field": "status",
  "header": "Status",
  "minWidth": 140,
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
  }
}
```

This object is JSON-safe. It contains no React component and no callback function.

The frontend owns registries such as:

```text
renderer key "statusBadge"
        ↓
frontend renderer registry
        ↓
actual StatusBadge React component

editor key "statusSelect"
        ↓
frontend editor registry
        ↓
actual supported editor implementation
```

The same pattern can be used for formatters, editors, actions, lookup sources and other supported behaviors.

Unknown/unsupported keys should fail in a controlled way rather than executing arbitrary code.

---

## 4. Table definition and user authorization are different concepts

A table/view definition describes what that type of view **can support**.

The current-user authorization projection describes what this user/session **may actually receive or do**.

Conceptually:

```text
base table/view definition
        +
resolved current-user access
        ↓
usable table configuration
```

A base definition may contain 10 possible fields while one user receives 6 and another receives all 10.

A visible field may also resolve differently per user:

```text
User A → visible + read-only
User B → visible + editable
User C → not available
```

The frontend should consume the resolved configuration rather than contain business-role branching throughout grid code.

---

## 5. Sensitive and masked values

Masking is not only presentation.

If the current user is not allowed to see the real value, the backend should normally return a masked value rather than sending the real value and relying on CSS/React to hide it.

Three different concepts should remain separate:

```text
field is mask-capable
current value is masked
current user may request unmask
```

For example:

```text
Definition
→ this field supports sensitive-data treatment

Resolved access
→ current user may request unmask

Runtime row data
→ current value is currently masked
```

An unmask action should be an authoritative backend operation. The backend can re-check permissions, auditing or any future approval/workflow requirements before returning an unmasked value.

---

## 6. Read-only, hidden and missing are not the same

The architecture should distinguish:

```text
hidden/not authorized
→ field is not available to the UI

visible + read-only
→ value can be displayed but not edited

visible + editable
→ editing is permitted by the resolved configuration
```

This matters because other UI behavior may depend on a field.

If a feature depends on a field/capability that the user is not authorized to receive, the frontend should not blindly execute logic against a missing value. The compiled configuration should intentionally disable/omit that dependent behavior or raise a controlled configuration error when the configuration itself is invalid.

---

## 7. Business behavior should use explicit semantic keys

Presentation should not silently define business behavior.

For example, a renderer key such as:

```text
statusBadge
```

should mean only "use this visual renderer". It should not automatically mean "execute status business logic".

Where a field participates in business behavior, the metadata should use a separate semantic/behavior identifier, for example:

```json
{
  "field": "status",
  "semanticKey": "status"
}
```

or an explicit supported event/action binding.

The frontend then resolves that key through an allowlisted implementation registry.

The exact event-binding schema is a technical design detail and belongs in the main architecture document.

---

## 8. Validation fits the same declarative model

Validation should also be designed so that business/configurable rules can later come from backend metadata while actual frontend validation algorithms remain frontend code.

Conceptually a field may reference:

```text
rule key / rule-set key
+ JSON-safe parameters
+ help text / validation message metadata
```

The exact validation schema is intentionally not finalized in this overview.

The important boundary is:

```text
metadata describes the rule
frontend executes supported client-side validation
backend validates authoritatively again
```

Validation and edit conflicts remain separate concerns. Validation asks whether the local value is acceptable; conflict handling asks whether the remote value changed relative to the user's editing base.

---

## 9. Why this is scalable

This approach avoids two problematic extremes.

### Avoid hardcoding every business variation in React

Without metadata, the frontend can drift toward many conditionals such as:

```text
if role X → these columns
if role Y → those columns
if group Z → different masking
```

That does not scale as authorization and table variants grow.

### Avoid making the backend a remote UI programming engine

The backend should not send arbitrary AG Grid options, JavaScript or React behavior.

Instead:

```text
Backend / configuration
→ declarative WHAT

Frontend registries / grid foundation
→ executable HOW
```

This keeps security/business policy authoritative while preserving typed, tested frontend code.

---

## 10. Recommended delivery path

The frontend does not need to wait for a complete backend metadata platform.

A practical sequence is:

```text
Phase 1
JSON-safe local table definitions + local simulated access profiles

Phase 2
same frontend compiler and registries

Phase 3
backend starts returning resolved current-user access

Phase 4
backend starts supplying table/field metadata where useful

Phase 5
additional backend-driven validation/lookups/actions are introduced only where required
```

The frontend-facing configuration interface should remain stable while the source behind it changes from local objects to APIs.

---

## 11. Architecture summary

```text
Current user/session
        ↓
Authoritative backend policy (future)
        ↓
Resolved access + JSON-safe view/table metadata
        ↓
Frontend configuration provider
        ↓
Frontend metadata compiler
        ↓
Allowlisted registries
(renderer / editor / formatter / behavior / etc.)
        ↓
Client / Infinite / SSRM grid foundation
        ↓
React + AG Grid
        ↓
Authorized data and actions
```

The central principle is:

> **Business variability and authorization should be declarative and backend-authoritative over time; executable UI mechanics should remain frontend-owned.**

For the detailed technical design, implementation considerations and evolving decisions, use [`metadata-driven-table-architecture.md`](./metadata-driven-table-architecture.md) as the maintained source of truth.
