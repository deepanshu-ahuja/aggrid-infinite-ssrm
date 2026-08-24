import { createTheme } from '@mui/material/styles';
import { tokens } from '@/theme/tokens';
import { muiComponentOverrides } from './componentOverrides';

export const muiTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: tokens.colors.primary,
      dark: tokens.colors.primaryDark,
    },
    background: {
      default: tokens.colors.background,
      paper: tokens.colors.surface,
    },
    text: {
      primary: tokens.colors.textPrimary,
      secondary: tokens.colors.textSecondary,
    },
    divider: tokens.colors.border,
    success: { main: tokens.colors.success },
    warning: { main: tokens.colors.warning },
    error: { main: tokens.colors.error },
  },
  typography: {
    fontFamily: tokens.typography.fontFamily,
  },
  shape: {
    borderRadius: tokens.radius.medium,
  },
  components: muiComponentOverrides,
});
