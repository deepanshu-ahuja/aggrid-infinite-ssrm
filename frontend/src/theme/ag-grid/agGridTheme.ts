// GRIDCAP-THEME
import { themeQuartz } from 'ag-grid-community';
import { tokens } from '@/theme/tokens';

// AG Grid and MUI deliberately consume the same library-neutral tokens. UX changes therefore
// remain centralized without making either library's theme the source of truth for the other.
export const appAgGridTheme = themeQuartz.withParams({
  accentColor: tokens.colors.primary,
  backgroundColor: tokens.colors.surface,
  foregroundColor: tokens.colors.textPrimary,
  headerBackgroundColor: tokens.colors.background,
  borderColor: tokens.colors.border,
  // TEMP DIAGNOSTIC: leave AG Grid's indeterminate checkbox colours at their Quartz defaults.
  // This lets us prove whether the grey header dash comes from AG Grid or our row-restriction CSS.
  // checkboxIndeterminateBackgroundColor: tokens.colors.primary,
  // checkboxIndeterminateBorderColor: tokens.colors.primary,
  // checkboxIndeterminateShapeColor: tokens.colors.surface,
  fontFamily: tokens.typography.fontFamily,
  borderRadius: tokens.radius.small,
  spacing: tokens.spacing.grid,
  headerHeight: 44,
  rowHeight: 46,
});
