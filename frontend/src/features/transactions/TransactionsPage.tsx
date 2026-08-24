import { Card, CardContent, Stack, Typography } from '@mui/material';
import { TransactionsInfiniteGrid } from './grid/TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from './grid/TransactionsSsrmGrid';
import { transactionsGridConfig } from './transactionsGrid.config';

export function TransactionsPage() {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="h6">Transaction activity</Typography>
            <Typography variant="body2" color="text.secondary">
              Sorting and filtering are executed by the Django API.
            </Typography>
          </div>
          {/* These are separate tables. The client configuration chooses one; there is no tab,
              toggle, or combined Infinite/SSRM component in the application UI. */}
          {transactionsGridConfig.activeGrid === 'infinite' ? (
            <TransactionsInfiniteGrid
              key={`infinite-${transactionsGridConfig.infinite.selectionScope}`}
              {...transactionsGridConfig.infinite}
            />
          ) : (
            <TransactionsSsrmGrid key="ssrm" {...transactionsGridConfig.ssrm} />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
