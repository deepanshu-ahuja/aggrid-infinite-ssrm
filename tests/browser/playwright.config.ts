import { defineConfig, devices } from '@playwright/test';

const configuredSlowMo = Number.parseInt(process.env.PLAYWRIGHT_SLOW_MO ?? '0', 10);
const launchOptions =
  Number.isFinite(configuredSlowMo) && configuredSlowMo > 0
    ? { slowMo: configuredSlowMo }
    : undefined;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions,
    ...devices['Desktop Chrome'],
    viewport: { width: 1800, height: 1000 },
  },
});
