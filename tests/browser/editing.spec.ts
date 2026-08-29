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

async function editAccount(page: Page, rowId: string, value: string) {
  const cell = rowById(page, rowId).locator('.ag-cell[col-id="account"]');
  await cell.dblclick();
  const input = accountEditorInput(page);
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.press('Enter');
  await expect(cell).toHaveText(value);
}

for (const route of routes) {
  test(`${route}: Save selected edits persists only dirty rows in the current selection`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const selectedValue = `Selected ${route.slice(1)}`;
    const unselectedValue = `Unselected ${route.slice(1)}`;

    await editAccount(page, SEEDED_ROWS.enabled, selectedValue);
    await editAccount(page, SEEDED_ROWS.secondEnabled, unselectedValue);

    await rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first().click();
    await expect(page.getByText(/2 rows edited total; 1 selected/)).toBeVisible();

    const saveSelected = page.getByRole('button', { name: 'Save selected edits (1)', exact: true });
    await expect(saveSelected).toBeEnabled();

    const bulkRequest = page.waitForRequest(
      (request) =>
        request.method() === 'PATCH' && request.url().endsWith('/api/transactions/bulk/'),
    );
    const bulkResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith('/api/transactions/bulk/') &&
        response.ok(),
    );

    await saveSelected.click();
    const request = await bulkRequest;
    expect(request.postDataJSON()).toEqual({
      updates: [{ id: SEEDED_ROWS.enabled, changes: { account: selectedValue } }],
    });
    await bulkResponse;

    // The selected row was acknowledged/persisted; the unrelated dirty row remains LOCAL and editable.
    await expect(rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]')).toHaveText(
      selectedValue,
    );
    await expect(
      rowById(page, SEEDED_ROWS.secondEnabled).locator('.ag-cell[col-id="account"]'),
    ).toHaveText(unselectedValue);
    await expect(
      rowById(page, SEEDED_ROWS.secondEnabled).getByRole('button', { name: 'Discard', exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(/1 row edited total; 0 selected/)).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Save selected exact target`);
  });

  test(`${route}: Discard selected edits restores only dirty rows in the current selection`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const selectedValue = `Discard selected ${route.slice(1)}`;
    const unselectedValue = `Keep local ${route.slice(1)}`;

    await editAccount(page, SEEDED_ROWS.enabled, selectedValue);
    await editAccount(page, SEEDED_ROWS.secondEnabled, unselectedValue);
    await rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first().click();

    const discardSelected = page.getByRole('button', { name: 'Discard selected edits', exact: true });
    await expect(discardSelected).toBeEnabled();
    await discardSelected.click();

    const selectedRow = rowById(page, SEEDED_ROWS.enabled);
    await expect(selectedRow.locator('.ag-cell[col-id="account"]')).toHaveText('Operating');
    await expect(
      rowById(page, SEEDED_ROWS.secondEnabled).locator('.ag-cell[col-id="account"]'),
    ).toHaveText(unselectedValue);
    // Once the selected row is clean the dirty-only row action renderer is intentionally absent.
    await expect(selectedRow.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(selectedRow.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0);
    await expect(
      rowById(page, SEEDED_ROWS.secondEnabled).getByRole('button', { name: 'Discard', exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(/1 row edited total; 0 selected/)).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Discard selected exact target`);
  });
}
