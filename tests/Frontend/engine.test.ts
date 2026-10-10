import { describe, expect, it } from 'vitest'
import {
    advanceTime,
    expireWave,
    GAME_DURATION,
    initialState,
    lifetime,
    nextWave,
    tapBox,
    TARGET_WIDTH,
    TARGET_HEIGHT,
} from '../../resources/js/game/engine'
import { fadeProgress, readAudioSettings } from '../../resources/js/composables/useAudio'

describe('Survival Rush rules', () => {
    it('generates 3–5 unique cells and keeps every target inside its cell', () => {
        const counts = new Set<number>()
        for (let i = 0; i < 300; i++) {
            const state = nextWave(initialState())
            counts.add(state.boxes.length)
            expect(state.lives).toBe(3)
            expect(state.boxes.length).toBeGreaterThanOrEqual(3)
            expect(state.boxes.length).toBeLessThanOrEqual(5)
            expect(new Set(state.boxes.map((box) => box.cell)).size).toBe(state.boxes.length)
            expect(state.boxes.some((box) => box.kind === 'gold')).toBe(true)
            for (const box of state.boxes) {
                expect(box.cell).toBeGreaterThanOrEqual(0)
                expect(box.cell).toBeLessThan(12)
                expect(box.x).toBeGreaterThanOrEqual(0)
                expect(box.x + TARGET_WIDTH).toBeLessThanOrEqual(100)
                expect(box.y).toBeGreaterThanOrEqual(0)
                expect(box.y + TARGET_HEIGHT).toBeLessThanOrEqual(100)
            }
        }
        expect([...counts].sort()).toEqual([3, 4, 5])
    })
    it.each([
        [0, 3000, 5000],
        [14999, 3000, 5000],
        [15000, 2000, 3000],
        [29999, 2000, 3000],
        [30000, 1000, 2000],
        [44999, 1000, 2000],
        [45000, 500, 1000],
        [60000, 500, 1000],
    ])('uses elapsed time %i for the %i–%i ms range', (elapsed, min, max) => {
        expect(lifetime(elapsed, () => 0)).toBe(min)
        expect(lifetime(elapsed, () => 0.999999)).toBeLessThan(max)
        for (let i = 0; i < 100; i++) {
            const value = lifetime(elapsed)
            expect(value).toBeGreaterThanOrEqual(min)
            expect(value).toBeLessThanOrEqual(max)
        }
    })
    it('randomizes each wave independently, not by wave count', () => {
        const state = { ...initialState(), wave: 100, elapsedMs: 20_000 }
        expect(nextWave(state, () => 0).waveDuration).toBe(2000)
        expect(nextWave(state, () => 0.5).waveDuration).toBe(2500)
    })
    it('ends at 60 seconds, freezes time and removes all targets', () => {
        const state = advanceTime(nextWave(initialState()), GAME_DURATION - 1)
        expect(state.over).toBe(false)
        const ended = advanceTime(state, 100)
        expect(ended.elapsedMs).toBe(GAME_DURATION)
        expect(ended.endReason).toBe('time')
        expect(ended.over).toBe(true)
        expect(ended.boxes).toEqual([])
        expect(advanceTime(ended, 5000)).toBe(ended)
        expect(nextWave(ended)).toBe(ended)
    })
    it('expired or ignored gold and TNT never remove lives or reset a combo', () => {
        let state = nextWave(initialState(), () => 0)
        state = tapBox(state, state.boxes[0]!.id)
        for (let i = 0; i < 40; i++) state = expireWave(nextWave(state))
        expect(state.lives).toBe(3)
        expect(state.over).toBe(false)
        expect(state.streak).toBe(1)
        expect(state.boxes).toEqual([])
    })
    it('TNT is consumed once, resets the combo and ends the run after three hits', () => {
        let state = nextWave(initialState(), () => 0)
        state = tapBox(state, state.boxes[0]!.id)
        for (let i = 0; i < 3; i++) {
            state = nextWave(state, () => 0)
            const id = state.boxes.find((box) => box.kind === 'tnt')!.id
            state = tapBox(state, id)
            expect(state.lives).toBe(2 - i)
            expect(tapBox(state, id)).toBe(state)
            expect(state.streak).toBe(0)
        }
        expect(state.over).toBe(true)
        expect(state.endReason).toBe('lives')
        expect(state.highestCombo).toBe(1)
    })
    it('awards each milestone once per ten-hit cycle, keeping the total streak', () => {
        let state = initialState()
        const bonuses: number[] = []
        for (let i = 1; i <= 23; i++) {
            state = nextWave(state, () => 0.5)
            const id = state.boxes[0]!.id
            state = tapBox(state, id)
            bonuses.push(state.lastBonus)
            expect(tapBox(state, id)).toBe(state)
        }
        expect(bonuses).toEqual([
            0, 0, 5, 0, 15, 0, 0, 0, 0, 30, 0, 0, 5, 0, 15, 0, 0, 0, 0, 30, 0, 0, 5,
        ])
        expect(state.score).toBe(335)
        expect(state.coins).toBe(23)
        expect(state.streak).toBe(23)
        expect(state.highestCombo).toBe(23)
        state = nextWave(state, () => 0)
        state = tapBox(state, state.boxes.find((box) => box.kind === 'tnt')!.id)
        for (let i = 0; i < 3; i++) {
            state = nextWave(state)
            state = tapBox(state, state.boxes[0]!.id)
        }
        expect(state.lastBonus).toBe(5)
        expect(state.streak).toBe(3)
        expect(state.highestCombo).toBe(23)
    })
    it('ignores IDs from an expired wave', () => {
        const first = nextWave(initialState())
        const second = nextWave(expireWave(first))
        expect(tapBox(second, first.boxes[0]!.id)).toBe(second)
    })
})
describe('audio preferences', () => {
    it('keeps crossfade volume valid even when a frame timestamp precedes its start', () => {
        expect(fadeProgress(99, 100)).toBe(0)
        expect(fadeProgress(300, 100)).toBe(0.5)
        expect(fadeProgress(900, 100)).toBe(1)
    })
    it('clamps volumes and restores mute', () => {
        expect(
            readAudioSettings({ getItem: () => '{"music":200,"effects":-8,"muted":true}' }),
        ).toEqual({ music: 100, effects: 0, muted: true })
    })
    it('survives invalid or unavailable storage', () => {
        for (const getItem of [
            () => 'broken',
            () => 'null',
            () => {
                throw new Error('denied')
            },
        ]) {
            expect(readAudioSettings({ getItem })).toEqual({ music: 40, effects: 75, muted: false })
        }
    })
})
