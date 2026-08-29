// GRIDCAP-IMPORT | GRIDCAP-ROW-ELIGIBILITY
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  expectNoPageErrors,
  openGrid,
  rowById,
  routes,
  SEEDED_ROWS,
  waitForAuthoritativeDataResponse,
  type Route,
} from './gridTestSupport';

async function previewAndApplyImport(page: Page, route: Route, content: string, readyRows: number) {
  await page.getByRole('button', { name: 'Import CSV' }).click();
  await page.getByTestId('transaction-import-file').setInputFiles({
    name: 'transactions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(content),
  });

  const previewResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/transactions/import/preview/') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect((await previewResponse).ok()).toBeTruthy();
  await expect(page.getByText(`${readyRows} row${readyRows === 1 ? '' : 's'} ready to apply.`)).toBeVisible();

  const applyResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/transactions/import/apply/') &&
      response.request().method() === 'POST',
  );
  const authoritativeRefresh = waitForAuthoritativeDataResponse(page, route);
  await page.getByRole('button', { name: 'Apply import' }).click();
  await expect((await applyResponse).ok()).toBeTruthy();
  await authoritativeRefresh;
}

for (const route of routes) {
  test(`${route}: Import preview applies atomically and refreshes authoritative rows`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const importedAccount = `Imported ${route.slice(1)}`;

    await previewAndApplyImport(
      page,
      route,
      `id,account\n${SEEDED_ROWS.enabled},${importedAccount}\n`,
      1,
    );

    const importedRow = rowById(page, SEEDED_ROWS.enabled);
    await expect(importedRow.locator('.ag-cell[col-id="account"]')).toHaveText(importedAccount);
    await expect(page.getByText('Imported 1 transaction.')).toBeVisible();
    await expectNoPageErrors(pageErrors, `${route} Import`);
  });

  test(`${route}: Import refreshes interaction mode, checkbox eligibility and row styling`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const formerlySelectionDisabled = rowById(page, SEEDED_ROWS.selectionDisabled);
    const becomesSelectionDisabled = rowById(page, SEEDED_ROWS.secondEnabled);
    const becomesReadOnly = rowById(page, SEEDED_ROWS.enabled);

    await expect(formerlySelectionDisabled).toHaveClass(/grid-row--selection-disabled/);
    await expect(formerlySelectionDisabled.getByRole('checkbox').first()).toBeDisabled();
    await expect(becomesSelectionDisabled).not.toHaveClass(/grid-row--selection-disabled/);
    await expect(becomesSelectionDisabled.getByRole('checkbox').first()).toBeEnabled();
    await expect(becomesReadOnly).not.toHaveClass(/grid-row--read-only/);
    await expect(becomesReadOnly.getByRole('checkbox').first()).toBeEnabled();

    await previewAndApplyImport(
      page,
      route,
      [
        'id,account,status',
        `${SEEDED_ROWS.selectionDisabled},Treasury,Completed`,
        `${SEEDED_ROWS.secondEnabled},Treasury,Pending`,
        `${SEEDED_ROWS.enabled},Settlement,Completed`,
        '',
      ].join('\n'),
      3,
    );

    // MUI keeps the page behind an open modal out of the accessibility tree. Close the Import dialog
    // before role-based checkbox assertions so this test exercises AG Grid selection, not modal ARIA.
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Import transactions' })).toHaveCount(0);

    // selectionDisabled -> enabled: every visible/native signal must move together. This is the exact
    // regression that previously left cream/grey restricted styling on a now-selectable RowNode.
    await expect(formerlySelectionDisabled).not.toHaveClass(/grid-row--selection-disabled/);
    await expect(formerlySelectionDisabled.getByText('Selection disabled', { exact: true })).toHaveCount(0);
    const enabledCheckbox = formerlySelectionDisabled.getByRole('checkbox').first();
    await expect(enabledCheckbox).toBeEnabled();
    await enabledCheckbox.click();
    await expect(enabledCheckbox).toBeChecked();
    await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();

    // enabled -> selectionDisabled must add the restriction class and disable native selection.
    await expect(becomesSelectionDisabled).toHaveClass(/grid-row--selection-disabled/);
    await expect(becomesSelectionDisabled.getByText('Selection disabled', { exact: true })).toBeVisible();
    await expect(becomesSelectionDisabled.getByRole('checkbox').first()).toBeDisabled();

    // enabled -> readOnly must likewise update row styling and selection eligibility after refresh.
    await expect(becomesReadOnly).toHaveClass(/grid-row--read-only/);
    await expect(becomesReadOnly.getByText('Read only', { exact: true })).toBeVisible();
    await expect(becomesReadOnly.getByRole('checkbox').first()).toBeDisabled();

    await expectNoPageErrors(pageErrors, `${route} Import interaction transition`);
  });
}
