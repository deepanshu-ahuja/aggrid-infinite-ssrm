import { expect, test } from './fixtures';
import {
  SEEDED_ROWS,
  expectNoPageErrors,
  openGrid,
  rowById,
  routes,
  waitForAuthoritativeDataResponse,
  type Route,
} from './gridTestSupport';

const stateKeyByRoute: Record<Route, string> = {
  '/client': 'ag-grid-state:transactions:client',
  '/infinite': 'ag-grid-state:transactions:infinite',
  '/ssrm': 'ag-grid-state:transactions:ssrm',
};

for (const route of routes) {
  test(`${route}: sort preference persists across remount while business selection remains transient`, async ({
    page,
  }) => {
    const pageErrors = await openGrid(page, route);

    await rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first().click();
    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();

    const amountHeader = page.locator('.ag-header-cell[col-id="amount"]');
    await amountHeader.click();
    await expect(amountHeader).toHaveAttribute('aria-sort', 'ascending');

    // Wait for the actual persisted native Grid State instead of assuming the stateUpdated event has
    // reached localStorage before navigation/reload.
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return undefined;
          const state = JSON.parse(raw) as { sort?: { sortModel?: Array<{ colId: string; sort: string }> } };
          return state.sort?.sortModel?.find((item) => item.colId === 'amount')?.sort;
        }, stateKeyByRoute[route]),
      )
      .toBe('asc');

    const reloadedRows = waitForAuthoritativeDataResponse(page, route);
    await page.reload();
    await reloadedRows;

    const restoredAmountHeader = page.locator('.ag-header-cell[col-id="amount"]');
    await expect(restoredAmountHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(rowById(page, SEEDED_ROWS.enabled)).toBeVisible();
    // Row selection is deliberate transient business state and is filtered out of persisted Grid State.
    await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Grid State persistence`);
  });
}
