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
  // An indeterminate checkbox means an ACTIVE partial selection, not a disabled control. Quartz's
  // neutral default is too close to our disabled-row treatment, so keep the box/border on the same
  // primary-blue visual language as a checked checkbox and render the dash with surface contrast.
  checkboxIndeterminateBackgroundColor: tokens.colors.primary,
  checkboxIndeterminateBorderColor: tokens.colors.primary,
  checkboxIndeterminateShapeColor: tokens.colors.surface,
  fontFamily: tokens.typography.fontFamily,
  borderRadius: tokens.radius.small,
  spacing: tokens.spacing.grid,
  headerHeight: 44,
  rowHeight: 46,
});
