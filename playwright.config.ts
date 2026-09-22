import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

const qaEnv = loadEnv('qa', process.cwd(), 'QA_');
Object.assign(process.env, qaEnv);

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:8080';

export default defineConfig({
  testDir: './qa/tests',

  timeout: 45_000,

  expect: {
    timeout: 8_000,
  },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [['list'], ['html', { outputFolder: 'qa-report', open: 'never' }]],

  outputDir: 'qa-results',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  webServer: process.env.QA_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 8080',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },

  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: 1440,
          height: 900,
        },
      },
    },

    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
