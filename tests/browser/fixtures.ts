import { expect, test as base } from '@playwright/test';

type BrowserFixtures = {
  /** Auto fixture: every browser test starts from the same authoritative Transaction dataset. */
  resetE2EData: undefined;
};

/**
 * Repository browser-test base.
 *
 * Import `test` from this file, not directly from `@playwright/test`. The automatic fixture resets the
 * single Django process before every test (and every retry), so mutations from Save/selected actions
 * can never leak into the next scenario. Future DB-backed E2E setup can keep this fixture unchanged
 * while the backend reset implementation switches from rebuilding the Python list to seeding a test DB.
 */
export const test = base.extend<BrowserFixtures>({
  resetE2EData: [
    async ({ request }, use) => {
      const response = await request.post('/api/transactions/__e2e__/reset/');
      expect(response.ok(), 'E2E Transaction reset endpoint must succeed before a browser test').toBeTruthy();
      expect(await response.json()).toEqual({ rowCount: 750 });
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
