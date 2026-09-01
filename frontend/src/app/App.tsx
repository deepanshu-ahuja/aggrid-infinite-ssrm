import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { NavLink, Navigate, Route, Routes } from 'react-router';
import { ReviewConfigurableSsrmFeature } from '@/features/review/ReviewConfigurableSsrmFeature';
import { TransactionsClientGrid } from '@/features/transactions/grid/TransactionsClientGrid';
import { TransactionsInfiniteGrid } from '@/features/transactions/grid/TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from '@/features/transactions/grid/TransactionsSsrmGrid';
import { TransactionsSsrmNativeEditingGrid } from '@/features/transactions/grid/TransactionsSsrmNativeEditingGrid';

/** Small application shell for comparing the row models and isolated experiments. */
export function App() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4" fontWeight={700}>
              AG Grid foundation
            </Typography>
            <Typography color="text.secondary">
              Open each row model or isolated experiment on its own URL so behavior can be tested independently.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button component={NavLink} to="/client" variant="outlined">Client-Side Row Model</Button>
            <Button component={NavLink} to="/infinite" variant="outlined">Infinite Row Model</Button>
            <Button component={NavLink} to="/ssrm" variant="outlined">Server-Side Row Model</Button>
            <Button component={NavLink} to="/ssrm-native-editing" variant="outlined">SSRM Native Editing Spike</Button>
            <Button component={NavLink} to="/configurable-ssrm" variant="outlined">Configurable Review SSRM</Button>
          </Stack>

          <Routes>
            <Route path="/" element={<Navigate to="/client" replace />} />
            <Route path="/client" element={<TransactionsClientGrid />} />
            <Route path="/infinite" element={<TransactionsInfiniteGrid />} />
            <Route path="/ssrm" element={<TransactionsSsrmGrid />} />
            <Route path="/ssrm-native-editing" element={<TransactionsSsrmNativeEditingGrid />} />
            <Route path="/configurable-ssrm" element={<ReviewConfigurableSsrmFeature />} />
            <Route path="*" element={<Navigate to="/client" replace />} />
          </Routes>
        </Stack>
      </Container>
    </Box>
  );
}
