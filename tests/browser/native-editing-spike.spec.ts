import { expect, test } from './fixtures';
import { SEEDED_ROWS, expectNoPageErrors, rowById } from './gridTestSupport';

const ROUTE = '/ssrm-native-editing';

async function openNativeEditingSpike(page: Parameters<typeof test>[0] extends never ? never : any) {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error: Error) => pageErrors.push(error));

  const initialData = page.waitForResponse(
    (response: any) =>
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

test('SSRM native editing spike saves only selected dirty rows', async ({ page }) => {
  const pageErrors = await openNativeEditingSpike(page);
  const row = rowById(page, SEEDED_ROWS.enabled);
  const accountCell = row.locator('.ag-cell[col-id="account"]');

  await accountCell.dblclick();
  const input = page.getByTestId('transaction-native-account-editor-input');
  await expect(input).toBeVisible();
  await input.fill('Native spike');
  await input.press('Enter');

  await expect(accountCell).toHaveText('Native spike');
  await expect(accountCell).toHaveClass(/grid-cell--draft-dirty/);
  await expect(page.getByText(/1 row edited total; 0 selected; 1 cell changed/)).toBeVisible();

  await row.getByRole('checkbox').first().click();
  await expect(page.getByText(/1 row edited total; 1 selected; 1 cell changed/)).toBeVisible();

  const bulkRequest = page.waitForRequest(
    (request) => request.method() === 'PATCH' && request.url().endsWith('/api/transactions/bulk/'),
  );
  const bulkResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/transactions/bulk/') &&
      response.ok(),
  );

  await page.getByRole('button', { name: 'Save selected edits (1)', exact: true }).click();
  const request = await bulkRequest;
  expect(request.postDataJSON()).toEqual({
    updates: [{ id: SEEDED_ROWS.enabled, changes: { account: 'Native spike' } }],
  });
  await bulkResponse;

  await expect(page.getByText(/0 rows edited total; 0 selected; 0 cells changed/)).toBeVisible();
  await expectNoPageErrors(pageErrors, 'SSRM native editing selected dirty save');
});

test('SSRM native custom editor uses AG Grid validation to block invalid commit', async ({ page }) => {
  const pageErrors = await openNativeEditingSpike(page);
  const accountCell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
  const originalValue = await accountCell.innerText();

  await accountCell.dblclick();
  const input = page.getByTestId('transaction-native-account-editor-input');
  await expect(input).toBeVisible();
  await input.fill('');
  await input.press('Enter');

  // `invalidEditValueMode="block"` keeps the invalid custom editor active instead of committing it.
  await expect(input).toBeVisible();
  await input.fill(originalValue);
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await expect(accountCell).toHaveText(originalValue);
  await expect(page.getByText(/0 rows edited total; 0 selected; 0 cells changed/)).toBeVisible();
  await expectNoPageErrors(pageErrors, 'SSRM native editing custom validation');
});
