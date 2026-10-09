import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.route('**/api/leaderboard', (route) => route.fulfill({ json: { data: [] } }))
})

test('menu, responsive layout, persistent audio preferences and leaderboard errors', async ({
    page,
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Got quick hands?' })).toBeVisible()
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.getByRole('button', { name: 'Audio settings' }).click()
    await page.getByRole('slider', { name: /^Music/ }).fill('15')
    await page.getByRole('slider', { name: /^Sound effects/ }).fill('20')
    await page.getByRole('button', { name: /^Mute all audio/ }).click()
    await page.getByRole('button', { name: 'Close audio settings' }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Audio settings' }).click()
    await expect(page.getByRole('slider', { name: /^Music/ })).toHaveValue('15')
    await expect(page.getByRole('slider', { name: /^Sound effects/ })).toHaveValue('20')
    await expect(page.getByRole('button', { name: /^Unmute all audio/ })).toBeVisible()
    await page.getByRole('button', { name: 'Close audio settings' }).click()
    await page.route('**/api/leaderboard', (route) => route.fulfill({ status: 503, json: {} }))
    await page.getByRole('button', { name: 'Refresh leaderboard' }).click()
    await expect(page.getByText('The board’s taking a breather.')).toBeVisible()
    expect(errors).toEqual([])
})

test('plays, pauses, ends, retries the same score and restarts', async ({ page }) => {
    const submissions: Record<string, unknown>[] = []
    await page.route('**/api/scores', async (route) => {
        const body = route.request().postDataJSON()
        submissions.push(body)
        if (submissions.length === 1) return route.fulfill({ status: 503, json: {} })
        return route.fulfill({
            status: 201,
            json: { data: { ...body, id: 1, created_at: new Date().toISOString() } },
        })
    })
    await page.goto('/')
    await page.getByLabel('Your player name').fill('Luna')
    await page.getByRole('button', { name: 'Let’s play' }).click()
    const count = await page.locator('.target').count()
    expect(count).toBeGreaterThanOrEqual(3)
    expect(count).toBeLessThanOrEqual(5)
    await page
        .getByRole('button', { name: 'Golden box: collect 10 points' })
        .first()
        .dispatchEvent('pointerdown')
    await expect(page.locator('.hud')).toContainText('10')
    await page.getByRole('button', { name: 'Pause game', exact: true }).click()
    await expect(page.getByText('Your run is safely paused.')).toBeVisible()
    await page.waitForTimeout(2000)
    await expect(page.getByText('Your run is safely paused.')).toBeVisible()
    await page.getByRole('button', { name: 'Back to it' }).click()
    await expect(page.getByText('FINAL SCORE', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(page.getByRole('button', { name: 'Retry saving' })).toBeVisible()
    await page.getByRole('button', { name: 'Retry saving' }).click()
    await expect(page.getByText('Your run is on the board.')).toBeVisible()
    expect(submissions).toHaveLength(2)
    expect(submissions[0]).toEqual(submissions[1])
    expect(submissions[0]?.player_name).toBe('Luna')
    await page.getByRole('button', { name: 'Play again' }).click()
    await expect(page.locator('.hud > div').first()).toContainText('0')
})

test('recovers unsaved runs on reload without losing them', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() =>
        localStorage.setItem(
            'quicktap.pending',
            JSON.stringify({
                submission_id: crypto.randomUUID(),
                player_name: 'Previous',
                score: 120,
            }),
        ),
    )
    await page.reload()
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeDisabled()
    await expect(page.getByText('You have an unsaved run.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Discard score', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled()
})
