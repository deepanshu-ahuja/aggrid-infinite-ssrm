import { expect, test, type Page } from '@playwright/test';

const routes = ['/client', '/infinite', '/ssrm'] as const;

type Route = (typeof routes)[number];

async function openGrid(page: Page, route: Route) {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto(route);
  await expect(page.locator('.ag-root')).toBeVisible();
  await expect(page.locator('.ag-row').first()).toBeVisible();
  return pageErrors;
}

function enabledRow(page: Page) {
  return page.locator('.ag-row:not(.grid-row--read-only):not(.grid-row--selection-disabled)').first();
}

async function expectNoPageErrors(errors: Error[], scenario: string) {
  expect(errors.map((error) => error.message), `${scenario} produced page errors`).toEqual([]);
}

for (const route of routes) {
  test(`${route}: grid loads and row interaction policy is visible/enforced`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const readOnlyRow = page.locator('.grid-row--read-only').first();
    await expect(readOnlyRow).toBeVisible();
    const readOnlyCheckbox = readOnlyRow.getByRole('checkbox').first();
    // AG Grid uses the native disabled attribute for an unselectable row rather than aria-disabled.
    await expect(readOnlyCheckbox).toBeDisabled();

    await readOnlyRow.locator('.ag-cell[col-id="account"]').dblclick();
    await expect(page.getByLabel('Account', { exact: true }).last()).not.toBeVisible();

    const selectionDisabledRow = page.locator('.grid-row--selection-disabled').first();
    await expect(selectionDisabledRow).toBeVisible();
    await expect(selectionDisabledRow.getByRole('checkbox').first()).toBeDisabled();

    // selectionDisabled is still individually editable. The MUI editor proves the weaker policy is not
    // accidentally treated like readOnly by the browser integration.
    await selectionDisabledRow.locator('.ag-cell[col-id="account"]').dblclick();
    await expect(page.getByLabel('Account', { exact: true }).last()).toBeVisible();
    await page.keyboard.press('Escape');

    await expectNoPageErrors(pageErrors, `${route} row interaction`);
  });

  test(`${route}: direct edit can be discarded without mutating authoritative value`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = enabledRow(page);
    const accountCell = row.locator('.ag-cell[col-id="account"]');
    const original = (await accountCell.innerText()).trim();

    await accountCell.dblclick();
    const accountInput = page.getByLabel('Account', { exact: true }).last();
    await accountInput.fill(`Discard ${route.slice(1)}`);
    await accountInput.press('Enter');

    await expect(row.getByRole('button', { name: 'Discard', exact: true })).toBeEnabled();
    await row.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(accountCell).toHaveText(original);

    await expectNoPageErrors(pageErrors, `${route} discard`);
  });

  test(`${route}: valid direct edit persists through Row Save`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = enabledRow(page);
    const accountCell = row.locator('.ag-cell[col-id="account"]');
    const nextValue = `E2E ${route.slice(1)}`;

    await accountCell.dblclick();
    const accountInput = page.getByLabel('Account', { exact: true }).last();
    await accountInput.fill(nextValue);
    await accountInput.press('Enter');

    const saveButton = row.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PATCH' && /\/api\/transactions\//.test(response.url()),
    );
    await saveButton.click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    await expect(accountCell).toHaveText(nextValue);

    await expectNoPageErrors(pageErrors, `${route} row save`);
  });

  test(`${route}: explicit selection enables selected actions and success clears selection`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = enabledRow(page);
    await row.getByRole('checkbox').first().click();

    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();
    const action = page.getByRole('button', { name: 'Mark Pending', exact: true });
    await expect(action).toBeEnabled();

    const responsePromise = page.waitForResponse(
      (response) =>
        ['POST', 'PATCH'].includes(response.request().method()) &&
        response.url().includes('/api/transactions/') &&
        response.ok(),
    );
    await action.click();
    await responsePromise;
    await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} selected status action`);
  });

  test(`${route}: current-page and selected export both produce downloads`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const currentPageDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export current page', exact: true }).click();
    expect((await currentPageDownload).suggestedFilename()).toContain('transactions-');

    const row = enabledRow(page);
    await row.getByRole('checkbox').first().click();
    const selectedDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export selected', exact: true }).click();
    expect((await selectedDownload).suggestedFilename()).toContain('transactions-');

    await expectNoPageErrors(pageErrors, `${route} export`);
  });
}
