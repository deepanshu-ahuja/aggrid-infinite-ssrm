import {
  forwardRef,
  useMemo,
  type ForwardedRef,
  type ReactElement,
  type RefAttributes,
} from 'react';
import type { ColDef } from 'ag-grid-community';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import { appAgGridTheme } from '@/theme/ag-grid/agGridTheme';
import { baseDefaultColDef } from './config/defaultColDef';

export type AppGridProps<TData> = AgGridReactProps<TData>;

function AppGridInner<TData>(
  { defaultColDef, theme, ...nativeGridProps }: AppGridProps<TData>,
  ref: ForwardedRef<AgGridReact<TData>>,
) {
  const mergedDefaultColDef = useMemo<ColDef<TData>>(
    () => ({
      ...baseDefaultColDef,
      ...defaultColDef,
    }),
    [defaultColDef],
  );

  // This layer supplies application defaults but deliberately leaves AG Grid's native prop,
  // event and ref surface intact. Recreating those APIs here would make upgrades harder.
  return (
    <AgGridReact<TData>
      ref={ref}
      {...nativeGridProps}
      theme={theme ?? appAgGridTheme}
      defaultColDef={mergedDefaultColDef}
    />
  );
}

export const AppGrid = forwardRef(AppGridInner) as <TData>(
  props: AppGridProps<TData> & RefAttributes<AgGridReact<TData>>,
) => ReactElement;
