// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COLUMNS
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoPageErrors } from './gridTestSupport';

const ROUTE = '/configurable-ssrm';
const PROFILE_KEY = 'aggrid.devAccessProfile';
const ENTITY_KEY = 'aggrid.devActiveEntity';

async function openConfigurableSsrm(
  page: Page,
  profile: string,
  entity?: string,
) {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.addInitScript(
    ({ profileKey, entityKey, profileValue, entityValue }) => {
      window.localStorage.setItem(profileKey, profileValue);
      if (entityValue) window.localStorage.setItem(entityKey, entityValue);
      else window.localStorage.removeItem(entityKey);
    },
    {
      profileKey: PROFILE_KEY,
      entityKey: ENTITY_KEY,
      profileValue: profile,
      entityValue: entity,
    },
  );

  await page.goto(ROUTE);
  await expect(page.locator('.ag-root')).toBeVisible();

  return pageErrors;
}

test('configurable Review profile resolves Loan and Finance as separate accessible entities', async ({ page }) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanAndFinance', 'loan');

  await expect(page.getByTestId('review-access-profile')).toContainText('loanAndFinance');
  await expect(page.getByTestId('review-active-entity')).toContainText('loan');
  await expect(page.getByText(/Available entities for this profile: loan, finance/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Borrower' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Internal score' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Facility' })).toHaveCount(0);

  await expectNoPageErrors(pageErrors, 'configurable Review multi-entity access');
});

test('localStorage active entity independently switches the same user from Loan to Finance', async ({ page }) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanAndFinance', 'finance');

  await expect(page.getByTestId('review-access-profile')).toContainText('loanAndFinance');
  await expect(page.getByTestId('review-active-entity')).toContainText('finance');
  await expect(page.getByRole('columnheader', { name: 'Facility' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Counterparty' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Borrower' })).toHaveCount(0);

  await expectNoPageErrors(pageErrors, 'configurable Review active entity switch');
});

test('loanOnly profile removes unavailable entity and field instead of merely hiding them', async ({ page }) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanOnly', 'finance');

  // Finance is not authorized by this profile, so an invalid stored active entity falls back to the
  // first actually available entity. Internal score is also omitted from the resolved Loan fields.
  await expect(page.getByTestId('review-active-entity')).toContainText('loan');
  await expect(page.getByText(/Available entities for this profile: loan\./)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Borrower' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Internal score' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Facility' })).toHaveCount(0);

  await expectNoPageErrors(pageErrors, 'configurable Review entity and field removal');
});

test('loanReadOnly profile downgrades base editable fields before AG Grid editing', async ({ page }) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanReadOnly', 'loan');
  const borrowerCell = page.locator('.ag-row[row-id="LN-1001"] .ag-cell[col-id="borrower"]');

  await expect(borrowerCell).toBeVisible();
  await borrowerCell.dblclick();
  await expect(page.locator('.ag-cell-inline-editing input')).toHaveCount(0);
  await expect(page.getByText(/0 rows edited; 0 cells changed locally/)).toBeVisible();

  await expectNoPageErrors(pageErrors, 'configurable Review read-only access projection');
});

test('editable Loan access still uses native validation before BASE + LOCAL draft tracking', async ({ page }) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanOnly', 'loan');
  const borrowerCell = page.locator('.ag-row[row-id="LN-1001"] .ag-cell[col-id="borrower"]');

  await borrowerCell.dblclick();
  const input = page.locator('.ag-cell-inline-editing input');
  await expect(input).toBeVisible();

  await input.fill('');
  await input.press('Enter');
  await expect(input).toBeVisible();
  await expect(page.getByText(/0 rows edited; 0 cells changed locally/)).toBeVisible();

  await input.fill('Northstar Builders Updated');
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await expect(borrowerCell).toHaveText('Northstar Builders Updated');
  await expect(page.getByText(/1 row edited; 1 cell changed locally/)).toBeVisible();

  await expectNoPageErrors(pageErrors, 'configurable Review validation and draft tracking');
});
