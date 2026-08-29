import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  SEEDED_ROWS,
  accountEditorInput,
  expectNoPageErrors,
  openGrid,
  rowById,
  routes,
} from './gridTestSupport';

async function expectDownloadFromAction(page: Page, buttonName: string) {
  // Infinite/SSRM intentionally refuse a partial Current Page export while AG Grid is still
  // materialising the page. Poll the actual user action until the all-or-nothing page contract is
  // ready rather than sleeping for an arbitrary duration.
  await expect(async () => {
    const downloadPromise = page.waitForEvent('download', { timeout: 1_500 });
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('transactions-');
  }).toPass({ timeout: 10_000, intervals: [250, 500, 1_000] });
}

for (const route of routes) {
  test(`${route}: grid loads and row interaction policy is visible/enforced`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const readOnlyRow = rowById(page, SEEDED_ROWS.readOnly);
    const readOnlyCheckbox = readOnlyRow.getByRole('checkbox').first();
    await expect(readOnlyCheckbox).toBeDisabled();

    await readOnlyRow.locator('.ag-cell[col-id="account"]').dblclick();
    await expect(accountEditorInput(page)).toHaveCount(0);

    const selectionDisabledRow = rowById(page, SEEDED_ROWS.selectionDisabled);
    await expect(selectionDisabledRow.getByRole('checkbox').first()).toBeDisabled();

    // selectionDisabled is still individually editable. The MUI editor proves the weaker policy is not
    // accidentally treated like readOnly by the browser integration.
    await selectionDisabledRow.locator('.ag-cell[col-id="account"]').dblclick();
    await expect(accountEditorInput(page)).toBeVisible();
    await page.keyboard.press('Escape');

    await expectNoPageErrors(pageErrors, `${route} row interaction`);
  });

  test(`${route}: direct edit can be discarded without mutating authoritative value`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = rowById(page, SEEDED_ROWS.enabled);
    const accountCell = row.locator('.ag-cell[col-id="account"]');
    await expect(accountCell).toHaveText('Operating');

    await accountCell.dblclick();
    const accountInput = accountEditorInput(page);
    await expect(accountInput).toBeVisible();
    await accountInput.fill(`Discard ${route.slice(1)}`);
    await accountInput.press('Enter');

    await expect(row.getByRole('button', { name: 'Discard', exact: true })).toBeEnabled();
    await row.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(accountCell).toHaveText('Operating');

    await expectNoPageErrors(pageErrors, `${route} discard`);
  });

  test(`${route}: valid direct edit persists through Row Save`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = rowById(page, SEEDED_ROWS.enabled);
    const accountCell = row.locator('.ag-cell[col-id="account"]');
    const nextValue = `E2E ${route.slice(1)}`;
    await expect(accountCell).toHaveText('Operating');

    await accountCell.dblclick();
    const accountInput = accountEditorInput(page);
    await expect(accountInput).toBeVisible();
    await accountInput.fill(nextValue);
    await accountInput.press('Enter');

    const saveButton = row.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/transactions/${SEEDED_ROWS.enabled}/`),
    );
    await saveButton.click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    await expect(accountCell).toHaveText(nextValue);

    await expectNoPageErrors(pageErrors, `${route} row save`);
  });

  test(`${route}: explicit selection enables selected actions and success clears selection`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = rowById(page, SEEDED_ROWS.enabled);
    await row.getByRole('checkbox').first().click();

    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();
    const action = page.getByRole('button', { name: 'Mark Pending', exact: true });
    await expect(action).toBeEnabled();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith('/api/transactions/selection/') &&
        response.ok(),
    );
    await action.click();
    await responsePromise;
    await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} selected status action`);
  });

  test(`${route}: current-page and selected export both produce downloads`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    await expectDownloadFromAction(page, 'Export current page');

    const row = rowById(page, SEEDED_ROWS.enabled);
    await row.getByRole('checkbox').first().click();
    await expectDownloadFromAction(page, 'Export selected');

    await expectNoPageErrors(pageErrors, `${route} export`);
  });
}
