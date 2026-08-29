import { expect, test } from './fixtures';
import { expectNoPageErrors, openGrid, rowById } from './gridTestSupport';
import { applyStatusFilter, readQueryBody } from './serverQueryTestSupport';

for (const route of ['/infinite', '/ssrm'] as const) {
  test(`${route}: Reference sort maps through the real query API and reorders rows`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);
    const headerLabel = page
      .locator('.ag-header-cell[col-id="reference"]')
      .locator('.ag-header-cell-label');

    const ascendingResponse = page.waitForResponse((response) => {
      const body = readQueryBody(response);
      return (
        response.ok() &&
        body?.sort?.[0]?.field === 'reference' &&
        body.sort[0].direction === 'asc'
      );
    });
    await headerLabel.click();
    await ascendingResponse;

    const descendingResponse = page.waitForResponse((response) => {
      const body = readQueryBody(response);
      return (
        response.ok() &&
        body?.offset === 0 &&
        body.limit === 50 &&
        body.sort?.[0]?.field === 'reference' &&
        body.sort[0].direction === 'desc'
      );
    });
    await headerLabel.click();
    const response = await descendingResponse;

    expect(readQueryBody(response)?.filters ?? []).toEqual([]);
    await expect(rowById(page, 'txn-00750')).toBeVisible();
    await expect(rowById(page, 'txn-00750').locator('.ag-cell[col-id="reference"]')).toHaveText(
      'TRX-100749',
    );

    await expectNoPageErrors(pageErrors, `${route} server sort lifecycle`);
  });

  test(`${route}: Status filter maps through the real query API and displays only matches`, async ({ page }) => {
    const pageErrors = await openGrid(page, route);

    const filteredResponse = page.waitForResponse((response) => {
      const body = readQueryBody(response);
      const filter = body?.filters?.[0];
      return (
        response.ok() &&
        body?.offset === 0 &&
        body.limit === 50 &&
        body.filters?.length === 1 &&
        filter?.field === 'status' &&
        filter.operator === 'contains' &&
        filter.value === 'Pending'
      );
    });

    await applyStatusFilter(page, 'Pending');
    await filteredResponse;

    await expect(rowById(page, 'txn-00002')).toBeVisible();
    await expect(rowById(page, 'txn-00005')).toBeVisible();
    await expect(rowById(page, 'txn-00001')).not.toBeVisible();

    await expectNoPageErrors(pageErrors, `${route} server filter lifecycle`);
  });
}
