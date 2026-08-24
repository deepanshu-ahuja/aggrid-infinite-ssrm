import { Button, Stack, Typography } from '@mui/material';

/**
 * Extra parameters supplied to the shared grid error overlay through AG Grid's
 * `activeOverlayParams` option.
 *
 * AG Grid also supplies its own overlay parameters at runtime. This interface intentionally
 * describes only the application-owned values that this component actually consumes.
 */
export interface GridErrorOverlayParams {
  /**
   * Human-readable explanation of what failed.
   *
   * Keep this message actionable and user-facing. Technical error details belong in application
   * logging/telemetry rather than in the grid overlay.
   */
  message: string;

  /**
   * Optional recovery action.
   *
   * Retry semantics belong to the row model using the overlay:
   * - Infinite Row Model can refresh/purge its cache;
   * - Server-Side Row Model can retry failed server-side loads.
   *
   * The visual component deliberately does not know which AG Grid API should be called.
   */
  onRetry?: () => void;

  /**
   * Optional button copy for cases where "Retry" is not the clearest recovery action.
   */
  retryLabel?: string;
}

/**
 * Shared application error UI rendered *inside* AG Grid as an Active Overlay.
 *
 * WHY THIS EXISTS
 * ----------------
 * AG Grid already owns normal grid states such as loading, no rows, and no matching rows. We should
 * use those built-in states instead of recreating them with React/MUI UI around the grid.
 *
 * A datasource/network error is different: AG Grid knows that a datasource request failed, but the
 * application owns the user-facing error message and recovery action. AG Grid's Active Overlay lets
 * us present that application state within the grid surface without pretending that an error means
 * "no rows".
 *
 * This component is intentionally presentation-only. It MUST NOT:
 * - fetch data;
 * - call `refreshInfiniteCache()`;
 * - call `retryServerSideLoads()`;
 * - know about Transactions or any other feature;
 * - keep its own loading/error state.
 *
 * The grid implementation supplies the appropriate `onRetry` callback through
 * `activeOverlayParams`.
 *
 * @example
 * ```tsx
 * <AgGridReact
 *   activeOverlay={error ? GridErrorOverlay : undefined}
 *   activeOverlayParams={{
 *     message: error,
 *     onRetry: handleRetry,
 *   }}
 * />
 * ```
 */
export function GridErrorOverlay({
  message,
  onRetry,
  retryLabel = 'Retry',
}: GridErrorOverlayParams) {
  return (
    <Stack
      role="alert"
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={{
        maxWidth: 420,
        px: 3,
        py: 2.5,
        textAlign: 'center',
      }}
    >
      <Typography variant="subtitle1" component="div" fontWeight={600}>
        Unable to load data
      </Typography>

      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>

      {onRetry && (
        <Button type="button" variant="outlined" size="small" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </Stack>
  );
}
