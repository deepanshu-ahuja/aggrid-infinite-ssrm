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

async function editAccount(page: Page, value: string) {
  const cell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
  await cell.dblclick();
  const input = accountEditorInput(page);
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.press('Enter');
  return cell;
}

for (const route of routes) {
  test(`${route}: correcting then reverting an invalid Account clears validation and LOCAL dirty state`, async ({
    page,
  }) => {
    const pageErrors = await openGrid(page, route);
    const cell = await editAccount(page, '');

    await expect(cell).toHaveClass(/grid-cell--validation-error/);
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeDisabled();

    await editAccount(page, `Corrected ${route.slice(1)}`);
    await expect(cell).not.toHaveClass(/grid-cell--validation-error/);
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeEnabled();

    // Returning exactly to BASE removes the LOCAL draft instead of leaving a clean-but-dirty copy.
    await editAccount(page, 'Operating');
    await expect(cell).not.toHaveClass(/grid-cell--validation-error/);
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(/0 rows edited total; 0 selected/)).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} validation correction and BASE revert`);
  });

  test(`${route}: backend field rejection keeps LOCAL visible and maps the server message to the cell`, async ({
    page,
  }) => {
    const pageErrors = await openGrid(page, route);
    const localValue = `Rejected ${route.slice(1)}`;
    const cell = await editAccount(page, localValue);

    await page.route(`**/api/transactions/${SEEDED_ROWS.enabled}/`, async (routeHandler) => {
      if (routeHandler.request().method() !== 'PATCH') {
        await routeHandler.continue();
        return;
      }
      await routeHandler.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ account: ['Server rejected this account.'] }),
      });
    });

    await rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }).click();

    await expect(cell).toHaveText(localValue);
    await expect(cell).toHaveClass(/grid-cell--validation-error/);
    await expect(page.getByText(/1 validation error needs correction/)).toBeVisible();
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeDisabled();

    // The committed cell owns the backend message through the same AG Grid tooltip presentation used
    // for client validation errors; this proves the reason is not reduced to a red border only.
    await cell.hover();
    await expect(page.getByText('Validation: Server rejected this account.', { exact: true })).toBeVisible({
      timeout: 5_000,
    });

    await expectNoPageErrors(pageErrors, `${route} backend validation rejection`);
  });
}
