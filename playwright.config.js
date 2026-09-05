const { defineConfig } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { releaseId } = require('./tests/browser/release');

process.env.TMPDIR = path.join(__dirname, '.playwright-runtime');
fs.mkdirSync(process.env.TMPDIR, { recursive: true });

module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: [['list']],
  outputDir: path.join(__dirname, 'test-results', releaseId),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
