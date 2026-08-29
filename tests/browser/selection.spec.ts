import { expect, test } from './fixtures';
import {
  SEEDED_ROWS,
  expectNoPageErrors,
  openGrid,
  rowById,
  routes,
} from './gridTestSupport';

// All three concrete routes currently show 25 rows per page. In the deterministic first 25 rows,
// txn-00002/txn-00014 are selectionDisabled and txn-00004/txn-00016 are readOnly, leaving 21 rows in
// the selectable current-page universe. Keep this explicit so a future page-size/demo-policy change
// fails loudly instead of silently weakening the selection assertion.
const FIRST_PAGE_ELIGIBLE_COUNT = 21;
const ALL_CLIENT_ELIGIBLE_COUNT = 624;

for (const route of routes) {
  test(`${route}: selected status failure preserves the current selection`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    await rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first().click();
    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();

    await page.route('**/api/transactions/selection/', async (routeHandler) => {
      if (routeHandler.request().method() !== 'PATCH') {
        await routeHandler.continue();
        return;
      }
      await routeHandler.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'E2E selected action failure' }),
      });
    });

    await page.getByRole('button', { name: 'Mark Pending', exact: true }).click();

    await expect(page.getByText('Request failed with status 500.', { exact: true })).toBeVisible();
    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();
    await expect(rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first()).toBeChecked();

    await expectNoPageErrors(pageErrors, `${route} selected action failure`);
  });
}

test('/client: native header selects the complete eligible Client dataset', async ({ page }) => {
  const pageErrors = await openGrid(page, '/client');

  const headerSelectAll = page.locator('.ag-header-select-all').first();
  await expect(headerSelectAll).toBeVisible();
  await headerSelectAll.click();

  await expect(page.getByText(`${ALL_CLIENT_ELIGIBLE_COUNT} selected`, { exact: true }).first()).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first()).toBeChecked();
  await expect(rowById(page, SEEDED_ROWS.selectionDisabled).getByRole('checkbox').first()).toBeDisabled();
  await expect(rowById(page, SEEDED_ROWS.readOnly).getByRole('checkbox').first()).toBeDisabled();

  await rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first().click();
  await expect(page.getByText(`${ALL_CLIENT_ELIGIBLE_COUNT - 1} selected`, { exact: true }).first()).toBeVisible();

  await expectNoPageErrors(pageErrors, '/client native All Records');
});

test('/infinite: custom header selects only the fully materialised current page', async ({ page }) => {
  const pageErrors = await openGrid(page, '/infinite');

  const currentPageHeader = page.getByRole('checkbox', {
    name: 'Select or clear current page',
    exact: true,
  });
  await expect(currentPageHeader).toBeEnabled();
  await currentPageHeader.click();

  await expect(page.getByText(`${FIRST_PAGE_ELIGIBLE_COUNT} selected`, { exact: true }).first()).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first()).toBeChecked();
  await expect(rowById(page, SEEDED_ROWS.secondEnabled).getByRole('checkbox').first()).toBeChecked();
  await expect(rowById(page, SEEDED_ROWS.selectionDisabled).getByRole('checkbox').first()).toBeDisabled();
  await expect(rowById(page, SEEDED_ROWS.readOnly).getByRole('checkbox').first()).toBeDisabled();

  await rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first().click();
  await expect(page.getByText(`${FIRST_PAGE_ELIGIBLE_COUNT - 1} selected`, { exact: true }).first()).toBeVisible();
  await expect(currentPageHeader).toBePartiallyChecked();

  await expectNoPageErrors(pageErrors, '/infinite Current Page selection');
});

test('/ssrm: explicit Current Page control selects only eligible materialised page rows', async ({ page }) => {
  const pageErrors = await openGrid(page, '/ssrm');

  await page.getByRole('button', { name: 'Select current page', exact: true }).click();
  await expect(page.getByText(`${FIRST_PAGE_ELIGIBLE_COUNT} selected`, { exact: true }).first()).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first()).toBeChecked();
  await expect(rowById(page, SEEDED_ROWS.selectionDisabled).getByRole('checkbox').first()).toBeDisabled();
  await expect(rowById(page, SEEDED_ROWS.readOnly).getByRole('checkbox').first()).toBeDisabled();

  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();

  await expectNoPageErrors(pageErrors, '/ssrm Current Page selection');
});

test('/ssrm: native header represents Select All Records across unloaded rows', async ({ page }) => {
  const pageErrors = await openGrid(page, '/ssrm');

  const headerSelectAll = page.locator('.ag-header-select-all').first();
  await expect(headerSelectAll).toBeVisible();
  await headerSelectAll.click();

  // Current count semantics use the backend total for SSRM dataset-wide selection. Loaded restricted
  // rows remain disabled even though the server-wide count is intentionally not eligibility-aware yet.
  await expect(page.getByText('750 selected', { exact: true }).first()).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first()).toBeChecked();
  await expect(rowById(page, SEEDED_ROWS.selectionDisabled).getByRole('checkbox').first()).toBeDisabled();
  await expect(rowById(page, SEEDED_ROWS.readOnly).getByRole('checkbox').first()).toBeDisabled();

  await rowById(page, SEEDED_ROWS.enabled).getByRole('checkbox').first().click();
  await expect(page.getByText('749 selected', { exact: true }).first()).toBeVisible();

  await expectNoPageErrors(pageErrors, '/ssrm native All Records');
});
