# Frontend Conventions

## Ownership

Place feature behavior under `frontend/src/features/<feature>`. This includes columns, feature renderers, API contracts, request mapping and screen-specific grid options. Promote code into `shared` only after it is library-level infrastructure or has demonstrated reuse across features.

Use MUI components directly. Shared components should represent an application concept or repeated behavior, not aliases that hide `Box`, `Stack`, `Typography` or other MUI primitives.

## React and TypeScript

- Prefer props, ordinary functions and local state before creating a custom hook.
- Keep server communication outside render components. Components compose a datasource with a feature API loader.
- Render and type `AgGridReact<TData>` directly; do not introduce a wrapper merely to forward native AG Grid props, refs or defaults.
- Prefer native AG Grid state/APIs over parallel React state when AG Grid already owns the behavior.
- Keep environment access at integration points such as the Enterprise license initializer.
- Runtime-only diagnostics/debugging should be isolated behind a clearly named dev-only integration point when they form one real concern. Production behavior must not depend on dev-tool state, and removing the tooling should require minimal production-code changes.

## Comments and JSDoc

Comments should explain ownership, lifecycle, constraints and non-obvious decisions; they should not translate TypeScript syntax into English.

For meaningful React state, refs, effects, memoized values and callbacks, document the rationale when it is not obvious from the name alone. A useful comment answers the relevant questions:

- what the value represents;
- why it is React state, a ref, or a derived value;
- who updates it and from which lifecycle/API source;
- what consumes it;
- when it resets or deliberately survives;
- how it differs from nearby state that looks similar;
- what race condition, ownership boundary or third-party lifecycle rule makes the implementation necessary.

Do not add noise such as `// set the error` above `setError(...)` or `// return the result` above a return statement. The goal is to make architectural intent recoverable by another developer or coding agent without narrating obvious code.

## Testing

Prioritize stable boundaries: request mappers, datasource callback behavior, API validation and business transformations. Test feature screens when they gain user interaction or state beyond straightforward library composition. Avoid snapshots of third-party component markup.
