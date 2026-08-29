// GRIDCAP-IMPORT
import { expect, test } from './fixtures';
import { expectNoPageErrors, openGrid, rowById, routes, SEEDED_ROWS, waitForAuthoritativeDataResponse } from './gridTestSupport';

for (const route of routes) {
  test(`${route}: Import preview applies atomically and refreshes authoritative rows`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const importedAccount = `Imported ${route.slice(1)}`;

    await page.getByRole('button', { name: 'Import CSV' }).click();
    await page.getByTestId('transaction-import-file').setInputFiles({
      name: 'transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`id,account\n${SEEDED_ROWS.enabled},${importedAccount}\n`),
    });

    const previewResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/transactions/import/preview/') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect((await previewResponse).ok()).toBeTruthy();
    await expect(page.getByText('1 row ready to apply.')).toBeVisible();

    const applyResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/transactions/import/apply/') &&
        response.request().method() === 'POST',
    );
    const authoritativeRefresh = waitForAuthoritativeDataResponse(page, route);
    await page.getByRole('button', { name: 'Apply import' }).click();
    await expect((await applyResponse).ok()).toBeTruthy();
    await authoritativeRefresh;

    const importedRow = rowById(page, SEEDED_ROWS.enabled);
    await expect(importedRow.locator('.ag-cell[col-id="account"]')).toHaveText(importedAccount);
    await expect(page.getByText('Imported 1 transaction.')).toBeVisible();
    await expectNoPageErrors(pageErrors, `${route} Import`);
  });
}
