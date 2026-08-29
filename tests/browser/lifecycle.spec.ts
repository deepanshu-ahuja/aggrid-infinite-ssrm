import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  SEEDED_ROWS,
  accountEditorInput,
  expectNoPageErrors,
  openGrid,
  rowById,
  routes,
  waitForAuthoritativeDataResponse,
  type Route,
} from './gridTestSupport';

async function editFirstAccount(page: Page, value: string) {
  const cell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
  await cell.dblclick();
  const input = accountEditorInput(page);
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.press('Enter');
  await expect(cell).toHaveText(value);
}

async function refreshThroughSelectedAction(page: Page, route: Route) {
  await rowById(page, SEEDED_ROWS.secondEnabled).getByRole('checkbox').first().click();
  const actionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/transactions/selection/') &&
      response.ok(),
  );
  const refreshedRows = waitForAuthoritativeDataResponse(page, route);
  await page.getByRole('button', { name: 'Mark Pending', exact: true }).click();
  await actionResponse;
  await refreshedRows;
}

for (const route of routes) {
  test(`${route}: unchanged REMOTE refresh preserves an unsaved LOCAL Account without conflict`, async ({
    page,
  }) => {
    const pageErrors = await openGrid(page, route);
    const localValue = `LOCAL survives ${route.slice(1)}`;

    await editFirstAccount(page, localValue);
    await refreshThroughSelectedAction(page, route);

    const cell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
    await expect(cell).toHaveText(localValue);
    await expect(cell).not.toHaveClass(/grid-cell--edit-conflict/);
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(/1 row edited total; 0 selected/)).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} unchanged REMOTE LOCAL preservation`);
  });
}

test('/infinite: LOCAL edit survives cache-block eviction and recreated RowNode', async ({ page }) => {
  const pageErrors = await openGrid(page, '/infinite');
  const localValue = 'LOCAL survives cache eviction';
  await editFirstAccount(page, localValue);

  const nextPage = page.getByLabel('Next Page', { exact: true });
  for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
    await nextPage.click();
    const firstRowId = `txn-${String(pageNumber * 25 + 1).padStart(5, '0')}`;
    await expect(rowById(page, firstRowId)).toBeVisible();
  }

  await expect(rowById(page, 'txn-00251')).toBeVisible();

  // Six distinct 50-row blocks have now been required with maxBlocksInCache=5. Returning to page one
  // should request offset 0 again, proving block zero was evicted/recreated rather than merely hidden.
  const reloadedFirstBlock = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST' || !response.url().endsWith('/api/transactions/query/')) {
      return false;
    }
    const body = response.request().postDataJSON() as { offset?: number };
    return body.offset === 0 && response.ok();
  });

  await page.getByLabel('First Page', { exact: true }).click();
  await reloadedFirstBlock;

  const recreatedAccount = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
  await expect(recreatedAccount).toBeVisible();
  await expect(recreatedAccount).toHaveText(localValue);
  await expect(recreatedAccount).not.toHaveClass(/grid-cell--edit-conflict/);
  await expect(
    rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
  ).toBeEnabled();

  await expectNoPageErrors(pageErrors, '/infinite cache eviction LOCAL restoration');
});
