import { expect, test as base } from '@playwright/test';

type BrowserFixtures = {
  /** Auto fixture: every browser test starts from the same authoritative mutable demo datasets. */
  resetE2EData: undefined;
};

/**
 * Repository browser-test base.
 *
 * Import `test` from this file, not directly from `@playwright/test`. The automatic fixture resets the
 * single Django process before every test (and every retry), so mutations from Save/selected actions
 * cannot leak into later scenarios. Transaction and configurable Review currently own separate
 * in-memory sources, so both reset boundaries are invoked here.
 *
 * Future DB-backed E2E setup can keep this fixture contract while the backend reset implementations
 * switch from rebuilding Python lists to seeding dedicated test datastores.
 */
export const test = base.extend<BrowserFixtures>({
  resetE2EData: [
    async ({ request }, use) => {
      const transactionResponse = await request.post('/api/transactions/__e2e__/reset/');
      expect(
        transactionResponse.ok(),
        'E2E Transaction reset endpoint must succeed before a browser test',
      ).toBeTruthy();
      expect(await transactionResponse.json()).toEqual({ rowCount: 750 });

      const reviewResponse = await request.post('/api/review/__e2e__/reset/');
      expect(
        reviewResponse.ok(),
        'E2E Review reset endpoint must succeed before a browser test',
      ).toBeTruthy();
      expect(await reviewResponse.json()).toEqual({
        loanRowCount: 180,
        financeRowCount: 210,
      });

      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
