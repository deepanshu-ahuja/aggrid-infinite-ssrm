// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-QUERY-SORT
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { SEEDED_ROWS, expectNoPageErrors, rowById } from './gridTestSupport';

const ROUTE = '/configurable-ssrm';

async function openConfigurableSsrm(page: Page) {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  const initialData = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/transactions/query/') &&
      response.ok(),
  );

  await page.goto(ROUTE);
  await initialData;
  await expect(page.locator('.ag-root')).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.enabled)).toBeVisible();

  return pageErrors;
}

test('configurable SSRM compiles metadata into native server sort mapping', async ({ page }) => {
  const pageErrors = await openConfigurableSsrm(page);

  const sortedRequest = page.waitForRequest((request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/api/transactions/query/')) return false;
    const payload = request.postDataJSON() as { sort?: Array<{ field?: string; direction?: string }> };
    return payload.sort?.[0]?.field === 'amount' && payload.sort[0]?.direction === 'asc';
  });

  await page.getByRole('columnheader', { name: /Amount/ }).click();
  await sortedRequest;
  await expectNoPageErrors(pageErrors, 'configurable SSRM native server sort');
});

test('configurable SSRM uses native validation before recording BASE + LOCAL draft state', async ({ page }) => {
  const pageErrors = await openConfigurableSsrm(page);
  const accountCell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');

  await accountCell.dblclick();
  const input = page.locator('.ag-cell-inline-editing input');
  await expect(input).toBeVisible();

  await input.fill('');
  await input.press('Enter');
  await expect(input).toBeVisible();
  await expect(page.getByText(/0 rows edited; 0 cells changed locally/)).toBeVisible();

  await input.fill('Configured account');
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await expect(accountCell).toHaveText('Configured account');
  await expect(page.getByText(/1 row edited; 1 cell changed locally/)).toBeVisible();
  await expectNoPageErrors(pageErrors, 'configurable SSRM native validation and draft tracking');
});
