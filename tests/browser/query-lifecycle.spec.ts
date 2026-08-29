import type { Page, Response } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoPageErrors, openGrid, rowById } from './gridTestSupport';

type QueryBody = {
  offset?: number;
  limit?: number;
  sort?: Array<{ field?: string; direction?: string }>;
  filters?: Array<{ field?: string; operator?: string; value?: unknown }>;
};

function readQueryBody(response: Response): QueryBody | undefined {
  if (
    response.request().method() !== 'POST' ||
    !response.url().endsWith('/api/transactions/query/')
  ) {
    return undefined;
  }

  return response.request().postDataJSON() as QueryBody;
}

async function applyStatusFilter(page: Page, value: string) {
  const header = page.locator('.ag-header-cell[col-id="status"]');
  await header.hover();

  // AG Grid may expose a dedicated filter button or the column-menu button depending on its current
  // header/menu presentation. Both are native AG Grid controls; prefer the dedicated filter button.
  const directFilterButton = header.locator('.ag-header-cell-filter-button:visible').first();
  if (await directFilterButton.count()) {
    await directFilterButton.click();
  } else {
    await header.locator('.ag-header-cell-menu-button:visible').first().click();
  }

  const filterInput = page.locator('.ag-filter-body-wrapper input').first();
  await expect(filterInput).toBeVisible();
  await filterInput.fill(value);

  const applyButton = page.locator('.ag-filter-apply-panel').getByRole('button', {
    name: 'Apply',
    exact: true,
  });
  await expect(applyButton).toBeVisible();
  await applyButton.click();
}

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

export { applyStatusFilter, readQueryBody };
