import { expect, test } from './fixtures';
import { expectNoPageErrors, openGrid, rowById } from './gridTestSupport';
import { applyStatusFilter, readQueryBody } from './serverQueryTestSupport';

async function waitForStatusFilter(page: Parameters<typeof applyStatusFilter>[0], value: string) {
  return page.waitForResponse((response) => {
    const body = readQueryBody(response);
    const filter = body?.filters?.[0];
    return (
      response.ok() &&
      body?.filters?.length === 1 &&
      filter?.field === 'status' &&
      filter.operator === 'contains' &&
      filter.value === value
    );
  });
}

test('/ssrm: All Filtered uses filtered count, user exceptions, and filtered backend target', async ({
  page,
}) => {
  const pageErrors = await openGrid(page, '/ssrm');

  const pendingQuery = waitForStatusFilter(page, 'Pending');
  await applyStatusFilter(page, 'Pending');
  await pendingQuery;

  await page.getByRole('button', { name: 'Select all filtered', exact: true }).click();
  await expect(page.getByText('250 selected', { exact: true }).first()).toBeVisible();

  // txn-00002 is selectionDisabled. txn-00005 is the first eligible Pending row and therefore a real
  // user exception when unchecked from the compact exclude-mode All Filtered selection.
  const eligiblePendingCheckbox = rowById(page, 'txn-00005').getByRole('checkbox').first();
  await expect(eligiblePendingCheckbox).toBeChecked();
  await eligiblePendingCheckbox.click();
  await expect(page.getByText('249 selected', { exact: true }).first()).toBeVisible();

  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' && request.url().endsWith('/api/transactions/selection/'),
  );
  const actionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/transactions/selection/') &&
      response.ok(),
  );

  await page.getByRole('button', { name: 'Mark Failed', exact: true }).click();
  const request = await actionRequest;
  expect(request.postDataJSON()).toEqual({
    selection: { mode: 'exclude', ids: ['txn-00005'] },
    filters: [{ field: 'status', operator: 'contains', value: 'Pending' }],
    changes: { status: 'Failed' },
  });
  await actionResponse;

  await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();
  await expectNoPageErrors(pageErrors, '/ssrm All Filtered backend target');
});

test('/ssrm: changing the defining filter clears All Filtered selection', async ({ page }) => {
  const pageErrors = await openGrid(page, '/ssrm');

  const pendingQuery = waitForStatusFilter(page, 'Pending');
  await applyStatusFilter(page, 'Pending');
  await pendingQuery;
  await page.getByRole('button', { name: 'Select all filtered', exact: true }).click();
  await expect(page.getByText('250 selected', { exact: true }).first()).toBeVisible();

  const failedQuery = waitForStatusFilter(page, 'Failed');
  await applyStatusFilter(page, 'Failed');
  await failedQuery;

  await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Pending', exact: true })).toBeDisabled();
  await expectNoPageErrors(pageErrors, '/ssrm filtered selection reset');
});

test('/ssrm: native All Records remains dataset-wide when the visible filter changes', async ({ page }) => {
  const pageErrors = await openGrid(page, '/ssrm');

  const headerSelectAll = page.locator('.ag-header-select-all').first();
  await headerSelectAll.click();
  await expect(page.getByText('750 selected', { exact: true }).first()).toBeVisible();

  await rowById(page, 'txn-00001').getByRole('checkbox').first().click();
  await expect(page.getByText('749 selected', { exact: true }).first()).toBeVisible();

  const pendingQuery = waitForStatusFilter(page, 'Pending');
  await applyStatusFilter(page, 'Pending');
  await pendingQuery;
  await expect(page.getByText('749 selected', { exact: true }).first()).toBeVisible();

  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' && request.url().endsWith('/api/transactions/selection/'),
  );
  const actionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/transactions/selection/') &&
      response.ok(),
  );

  await page.getByRole('button', { name: 'Mark Failed', exact: true }).click();
  const request = await actionRequest;
  expect(request.postDataJSON()).toEqual({
    selection: { mode: 'exclude', ids: ['txn-00001'] },
    changes: { status: 'Failed' },
  });
  await actionResponse;

  await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();
  await expectNoPageErrors(pageErrors, '/ssrm All Records survives filter');
});
