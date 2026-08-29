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

// All three routes currently show 25 rows per page. In the deterministic first page, txn-00004 and
// txn-00016 are readOnly. selectionDisabled rows are still individually/programmatically editable,
// so the current-page editing universe contains 23 rows.
const FIRST_PAGE_EDITABLE_COUNT = 23;

async function editFirstAccount(page: Page, value: string) {
  const cell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
  await cell.dblclick();
  const input = accountEditorInput(page);
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.press('Enter');
  await expect(cell).toHaveText(value);
}

for (const route of routes) {
  test(`${route}: Flow 1 applies the last cell edit to every editable row on the current page`, async ({
    page,
  }) => {
    const pageErrors = await openGrid(page, route);
    const replayValue = `Replay ${route.slice(1)}`;

    await editFirstAccount(page, replayValue);
    await expect(page.getByText(`Last edit: account = ${replayValue}`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Apply last edit', exact: true }).click();

    await expect(
      rowById(page, SEEDED_ROWS.secondEnabled).locator('.ag-cell[col-id="account"]'),
    ).toHaveText(replayValue);
    await expect(
      rowById(page, SEEDED_ROWS.selectionDisabled).locator('.ag-cell[col-id="account"]'),
    ).toHaveText(replayValue);
    // readOnly remains authoritative and is not turned into a LOCAL draft by the page helper.
    await expect(rowById(page, SEEDED_ROWS.readOnly).locator('.ag-cell[col-id="account"]')).toHaveText(
      'Settlement',
    );
    await expect(page.getByText(new RegExp(`${FIRST_PAGE_EDITABLE_COUNT} rows edited total`))).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Flow 1 current-page replay`);
  });

  test(`${route}: Flow 2 applies one valid checked field to editable page rows only`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const currencyCheckbox = page.getByRole('checkbox', { name: 'Currency', exact: true });
    await currencyCheckbox.click();
    const currencyInput = currencyCheckbox.locator(
      'xpath=ancestor::label/following-sibling::div[1]//input',
    );
    await expect(currencyInput).toBeEnabled();
    await currencyInput.fill('GBP');
    await page.getByRole('button', { name: 'Apply bulk edit', exact: true }).click();

    await expect(rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="currency"]')).toHaveText(
      'GBP',
    );
    await expect(
      rowById(page, SEEDED_ROWS.secondEnabled).locator('.ag-cell[col-id="currency"]'),
    ).toHaveText('GBP');
    await expect(
      rowById(page, SEEDED_ROWS.selectionDisabled).locator('.ag-cell[col-id="currency"]'),
    ).toHaveText('GBP');
    await expect(rowById(page, SEEDED_ROWS.readOnly).locator('.ag-cell[col-id="currency"]')).toHaveText(
      'INR',
    );
    await expect(page.getByText(new RegExp(`${FIRST_PAGE_EDITABLE_COUNT} rows edited total`))).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Flow 2 current-page edit`);
  });
}
