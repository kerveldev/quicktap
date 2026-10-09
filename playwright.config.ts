import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
    testDir: './tests/Browser',
    fullyParallel: true,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ],
    webServer: {
        command: 'node scripts/serve-test.mjs',
        port: 4173,
        reuseExistingServer: !process.env.CI,
    },
})
