import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { SEEDED_ROWS, expectNoPageErrors, rowById } from './gridTestSupport';

for (const route of ['/infinite', '/ssrm'] as const) {
  test(`${route}: failed initial query shows grid error overlay and Retry recovers`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    let queryCount = 0;

    await page.route('**/api/transactions/query/', async (routeHandler) => {
      if (routeHandler.request().method() !== 'POST') {
        await routeHandler.continue();
        return;
      }

      queryCount += 1;
      if (queryCount === 1) {
        await routeHandler.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Intentional E2E load failure' }),
        });
        return;
      }

      await routeHandler.continue();
    });

    await page.goto(route);
    const errorOverlay = page.getByRole('alert').filter({ hasText: 'Unable to load data' });
    await expect(errorOverlay).toBeVisible();
    await expect(errorOverlay.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();

    const successfulRetry = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/transactions/query/') &&
        response.ok(),
    );
    await errorOverlay.getByRole('button', { name: 'Retry', exact: true }).click();
    await successfulRetry;

    await expect(rowById(page, SEEDED_ROWS.enabled)).toBeVisible();
    await expect(errorOverlay).not.toBeVisible();
    expect(queryCount).toBeGreaterThanOrEqual(2);

    await expectNoPageErrors(pageErrors, `${route} load error Retry`);
  });
}
