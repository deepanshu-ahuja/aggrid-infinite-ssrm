// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-DATA-LOAD | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-SEL-MANUAL | GRIDCAP-ACTION-SELECTED | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COLUMNS
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoPageErrors } from './gridTestSupport';

const ROUTE = '/configurable-ssrm';
const PROFILE_KEY = 'aggrid.devAccessProfile';
const ENTITY_KEY = 'aggrid.devActiveEntity';

async function openConfigurableSsrm(page: Page, profile: string, entity?: string) {
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

function waitForPost(page: Page, pathname: string) {
  return page.waitForRequest(
    (request) =>
      request.method() === 'POST' && new URL(request.url()).pathname === pathname,
  );
}

test('Review allEntities profile exposes Loan, Finance and Transaction while Loan uses its own backend contract', async ({
  page,
}) => {
  const initialRequest = waitForPost(page, '/api/review/loans/query/');
  const pageErrors = await openConfigurableSsrm(page, 'allEntities', 'loan');
  const request = await initialRequest;

  await expect(page.getByTestId('review-access-profile')).toContainText('allEntities');
  await expect(page.getByTestId('review-active-entity')).toContainText('loan');
  await expect(
    page.getByText(/Available entities for this profile: loan, finance, transaction/),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Borrower' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Internal score' })).toBeVisible();
  await expect(page.locator('.ag-row[row-id="LN-1000"]')).toBeVisible();

  expect(request.postDataJSON()).toEqual({
    offset: 0,
    limit: 50,
    sort: [],
    filters: [],
  });

  await expectNoPageErrors(pageErrors, 'configurable Review Loan runtime');
});

test('same Review grid loads Finance through its deliberately different backend wire contract', async ({
  page,
}) => {
  const initialRequest = waitForPost(page, '/api/review/finance/search/');
  const pageErrors = await openConfigurableSsrm(page, 'allEntities', 'finance');
  const request = await initialRequest;

  await expect(page.getByTestId('review-active-entity')).toContainText('finance');
  await expect(page.getByRole('columnheader', { name: 'Facility' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Counterparty' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Borrower' })).toHaveCount(0);
  await expect(page.locator('.ag-row[row-id="FIN-5000"]')).toBeVisible();

  expect(request.postDataJSON()).toEqual({
    window: { from: 0, size: 40 },
    orderBy: [],
    criteria: [],
  });

  await expectNoPageErrors(pageErrors, 'configurable Review Finance runtime');
});

test('Transaction is a third Review entity and reuses the existing Transaction query contract', async ({
  page,
}) => {
  const initialRequest = waitForPost(page, '/api/transactions/query/');
  const pageErrors = await openConfigurableSsrm(page, 'allEntities', 'transaction');
  const request = await initialRequest;

  await expect(page.getByTestId('review-active-entity')).toContainText('transaction');
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Reference' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Account' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible();
  await expect(page.locator('.ag-row[row-id="txn-00001"]')).toBeVisible();

  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body).toHaveProperty('offset');
  expect(body).toHaveProperty('limit');
  expect(body).toHaveProperty('sort');
  expect(body).toHaveProperty('filters');
  expect(body).not.toHaveProperty('window');

  await expectNoPageErrors(pageErrors, 'configurable Review Transaction runtime');
});

test('loanOnly profile removes unavailable entity and field instead of merely hiding them', async ({
  page,
}) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanOnly', 'finance');

  // Finance is not authorized by this profile, so an invalid stored active entity falls back to the
  // first actually available entity. Internal score also stays absent by default-deny projection.
  await expect(page.getByTestId('review-active-entity')).toContainText('loan');
  await expect(page.getByText(/Available entities for this profile: loan\./)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Borrower' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Internal score' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Facility' })).toHaveCount(0);

  await expectNoPageErrors(pageErrors, 'configurable Review entity and field removal');
});

test('loanReadOnly profile downgrades base editable fields before AG Grid editing', async ({
  page,
}) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanReadOnly', 'loan');
  const borrowerCell = page.locator('.ag-row[row-id="LN-1000"] .ag-cell[col-id="borrower"]');

  await expect(borrowerCell).toBeVisible();
  await borrowerCell.dblclick();
  await expect(page.locator('.ag-cell-inline-editing input')).toHaveCount(0);
  await expect(page.getByText(/0 rows edited; 0 cells changed locally/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toHaveCount(0);

  await expectNoPageErrors(pageErrors, 'configurable Review read-only access projection');
});

test('editable Loan access uses native validation before BASE + LOCAL draft tracking', async ({
  page,
}) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanOnly', 'loan');
  const borrowerCell = page.locator('.ag-row[row-id="LN-1000"] .ag-cell[col-id="borrower"]');

  await borrowerCell.dblclick();
  const input = page.locator('.ag-cell-inline-editing input');
  await expect(input).toBeVisible();

  await input.fill('');
  await input.press('Enter');
  await expect(input).toBeVisible();
  await expect(page.getByText(/0 rows edited; 0 cells changed locally/)).toBeVisible();

  await input.fill('Borrower 001 Updated');
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await expect(borrowerCell).toHaveText('Borrower 001 Updated');
  await expect(page.getByText(/1 row edited; 1 cell changed locally/)).toBeVisible();

  await expectNoPageErrors(pageErrors, 'configurable Review validation and draft tracking');
});

test('common Review Submit delegates Loan selection to the Loan action API and refreshes the grid', async ({
  page,
}) => {
  const pageErrors = await openConfigurableSsrm(page, 'loanOnly', 'loan');
  const row = page.locator('.ag-row[row-id="LN-1001"]');
  await row.getByRole('checkbox').first().click();
  await expect(page.getByText('1 row selected', { exact: true })).toBeVisible();

  const submitRequest = waitForPost(page, '/api/review/loans/submit/');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const request = await submitRequest;

  expect(request.postDataJSON()).toEqual({
    selection: { mode: 'include', ids: ['LN-1001'] },
    filters: [],
  });
  await expect(page.getByText('1 row submitted.', { exact: true })).toBeVisible();
  await expect(page.getByText('0 rows selected', { exact: true })).toBeVisible();

  await expectNoPageErrors(pageErrors, 'configurable Review Loan Submit');
});

test('same Review Submit delegates Finance selection to its unrelated command payload', async ({
  page,
}) => {
  const pageErrors = await openConfigurableSsrm(page, 'financeOnly', 'finance');
  const row = page.locator('.ag-row[row-id="FIN-5001"]');
  await row.getByRole('checkbox').first().click();
  await expect(page.getByText('1 row selected', { exact: true })).toBeVisible();

  const submitRequest = waitForPost(page, '/api/review/finance/commands/submit/');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const request = await submitRequest;

  expect(request.postDataJSON()).toEqual({
    command: 'SUBMIT_REVIEW',
    target: { mode: 'explicit', keys: ['FIN-5001'] },
  });
  await expect(
    page.getByText('Finance operation finance-submit-1 accepted.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('0 rows selected', { exact: true })).toBeVisible();

  await expectNoPageErrors(pageErrors, 'configurable Review Finance Submit');
});
