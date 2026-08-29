import { expect, test, type Page } from '@playwright/test';

const routes = ['/client', '/infinite', '/ssrm'] as const;

async function openGrid(page: Page, route: (typeof routes)[number]) {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto(route);
  await expect(page.locator('.ag-root')).toBeVisible();
  await expect(page.locator('.ag-row').first()).toBeVisible();
  return pageErrors;
}

async function expectNoPageErrors(pageErrors: Error[], scenario: string) {
  expect(pageErrors.map((error) => error.message), `${scenario} produced page errors`).toEqual([]);
}

for (const route of routes) {
  test(`${route}: Flow 2 blank Currency stays field-local and never crashes rendering`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    await page.getByRole('checkbox', { name: 'Currency', exact: true }).click();
    await expect(page.getByText('Currency is required.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Apply bulk edit', exact: true }).click();

    const invalidCurrency = page.locator('.ag-cell[col-id="currency"].grid-cell--validation-error');
    await expect(invalidCurrency.first()).toBeVisible();

    const row = invalidCurrency.first().locator('xpath=ancestor::*[contains(@class,"ag-row")][1]');
    await expect(row.locator('.ag-cell[col-id="amount"]')).not.toHaveText('');
    await expect(row.locator('.ag-cell[col-id="status"]')).not.toHaveClass(/grid-cell--validation-error/);
    await expect(row.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    await expectNoPageErrors(pageErrors, `${route} blank Currency`);
  });

  test(`${route}: Flow 2 checked blank Amount becomes invalid LOCAL instead of being ignored`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    await page.getByRole('checkbox', { name: 'Amount', exact: true }).click();
    await expect(page.getByText('Amount must be between 0 and 1,000,000.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Apply bulk edit', exact: true }).click();

    const invalidAmount = page.locator('.ag-cell[col-id="amount"].grid-cell--validation-error');
    await expect(invalidAmount.first()).toBeVisible();

    const row = invalidAmount.first().locator('xpath=ancestor::*[contains(@class,"ag-row")][1]');
    await expect(row.locator('.ag-cell[col-id="status"]')).not.toHaveClass(/grid-cell--validation-error/);
    await expect(row.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    await expectNoPageErrors(pageErrors, `${route} blank Amount`);
  });

  test(`${route}: MUI Account editor explains its own validation failure`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const editableAccountCell = page.locator('.ag-cell[col-id="account"]')
      .filter({ hasNot: page.locator('.grid-row--read-only') })
      .first();
    await editableAccountCell.dblclick();

    const accountInput = page.getByLabel('Account', { exact: true }).last();
    await expect(accountInput).toBeVisible();
    await accountInput.fill('');
    await expect(page.getByText('Account is required.', { exact: true })).toBeVisible();
    await accountInput.press('Enter');

    await expect(page.locator('.ag-cell[col-id="account"].grid-cell--validation-error').first()).toBeVisible();
    await expectNoPageErrors(pageErrors, `${route} MUI Account editor`);
  });

  test(`${route}: date picker shows field-specific required error and keeps invalid LOCAL draft`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const dateCell = page.locator('.ag-cell[col-id="transactionDate"]').first();
    await dateCell.dblclick();

    const dateInput = page.getByLabel('Transaction date', { exact: true }).last();
    await expect(dateInput).toBeVisible();
    await dateInput.fill('');
    await expect(page.getByText('Transaction date is required.', { exact: true })).toBeVisible();
    await dateInput.press('Enter');

    const invalidDate = page.locator('.ag-cell[col-id="transactionDate"].grid-cell--validation-error');
    await expect(invalidDate.first()).toBeVisible();
    const row = invalidDate.first().locator('xpath=ancestor::*[contains(@class,"ag-row")][1]');
    await expect(row.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    await expectNoPageErrors(pageErrors, `${route} Transaction date editor`);
  });
}
