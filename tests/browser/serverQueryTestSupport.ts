import type { Page, Response } from '@playwright/test';
import { expect } from './fixtures';

export type QueryBody = {
  offset?: number;
  limit?: number;
  sort?: Array<{ field?: string; direction?: string }>;
  filters?: Array<{ field?: string; operator?: string; value?: unknown }>;
};

export function readQueryBody(response: Response): QueryBody | undefined {
  if (
    response.request().method() !== 'POST' ||
    !response.url().endsWith('/api/transactions/query/')
  ) {
    return undefined;
  }

  return response.request().postDataJSON() as QueryBody;
}

/** Apply the configured single-condition Status filter through AG Grid's real filter popup. */
export async function applyStatusFilter(page: Page, value: string) {
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
