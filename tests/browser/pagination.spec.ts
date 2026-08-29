import { expect, test } from './fixtures';
import { expectNoPageErrors, openGrid, rowById, routes } from './gridTestSupport';

for (const route of routes) {
  test(`${route}: pagination moves across exact 25-row page boundaries`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const nextPage = page.getByLabel('Next Page', { exact: true });

    await nextPage.click();
    await expect(rowById(page, 'txn-00026')).toBeVisible();

    if (route === '/client') {
      await nextPage.click();
    } else {
      // Page three is the first page that needs the second 50-row server block. Waiting for the
      // mapped offset proves pagination is not being confused with cache/store block boundaries.
      const secondBlock = page.waitForResponse((response) => {
        if (
          response.request().method() !== 'POST' ||
          !response.url().endsWith('/api/transactions/query/') ||
          !response.ok()
        ) {
          return false;
        }

        const body = response.request().postDataJSON() as { offset?: number; limit?: number };
        return body.offset === 50 && body.limit === 50;
      });

      await nextPage.click();
      await secondBlock;
    }

    await expect(rowById(page, 'txn-00051')).toBeVisible();
    await expect(rowById(page, 'txn-00001')).not.toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} pagination boundaries`);
  });
}
