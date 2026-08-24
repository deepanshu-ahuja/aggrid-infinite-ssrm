import type { PropsWithChildren } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AgGridProvider } from 'ag-grid-react';
import { configureAgGridEnterpriseLicense } from '@/shared/grid/enterpriseLicense';
import { gridModules } from '@/shared/grid/gridModules';
import { muiTheme } from '@/theme/mui/muiTheme';

configureAgGridEnterpriseLicense();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AgGridProvider modules={gridModules}>{children}</AgGridProvider>
    </ThemeProvider>
  );
}
