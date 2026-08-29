import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  SEEDED_ROWS,
  accountEditorInput,
  expectNoPageErrors,
  openGrid,
  rowById,
  routes,
  waitForAuthoritativeDataResponse,
  type Route,
} from './gridTestSupport';

async function setLocalAccount(page: Page, value: string) {
  const accountCell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
  await accountCell.dblclick();
  const input = accountEditorInput(page);
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.press('Enter');
  await expect(accountCell).toHaveText(value);
}

async function setRemoteAccount(request: APIRequestContext, value: string) {
  const response = await request.patch(`/api/transactions/${SEEDED_ROWS.enabled}/`, {
    data: { account: value },
  });
  expect(response.ok()).toBeTruthy();
}

/**
 * Use an existing selected business action on another row to drive each root's normal authoritative
 * refresh path. That makes conflict creation an end-to-end integration test instead of reaching into
 * React/tracked-editing state from the browser suite.
 */
async function triggerNormalAuthoritativeRefresh(page: Page, route: Route) {
  await rowById(page, SEEDED_ROWS.secondEnabled).getByRole('checkbox').first().click();

  const selectedAction = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/transactions/selection/') &&
      response.ok(),
  );
  const refreshedRows = waitForAuthoritativeDataResponse(page, route);

  await page.getByRole('button', { name: 'Mark Pending', exact: true }).click();
  await selectedAction;
  await refreshedRows;
}

for (const route of routes) {
  test(`${route}: Use server resolves a real BASE/LOCAL/REMOTE Account conflict`, async ({
    page,
    request,
  }) => {
    const pageErrors = await openGrid(page, route);
    const localValue = `LOCAL ${route.slice(1)}`;
    const remoteValue = `REMOTE ${route.slice(1)}`;

    await setLocalAccount(page, localValue);
    await setRemoteAccount(request, remoteValue);
    await triggerNormalAuthoritativeRefresh(page, route);

    const row = rowById(page, SEEDED_ROWS.enabled);
    const accountCell = row.locator('.ag-cell[col-id="account"]');
    await expect(accountCell).toHaveClass(/grid-cell--edit-conflict/);
    await expect(accountCell).toHaveText(localValue);

    await accountCell.click();
    await expect(page.getByText('Resolve account conflict', { exact: true })).toBeVisible();
    await expect(page.getByText(`Your edit: ${localValue}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Server value: ${remoteValue}`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Use server', exact: true }).click();

    await expect(accountCell).toHaveText(remoteValue);
    await expect(accountCell).not.toHaveClass(/grid-cell--edit-conflict/);
    // Clean rows intentionally render no row Save/Discard controls; the action renderer is dirty-only.
    await expect(row.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0);
    await expect(page.getByText(/0 rows edited total; 0 selected/)).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Use server conflict resolution`);
  });

  test(`${route}: Keep my edit rebases a real conflict and keeps LOCAL dirty`, async ({ page, request }) => {
    const pageErrors = await openGrid(page, route);
    const localValue = `KEEP LOCAL ${route.slice(1)}`;
    const remoteValue = `REMOTE BASE ${route.slice(1)}`;

    await setLocalAccount(page, localValue);
    await setRemoteAccount(request, remoteValue);
    await triggerNormalAuthoritativeRefresh(page, route);

    const accountCell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');
    await expect(accountCell).toHaveClass(/grid-cell--edit-conflict/);
    await accountCell.click();
    await page.getByRole('button', { name: 'Keep my edit', exact: true }).click();

    await expect(accountCell).toHaveText(localValue);
    await expect(accountCell).not.toHaveClass(/grid-cell--edit-conflict/);
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(/1 row edited total; 0 selected/)).toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} Keep my edit conflict resolution`);
  });

  test(`${route}: validation and conflict coexist and Keep my edit preserves the invalid LOCAL draft`, async ({
    page,
    request,
  }) => {
    const pageErrors = await openGrid(page, route);
    const remoteValue = `REMOTE VALID ${route.slice(1)}`;
    const accountCell = rowById(page, SEEDED_ROWS.enabled).locator('.ag-cell[col-id="account"]');

    await setLocalAccount(page, '');
    // The editor helper disappears after commit. A committed invalid LOCAL value is represented by the
    // field-local cell state and tooltip, while the editing controls publish the aggregate error count.
    await expect(accountCell).toHaveClass(/grid-cell--validation-error/);
    await expect(page.getByText(/1 validation error need correction/)).toBeVisible();

    await setRemoteAccount(request, remoteValue);
    await triggerNormalAuthoritativeRefresh(page, route);

    await expect(accountCell).toHaveClass(/grid-cell--validation-error/);
    await expect(accountCell).toHaveClass(/grid-cell--edit-conflict/);
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeDisabled();

    await accountCell.hover();
    await expect(page.getByText(/Validation: Account is required\./)).toBeVisible();

    await accountCell.click();
    await page.getByRole('button', { name: 'Keep my edit', exact: true }).click();

    await expect(accountCell).not.toHaveClass(/grid-cell--edit-conflict/);
    await expect(accountCell).toHaveClass(/grid-cell--validation-error/);
    await expect(
      rowById(page, SEEDED_ROWS.enabled).getByRole('button', { name: 'Save', exact: true }),
    ).toBeDisabled();

    await expectNoPageErrors(pageErrors, `${route} validation + conflict coexistence`);
  });
}
