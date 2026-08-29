// GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-ACTION-SELECTED
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  SEEDED_ROWS,
  expectNoPageErrors,
  openGrid,
  rowById,
  routes,
  waitForAuthoritativeDataResponse,
  type Route,
} from './gridTestSupport';

async function editStatus(page: Page, rowId: string, status: 'Completed' | 'Pending' | 'Failed') {
  const cell = rowById(page, rowId).locator('.ag-cell[col-id="status"]');
  await cell.dblclick();

  const editor = cell.getByRole('combobox');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.getByRole('option', { name: status, exact: true }).click();
  await expect(cell).toContainText(status);
  await expect(editor).toHaveCount(0);
}

function waitForServerRowModelRefresh(page: Page, route: Route) {
  return route === '/client' ? undefined : waitForAuthoritativeDataResponse(page, route);
}

for (const route of routes) {
  test(`${route}: row Save refreshes selectionDisabled to enabled interaction state`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = rowById(page, SEEDED_ROWS.selectionDisabled);

    await expect(row).toHaveClass(/grid-row--selection-disabled/);
    await expect(row.getByRole('checkbox').first()).toBeDisabled();
    await expect(row.getByText('Selection disabled', { exact: true })).toBeVisible();

    // txn-00002 starts Pending + Treasury. Changing only status to Completed makes the backend policy
    // enabled while exercising the normal tracked-edit -> single-row Save persistence path.
    await editStatus(page, SEEDED_ROWS.selectionDisabled, 'Completed');

    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/transactions/${SEEDED_ROWS.selectionDisabled}/`) &&
        response.ok(),
    );
    const authoritativeRefresh = waitForServerRowModelRefresh(page, route);

    await row.getByRole('button', { name: 'Save', exact: true }).click();
    await saveResponse;
    if (authoritativeRefresh) await authoritativeRefresh;

    await expect(row).not.toHaveClass(/grid-row--selection-disabled/);
    await expect(row.getByText('Selection disabled', { exact: true })).toHaveCount(0);

    const checkbox = row.getByRole('checkbox').first();
    await expect(checkbox).toBeEnabled();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} row Save interaction transition`);
  });

  test(`${route}: Save selected refreshes enabled rows into restricted interaction states`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const becomesSelectionDisabled = rowById(page, SEEDED_ROWS.treasuryEnabled);
    const becomesReadOnly = rowById(page, SEEDED_ROWS.settlementEnabled);

    await expect(becomesSelectionDisabled.getByRole('checkbox').first()).toBeEnabled();
    await expect(becomesReadOnly.getByRole('checkbox').first()).toBeEnabled();

    // Select while both rows are still backend-enabled. LOCAL status edits do not manufacture a new
    // interactionMode; the authoritative bulk Save response is what changes native row eligibility.
    await becomesSelectionDisabled.getByRole('checkbox').first().click();
    await becomesReadOnly.getByRole('checkbox').first().click();
    await expect(page.getByText('2 selected', { exact: true }).first()).toBeVisible();

    // txn-00006 is Treasury + Failed -> Pending makes it selectionDisabled.
    // txn-00008 is Settlement + Pending -> Completed makes it readOnly.
    await editStatus(page, SEEDED_ROWS.treasuryEnabled, 'Pending');
    await editStatus(page, SEEDED_ROWS.settlementEnabled, 'Completed');

    const bulkResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith('/api/transactions/bulk/') &&
        response.ok(),
    );
    const authoritativeRefresh = waitForServerRowModelRefresh(page, route);

    const saveSelected = page.getByRole('button', { name: 'Save selected edits (2)', exact: true });
    await expect(saveSelected).toBeEnabled();
    await saveSelected.click();
    await bulkResponse;
    if (authoritativeRefresh) await authoritativeRefresh;

    await expect(becomesSelectionDisabled).toHaveClass(/grid-row--selection-disabled/);
    await expect(becomesSelectionDisabled.getByText('Selection disabled', { exact: true })).toBeVisible();
    await expect(becomesSelectionDisabled.getByRole('checkbox').first()).toBeDisabled();

    await expect(becomesReadOnly).toHaveClass(/grid-row--read-only/);
    await expect(becomesReadOnly.getByText('Read only', { exact: true })).toBeVisible();
    await expect(becomesReadOnly.getByRole('checkbox').first()).toBeDisabled();

    // Native selectability owns this consequence: rows that become ineligible cannot remain selected.
    await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Save selected interaction transition`);
  });

  test(`${route}: selected status action refreshes enabled row to selectionDisabled`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const row = rowById(page, SEEDED_ROWS.treasuryEnabled);
    const checkbox = row.getByRole('checkbox').first();

    await expect(row).not.toHaveClass(/grid-row--selection-disabled/);
    await expect(checkbox).toBeEnabled();
    await checkbox.click();
    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();

    const actionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith('/api/transactions/selection/') &&
        response.ok(),
    );
    const authoritativeRefresh = waitForAuthoritativeDataResponse(page, route);

    // txn-00006 is Treasury + Failed, so Mark Pending moves it into selectionDisabled policy.
    await page.getByRole('button', { name: 'Mark Pending', exact: true }).click();
    await actionResponse;
    await authoritativeRefresh;

    // Successful selected actions deliberately clear the prior selection before refreshing data.
    await expect(page.getByText('0 selected', { exact: true }).first()).toBeVisible();
    await expect(row).toHaveClass(/grid-row--selection-disabled/);
    await expect(row.getByText('Selection disabled', { exact: true })).toBeVisible();
    await expect(row.getByRole('checkbox').first()).toBeDisabled();

    await expectNoPageErrors(pageErrors, `${route} selected status interaction transition`);
  });
}
