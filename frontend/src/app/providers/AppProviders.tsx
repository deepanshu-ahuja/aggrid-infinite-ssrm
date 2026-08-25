import type { PropsWithChildren } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { provideGlobalGridOptions } from 'ag-grid-community';
import { AgGridProvider } from 'ag-grid-react';
import { baseDefaultColDef } from '@/shared/grid/config/defaultColDef';
import { configureAgGridEnterpriseLicense } from '@/shared/grid/enterpriseLicense';
import { gridModules } from '@/shared/grid/gridModules';
import { queryClient } from '@/shared/query/queryClient';
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
 * TODAY we intentionally keep the global surface very small:
 * - `theme`: the shared application AG Grid theme;
 * - `defaultColDef`: boring column defaults that every grid should inherit.
 *
 * Row-model behavior, datasources, pagination/cache tuning, selection, getRowId and lifecycle events
 * remain visible on the owning feature grid.
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <AgGridProvider modules={gridModules}>{children}</AgGridProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
