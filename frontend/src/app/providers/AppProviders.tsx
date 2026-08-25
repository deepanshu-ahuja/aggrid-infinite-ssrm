import type { PropsWithChildren } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { provideGlobalGridOptions } from 'ag-grid-community';
import { AgGridProvider } from 'ag-grid-react';
import { baseDefaultColDef } from '@/shared/grid/config/defaultColDef';
import { configureAgGridEnterpriseLicense } from '@/shared/grid/enterpriseLicense';
import { gridModules } from '@/shared/grid/gridModules';
import { appAgGridTheme } from '@/theme/ag-grid/agGridTheme';
import { muiTheme } from '@/theme/mui/muiTheme';

configureAgGridEnterpriseLicense();

/**
 * One application QueryClient owns normal server-state query/mutation lifecycle.
 *
 * AG Grid Infinite/SSRM row loading deliberately does NOT use TanStack Query: those row models already
 * own when blocks are requested, cached, retried and refreshed. TanStack Query is used for application
 * mutations such as Transaction Save/Bulk Save where loading/error/success state belongs to React UI.
 */
const queryClient = new QueryClient();

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
 * If more behaviour later becomes genuinely application-wide, other native GridOptions can also be
 * configured here. Examples could include shared `localeText`, tooltip timing such as
 * `tooltipShowDelay`, or a consistent context-menu policy such as `suppressContextMenu`.
 *
 * Do not move an option here merely because two grids currently share it. Row-model and feature
 * behaviour such as `rowModelType`, datasource/serverSideDatasource, pagination/cache tuning,
 * selection configuration, `getRowId`, and lifecycle/event callbacks should stay visible on the
 * owning feature grid unless we establish a real application-wide rule.
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <AgGridProvider modules={gridModules}>{children}</AgGridProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
