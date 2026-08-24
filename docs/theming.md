# Theming and Design Tokens

`frontend/src/theme/tokens.ts` is the small, library-neutral source for shared colors, typography, radii and spacing. Both UI libraries adapt those values:

- `theme/mui/muiTheme.ts` builds the MUI theme.
- `theme/mui/componentOverrides.ts` contains global MUI component behavior and visual defaults.
- `theme/ag-grid/agGridTheme.ts` builds the AG Grid theme using the current Theme API.

A global visual or UX change belongs in tokens or the relevant library adapter. Feature-specific styling stays with the feature. Do not add a token for every literal pre-emptively; add one when a value represents a deliberate shared design decision.

MUI remains the application layout/component system, and AG Grid remains the data-grid system. The neutral token layer coordinates their appearance without making either theme depend on the other.
