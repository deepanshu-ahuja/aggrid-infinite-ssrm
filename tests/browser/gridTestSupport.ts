import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export const routes = ['/client', '/infinite', '/ssrm'] as const;
export type Route = (typeof routes)[number];

export const SEEDED_ROWS = {
  enabled: 'txn-00001',
  selectionDisabled: 'txn-00002',
  secondEnabled: 'txn-00003',
  readOnly: 'txn-00004',
} as const;

export function rowById(page: Page, rowId: string) {
  return page.locator(`.ag-row[row-id="${rowId}"]`);
}

export function accountEditorInput(page: Page) {
  return page.getByTestId('transaction-account-editor-input');
}

export function dateEditorInput(page: Page) {
  return page.getByTestId('transaction-date-editor-input');
}

function isAuthoritativeDataResponse(route: Route, responseUrl: string, method: string) {
  if (route === '/client') {
    return method === 'GET' && responseUrl.endsWith('/api/transactions/');
  }
  return method === 'POST' && responseUrl.endsWith('/api/transactions/query/');
}

export function waitForAuthoritativeDataResponse(page: Page, route: Route) {
  return page.waitForResponse(
    (response) =>
      isAuthoritativeDataResponse(route, response.url(), response.request().method()) && response.ok(),
  );
}

/**
 * Open one real grid route only after its first authoritative Transaction response has completed.
 * This is stronger than waiting for any `.ag-row`, which can match a transient/loading RowNode in the
 * server-backed models. Known seeded IDs then prove AG Grid has materialised concrete business rows.
 */
export async function openGrid(page: Page, route: Route) {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  const initialData = waitForAuthoritativeDataResponse(page, route);

  await page.goto(route);
  await initialData;
  await expect(page.locator('.ag-root')).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.enabled)).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.selectionDisabled)).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.secondEnabled)).toBeVisible();
  await expect(rowById(page, SEEDED_ROWS.readOnly)).toBeVisible();

  return pageErrors;
}

export async function expectNoPageErrors(errors: Error[], scenario: string) {
  expect(errors.map((error) => error.message), `${scenario} produced page errors`).toEqual([]);
}
