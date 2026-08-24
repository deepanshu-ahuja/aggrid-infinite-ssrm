import { Box, Container, Stack, Typography } from '@mui/material';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';

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
          <TransactionsPage />
        </Stack>
      </Container>
    </Box>
  );
}
