import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.route('**/api/leaderboard', (route) => route.fulfill({ json: { data: [] } }))
})

test('menu, responsive layout, persistent audio preferences and leaderboard errors', async ({
    page,
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/assets/images/kerveldev-logo.png', (route) =>
        route.fulfill({ status: 404, body: '' }),
    )
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Survival Rush' })).toBeVisible()
    await expect(page.locator('.kerveldev-logo')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Visit KerVelDev website' })).toContainText(
        'KerVelDev',
    )
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
    await page.clock.install()
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
    await page.clock.fastForward(2000)
    await expect(page.getByText('Your run is safely paused.')).toBeVisible()
    await page.getByRole('button', { name: 'Back to it' }).click()
    await page.clock.fastForward(60000)
    await expect(page.getByText('FINAL SCORE', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(page.getByRole('button', { name: 'Retry saving' })).toBeVisible()
    await page.getByRole('button', { name: 'Retry saving' }).click()
    await expect(page.getByText('Your run is on the board.')).toBeVisible()
    expect(submissions).toHaveLength(2)
    expect(submissions[0]).toEqual(submissions[1])
    expect(submissions[0]?.player_name).toBe('Luna')
    await page.getByRole('button', { name: 'PLAY AGAIN' }).click()
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

test('survives ignored targets, submits once, and shows the existing leaderboard', async ({
    page,
}) => {
    await page.clock.install()
    let submissions = 0
    let entries: Array<{ id: number; player_name: string; score: number; created_at: string }> = []
    await page.route('**/api/leaderboard', (route) => route.fulfill({ json: { data: entries } }))
    await page.route('**/api/scores', (route) => {
        submissions++
        const body = route.request().postDataJSON()
        entries = [
            {
                id: 7,
                player_name: body.player_name,
                score: body.score,
                created_at: '2026-10-09T12:00:00Z',
            },
        ]
        return route.fulfill({ status: 201, json: { data: entries[0] } })
    })
    await page.goto('/')
    await page.getByLabel('Your player name').fill('RushRunner')
    await page.getByRole('button', { name: 'Let’s play' }).click()
    await expect(page.getByRole('timer')).toContainText('60')
    await page.clock.fastForward(45000)
    await expect(page.locator('.game-screen')).toHaveClass(/urgent/)
    await expect(page.getByText('3 lives remaining', { exact: true })).toBeAttached()
    await page.clock.fastForward(15000)
    await expect(page.getByText('Time’s up — you survived the rush!')).toBeVisible()
    await expect(page.locator('.run-summary')).toContainText('60.0s')
    await expect(page.getByText('Your run is on the board.')).toBeVisible()
    expect(submissions).toBe(1)
    await page.clock.fastForward(60000)
    expect(submissions).toBe(1)
    await expect(page.locator('.target')).toHaveCount(0)
    await page.getByRole('button', { name: 'LEADERBOARD', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Leaderboard', exact: true })).toBeFocused()
    await expect(page.locator('.score-list')).toContainText('RushRunner')
    await expect(page.getByRole('link', { name: 'Visit KerVelDev website' })).toHaveAttribute(
        'href',
        'https://kerveldev.com',
    )
    await page.getByRole('button', { name: 'PLAY AGAIN' }).click()
    await expect(page.getByRole('timer')).toContainText('60')
    await expect(page.locator('.combo-stat strong')).toContainText('0')
    await expect(page.getByText('3 lives remaining', { exact: true })).toBeAttached()
})

test('targets stay separate and in bounds, hearts stay small, and TNT costs one life', async ({
    page,
}) => {
    await page.clock.install()
    // Guarantees two TNT targets alongside the mandatory gold for real DOM interaction checks.
    await page.addInitScript(() => {
        Math.random = () => 0
    })
    let submissions = 0
    await page.route('**/api/scores', (route) => {
        submissions++
        return route.fulfill({
            status: 201,
            json: {
                data: {
                    ...route.request().postDataJSON(),
                    id: 1,
                    created_at: '2026-10-09T12:00:00Z',
                },
            },
        })
    })
    await page.goto('/')
    await page.getByLabel('Your player name').fill('TNTTester')
    await page.getByRole('button', { name: 'Let’s play' }).click()
    await page.clock.runFor(200)
    const arena = await page.locator('.playfield').boundingBox()
    expect(arena!.y).toBeGreaterThanOrEqual(0)
    expect(arena!.y + arena!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    const hearts = await page.locator('.lives .asset-life').evaluateAll((nodes) =>
        nodes.map((node) => ({
            width: node.getBoundingClientRect().width,
            height: node.getBoundingClientRect().height,
        })),
    )
    expect(hearts).toHaveLength(3)
    for (const heart of hearts) {
        expect(heart.width).toBeLessThanOrEqual(24)
        expect(heart.height).toBeLessThanOrEqual(24)
        expect(heart.width).toBeGreaterThan(0)
    }
    for (let wave = 0; wave < 5; wave++) {
        const layout = await page.locator('.playfield').evaluate((field) => {
            const area = field.getBoundingClientRect()
            const boxes = [...field.querySelectorAll('.target')].map((node) =>
                node.getBoundingClientRect(),
            )
            return {
                count: boxes.length,
                inside: boxes.every(
                    (b) =>
                        b.left >= area.left &&
                        b.right <= area.right &&
                        b.top >= area.top &&
                        b.bottom <= area.bottom,
                ),
                separate: boxes.every((a, i) =>
                    boxes.every(
                        (b, j) =>
                            i === j ||
                            a.right <= b.left ||
                            b.right <= a.left ||
                            a.bottom <= b.top ||
                            b.bottom <= a.top,
                    ),
                ),
            }
        })
        expect(layout.count).toBeGreaterThanOrEqual(3)
        expect(layout.count).toBeLessThanOrEqual(5)
        expect(layout.inside).toBe(true)
        expect(layout.separate).toBe(true)
        await page.clock.fastForward(5000)
        await page.clock.runFor(200)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page
        .getByRole('button', { name: 'TNT: avoid this box' })
        .first()
        .evaluate((button) => {
            button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
            button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
    await expect(page.getByText('2 lives remaining', { exact: true })).toBeAttached()
    await page
        .getByRole('button', { name: 'TNT: avoid this box' })
        .first()
        .dispatchEvent('pointerdown')
    await expect(page.getByText('1 lives remaining', { exact: true })).toBeAttached()
    await page.clock.fastForward(5000)
    await page
        .getByRole('button', { name: 'TNT: avoid this box' })
        .first()
        .dispatchEvent('pointerdown')
    await expect(page.getByText('Out of lives — TNT ended your run.')).toBeVisible()
    await expect(page.getByText('Your run is on the board.')).toBeVisible()
    await page.clock.fastForward(60000)
    expect(submissions).toBe(1)
})

test('combo feedback and bonus score are visible with reduced motion enabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.clock.install()
    await page.addInitScript(() => {
        Math.random = () => 0.5
    })
    await page.goto('/')
    await page.getByLabel('Your player name').fill('ComboTester')
    await page.getByRole('button', { name: 'Let’s play' }).click()
    for (let i = 0; i < 3; i++)
        await page
            .getByRole('button', { name: 'Golden box: collect 10 points' })
            .first()
            .dispatchEvent('pointerdown')
    await expect(page.locator('.hud > div').first()).toContainText('35')
    await expect(page.locator('.combo-stat strong')).toContainText('3')
    await expect(page.locator('.game-bottom')).toContainText('+5 combo bonus!')
    expect(
        await page
            .locator('.hit-feedback')
            .evaluate((node) => getComputedStyle(node).animationName),
    ).toBe('none')
    await page.setViewportSize({ width: 320, height: 720 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
