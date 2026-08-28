# Frontend Conventions

## Ownership

Place feature behavior under `frontend/src/features/<feature>`. This includes domain rows, columns, feature renderers, API contracts, field/request mapping, business actions, business validation and screen-specific choices.

Promote code into `shared` when it is genuinely domain-neutral application/grid infrastructure. A second feature does not have to exist first when the capability is already inherently generic (for example stable include/exclude selection semantics or a row-model datasource adapter), but do not generalize merely because future reuse is imaginable.

For every new grid concern, ask both questions:

```text
Would another application table need this for the same reason?
Does this code know anything about the current domain's fields/actions/API meaning?
```

If the first answer is yes and the second is no, it is a strong candidate for `shared/grid`. If the code needs Transaction/Payable/etc. fields, endpoint semantics, action names or validation, keep it feature-owned.

Use MUI components directly. Shared components should represent an application concept or repeated behavior, not aliases that hide `Box`, `Stack`, `Typography` or other MUI primitives.

For AG Grid code, distinguish reusable capability mechanics from feature semantics:

- keep concrete `AgGridReact` rendering and the authoritative `GridApi` ref visible in the owning grid root;
- put row-model-independent mechanics such as tracked-edit state, current-page target resolution, generic selection-action targets and Grid State persistence wiring in `shared/grid`;
- keep row-model-specific mechanics under the relevant shared Client-Side/Infinite/SSRM area when they are genuinely reusable across features;
- keep Client-Side, Infinite and SSRM implementations separate when their native lifecycle/capabilities differ; sharing a semantic helper does not require sharing one controller/root;
- keep feature fields, validation, API requests, filter/request mapping, business action payloads and feature UI under the feature;
- do not replace a large component with one giant `useGrid(...)` hook that merely hides AG Grid lifecycle behind another abstraction.

A useful ownership test is: if replacing `Transaction` with another row type only requires supplying row identity, editable fields, a loader, translated filters or an action payload, the underlying mechanic is probably reusable grid infrastructure. If the actual business semantics or backend contract change, keep that part feature-owned.

### Server-backed selection/action boundary

Logical selection is reusable grid behavior:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

The generic action target should express only information the backend actually needs:

```text
include + ids
-> exact ids

exclude + translated filters
-> filtered dataset minus exception ids

exclude without filters
-> all records minus exception ids
```

Do not serialize redundant UI history such as `scope: page | filtered | all` when `mode + ids + filters` already defines the server target.

The frontend may still need row-model-specific internal context while constructing that request. Infinite and SSRM can reach the same logical target through different native/custom selection mechanisms; preserve those differences instead of forcing one implementation.

Client-Side can enumerate exact selected IDs because the complete bounded working set is local. It may reuse the same backend selected-operation contract with `include + ids` without importing server dataset-wide exclude state.

Feature filter translation remains feature-owned and must be reused consistently between normal server row loading and Select All Filtered actions.

### Abstraction threshold

Do not extract a file, hook, helper or feature wrapper merely because two callers repeat a few lines. Duplication is preferable when the extracted layer would only forward arguments or compose existing functions without adding a meaningful responsibility.

An abstraction should normally earn its existence by owning at least one real concern such as:

- state or lifecycle;
- validation or normalization;
- business/domain policy;
- third-party API adaptation;
- error/retry/cancellation behavior;
- a non-trivial algorithm or behavioral contract;
- a stable boundary that deliberately hides an implementation detail from several consumers.

Avoid pass-through patterns such as `useFeatureX()` calling `useSharedX()` unchanged, a `loadFeatureRows.ts` file that only calls an existing mapper and API function, or a component that merely renames/forwards third-party props. Re-evaluate small duplication before introducing another named concept, import path, test surface or lifecycle boundary.

Shared mechanics and concrete feature composition are different things: a reusable datasource/loading hook may own AG Grid request lifecycle, cancellation and retry behavior, while a concrete feature root can still directly compose `mapFeatureRequest(...)` with `listFeatureRecords(...)` when that composition adds no behavior of its own.

## Capability markers (`GRIDCAP-*`)

This repository is a reference implementation, so code discoverability is an explicit engineering concern. A future developer may want to extract one capability without remembering every hook, event handler, request mapper, backend resolver, and test that participates in it.

`docs/grid-capability-tags.md` is the authoritative registry for searchable capability markers.

Rules:

- every marker starts with the exact prefix `GRIDCAP-`;
- **do not invent an ad-hoc marker in source**; define a genuinely new capability in the registry first;
- use one logical marker across Client-Side, Infinite, SSRM, frontend, backend, and tests when the user/business capability is the same but implementation differs;
- multiple markers are allowed on one location when one shared boundary supports several capabilities;
- mark extraction-relevant boundaries: concrete roots, controllers, shared algorithms, event/lifecycle boundaries, request/response mapping, backend authority, and focused tests;
- do not tag every obvious helper/statement; a repository search should return a useful dependency/extraction map, not comment noise;
- a tag means **participates in this capability**, not **copy this implementation into every row model**;
- preserve applicable markers during refactors just like useful rationale comments;
- when a capability changes materially, search its existing marker occurrences and review all affected touchpoints before declaring the change complete;
- avoid casual marker renames because stable searchability across Git history is part of their value.

Example shared boundary:

```ts
// GRIDCAP-PAGINATION | GRIDCAP-SEL-PAGE | GRIDCAP-EDIT-PAGE-APPLY | GRIDCAP-EXPORT-PAGE
```

That does not mean pagination and export are one feature. It means this boundary participates in all four capability paths and should be considered when extracting or changing any one of them.

A developer extracting a capability should:

```text
1. Find the tag in docs/grid-capability-tags.md.
2. Read its row-model/ownership notes.
3. Search the exact tag across the repository.
4. Review every marked production/test boundary and linked detailed docs.
5. Adapt only the row-model implementation relevant to the target project.
```

## React and TypeScript

- Prefer props, ordinary functions and local state before creating a custom hook.
- Keep server communication outside render components. Components may compose a datasource/loading capability with feature API and request-mapping functions; do not create an otherwise empty feature loader module solely to avoid a few repeated lines.
- Render and type `AgGridReact<TData>` directly; do not introduce a wrapper merely to forward native AG Grid props, refs or defaults.
- Prefer native AG Grid state/APIs over parallel React state when AG Grid already owns the behavior.
- Keep environment access at integration points such as the Enterprise license initializer.
- Runtime-only diagnostics/debugging should be isolated behind a clearly named dev-only integration point when they form one real concern. Production behavior must not depend on dev-tool state, and removing the tooling should require minimal production-code changes.
- Dev Tools may render or snapshot production results, but must not own reusable algorithms for selection membership, edited-row intersection, current-page targeting, GridApi reads or backend-facing payload construction. Real UI actions must be able to use the same production-capable helpers without importing dev tooling.

## Comments and JSDoc

Comments should explain ownership, lifecycle, constraints and non-obvious decisions; they should not translate TypeScript syntax into English.

**Preserve useful explanatory comments by default.** Refactoring or adding a feature is not a reason to shorten/remove existing rationale merely to make a file look cleaner. Remove or rewrite an existing comment only when the underlying logic/contract changed, the comment became inaccurate, or the same explanation is genuinely duplicated without adding local clarity. If removing it would make ownership, lifecycle, business rules, race handling, capability discoverability, or future maintenance harder to understand, keep it and add the new logic-level explanation beside it.

Capability marker comments are not ordinary prose comments. Preserve an accurate `GRIDCAP-*` marker during refactors; update/remove it only when the integration point no longer participates in that registered capability.

For meaningful React state, refs, effects, memoized values and callbacks, document the rationale when it is not obvious from the name alone. A useful comment answers the relevant questions:

- what the value represents;
- why it is React state, a ref, or a derived value;
- who updates it and from which lifecycle/API source;
- what consumes it;
- when it resets or deliberately survives;
- how it differs from nearby state that looks similar;
- what race condition, ownership boundary or third-party lifecycle rule makes the implementation necessary.

For async request-order logic, comment the actual freshness rule near the code that enforces it. For example, if request A starts and request B starts later, B owns renderable metadata; A may resolve afterwards for the library lifecycle but must not overwrite B. The rule must be described in terms of request order rather than assuming higher/lower page numbers, so it remains correct for both forward and backward navigation.

For server-backed grids, comments should also explain non-obvious cache/refresh behavior when it can surprise a developer. For example, `refreshInfiniteCache()` refreshes currently resident Infinite blocks; it does not enumerate or load every backend block affected by a dataset-wide business action.

Do not add noise such as `// set the error` above `setError(...)` or `// return the result` above a return statement. The goal is to make architectural intent recoverable by another developer or coding agent without narrating obvious code.

## Testing

Prioritize stable boundaries: request mappers, datasource callback behavior, selection/action target construction, API validation and business transformations. Test feature screens when they gain user interaction or state beyond straightforward library composition. Avoid snapshots of third-party component markup.

Test Client-Side, Infinite and SSRM lifecycle wiring independently when their behavior differs. Share tests only for genuinely shared semantic helpers; do not create a fake common row-model behavior merely to reduce test duplication.

When a capability footprint changes, reuse the same `GRIDCAP-*` marker in focused tests where doing so helps a future developer find the executable contract alongside the implementation.
