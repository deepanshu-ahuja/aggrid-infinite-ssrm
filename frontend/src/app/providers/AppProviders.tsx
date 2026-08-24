import type { PropsWithChildren } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { provideGlobalGridOptions } from 'ag-grid-community';
import { AgGridProvider } from 'ag-grid-react';
import { baseDefaultColDef } from '@/shared/grid/config/defaultColDef';
import { configureAgGridEnterpriseLicense } from '@/shared/grid/enterpriseLicense';
import { gridModules } from '@/shared/grid/gridModules';
import { appAgGridTheme } from '@/theme/ag-grid/agGridTheme';
import { muiTheme } from '@/theme/mui/muiTheme';

configureAgGridEnterpriseLicense();

/**
 * Shared AG Grid defaults belong to AG Grid itself rather than a React wrapper component.
 *
 * `provideGlobalGridOptions` is AG Grid's native application-wide configuration mechanism. Local
 * grid props still take precedence, while the `deep` merge keeps a feature-level `defaultColDef`
 * override from accidentally discarding unrelated application defaults.
 *
 * Keeping this next to module/license setup gives the application one visible AG Grid bootstrap
 * boundary without hiding the native `AgGridReact` component from feature code.
 */
provideGlobalGridOptions(
  {
    theme: appAgGridTheme,
    defaultColDef: baseDefaultColDef,
  },
  'deep',
);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AgGridProvider modules={gridModules}>{children}</AgGridProvider>
    </ThemeProvider>
  );
}
