import { Box, Container, Stack, Typography } from '@mui/material';
import { TransactionsInfiniteGrid } from '@/features/transactions/grid/TransactionsInfiniteGrid';

/**
 * Application shell only.
 *
 * The row-model root is intentionally imported directly. To evaluate SSRM instead, replace this
 * import/render with `TransactionsSsrmGrid`; there is no common Transactions page that owns grid
 * lifecycle or GridApi state.
 */
export function App() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4" fontWeight={700}>
              Transactions
            </Typography>
            <Typography color="text.secondary">
              Server-backed transaction activity with consistent application theming.
            </Typography>
          </Box>

          <TransactionsInfiniteGrid />
        </Stack>
      </Container>
    </Box>
  );
}
