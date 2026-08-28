import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { NavLink, Navigate, Route, Routes } from 'react-router';
import { TransactionsClientGrid } from '@/features/transactions/grid/TransactionsClientGrid';
import { TransactionsInfiniteGrid } from '@/features/transactions/grid/TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from '@/features/transactions/grid/TransactionsSsrmGrid';

/**
 * Small application shell for comparing the three AG Grid row models.
 *
 * Each URL renders one real grid root. This keeps Client-Side, Infinite and SSRM lifecycle code
 * separate while making it easy to open, refresh, and test each implementation directly in browser.
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

          <Stack direction="row" spacing={1}>
            <Button component={NavLink} to="/client" variant="outlined">
              Client-Side Row Model
            </Button>
            <Button component={NavLink} to="/infinite" variant="outlined">
              Infinite Row Model
            </Button>
            <Button component={NavLink} to="/ssrm" variant="outlined">
              Server-Side Row Model
            </Button>
          </Stack>

          <Routes>
            <Route path="/" element={<Navigate to="/client" replace />} />
            <Route path="/client" element={<TransactionsClientGrid />} />
            <Route path="/infinite" element={<TransactionsInfiniteGrid />} />
            <Route path="/ssrm" element={<TransactionsSsrmGrid />} />
            <Route path="*" element={<Navigate to="/client" replace />} />
          </Routes>
        </Stack>
      </Container>
    </Box>
  );
}
