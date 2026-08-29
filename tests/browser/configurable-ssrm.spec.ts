import { expect, test } from './fixtures';
import { expectNoPageErrors, rowById, SEEDED_ROWS } from './gridTestSupport';
import { readQueryBody } from './serverQueryTestSupport';

test('/configurable-ssrm: metadata compiles into a real SSRM query surface', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  const initialRows = page.waitForResponse((response) => {
    const body = readQueryBody(response);
    return response.ok() && body?.offset === 0 && body.limit === 50;
  });

  await page.goto('/configurable-ssrm');
  await initialRows;

  await expect(page.getByRole('heading', { name: 'Configurable SSRM experiment' })).toBeVisible();
  await expect(page.locator('.ag-header-cell[col-id="reference"]')).toContainText('Reference');
  await expect(page.locator('.ag-header-cell[col-id="interaction"]')).toContainText('Access');
  await expect(page.locator('.ag-header-cell[col-id="amount"]')).toContainText('Amount');
  await expect(rowById(page, SEEDED_ROWS.enabled)).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.selectionDisabled).getByRole('checkbox').first()).toBeDisabled();

  const sortedRows = page.waitForResponse((response) => {
    const body = readQueryBody(response);
    return (
      response.ok() &&
      body?.offset === 0 &&
      body.limit === 50 &&
      body.sort?.[0]?.field === 'reference' &&
      body.sort[0].direction === 'asc'
    );
  });

  await page
    .locator('.ag-header-cell[col-id="reference"] .ag-header-cell-label')
    .click();
  await sortedRows;

  await expectNoPageErrors(pageErrors, '/configurable-ssrm metadata compiler');
});
