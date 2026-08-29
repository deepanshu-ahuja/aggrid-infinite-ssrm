import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { NavLink, Navigate, Route, Routes } from 'react-router';
import { TransactionsClientGrid } from '@/features/transactions/grid/TransactionsClientGrid';
import { TransactionsConfigurableSsrmGrid } from '@/features/transactions/grid/TransactionsConfigurableSsrmGrid';
import { TransactionsInfiniteGrid } from '@/features/transactions/grid/TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from '@/features/transactions/grid/TransactionsSsrmGrid';

/**
 * Small application shell for comparing the three proven AG Grid row models plus one isolated
 * configurable SSRM experiment. The experiment is deliberately separate so it cannot silently change
 * the established Client / Infinite / SSRM lifecycle implementations while its boundary is evaluated.
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
              Open each row model on its own URL so its behavior can be tested independently.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={NavLink} to="/client" variant="outlined">
              Client-Side Row Model
            </Button>
            <Button component={NavLink} to="/infinite" variant="outlined">
              Infinite Row Model
            </Button>
            <Button component={NavLink} to="/ssrm" variant="outlined">
              Server-Side Row Model
            </Button>
            <Button component={NavLink} to="/configurable-ssrm" variant="outlined">
              Configurable SSRM Experiment
            </Button>
          </Stack>

          <Routes>
            <Route path="/" element={<Navigate to="/client" replace />} />
            <Route path="/client" element={<TransactionsClientGrid />} />
            <Route path="/infinite" element={<TransactionsInfiniteGrid />} />
            <Route path="/ssrm" element={<TransactionsSsrmGrid />} />
            <Route path="/configurable-ssrm" element={<TransactionsConfigurableSsrmGrid />} />
            <Route path="*" element={<Navigate to="/client" replace />} />
          </Routes>
        </Stack>
      </Container>
    </Box>
  );
}
