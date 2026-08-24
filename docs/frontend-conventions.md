# Frontend Conventions

## Ownership

Place feature behavior under `frontend/src/features/<feature>`. This includes columns, feature renderers, API contracts, request mapping and screen-specific grid options. Promote code into `shared` only after it is library-level infrastructure or has demonstrated reuse across features.

Use MUI components directly. Shared components should represent an application concept or repeated behavior, not aliases that hide `Box`, `Stack`, `Typography` or other MUI primitives.

## React and TypeScript

- Prefer props, ordinary functions and local state before creating a custom hook.
- Keep server communication outside render components. Components compose a datasource with a feature API loader.
- Preserve precise row types through `AppGrid<TData>` and typed column definitions.
- Keep environment access at integration points such as the Enterprise license initializer.
- Comment architectural reasons, non-obvious translations and lifecycle behavior; do not narrate syntax.

## Testing

Prioritize stable boundaries: request mappers, datasource callback behavior, API validation and business transformations. Test feature screens when they gain user interaction or state beyond straightforward library composition. Avoid snapshots of third-party component markup.
