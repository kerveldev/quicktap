import { describe, expect, it } from 'vitest'
import {
    expireWave,
    initialState,
    lifetime,
    nextWave,
    tapBox,
} from '../../resources/js/game/engine'
import { fadeProgress, readAudioSettings } from '../../resources/js/composables/useAudio'

describe('game rules', () => {
    it('starts with three lives and generates 3–5 non-overlapping targets with gold', () => {
        for (let i = 0; i < 100; i++) {
            const state = nextWave(initialState())
            expect(state.lives).toBe(3)
            expect(state.boxes.length).toBeGreaterThanOrEqual(3)
            expect(state.boxes.length).toBeLessThanOrEqual(5)
            expect(new Set(state.boxes.map((box) => box.cell)).size).toBe(state.boxes.length)
            expect(state.boxes.some((box) => box.kind === 'gold')).toBe(true)
            expect(state.boxes.every((box) => box.cell >= 0 && box.cell < 12)).toBe(true)
        }
    })
    it('collects gold exactly once, awarding a coin and ten points', () => {
        const state = nextWave(initialState(), () => 0.5)
        const id = state.boxes[0]!.id
        const tapped = tapBox(state, id)
        expect(tapped.score).toBe(10)
        expect(tapped.coins).toBe(1)
        expect(tapBox(tapped, id)).toBe(tapped)
    })
    it('TNT removes a life and the third TNT ends the game', () => {
        let state = initialState()
        for (let i = 0; i < 3; i++) {
            state = nextWave(state, () => 0)
            state = tapBox(state, state.boxes.find((box) => box.kind === 'tnt')!.id)
        }
        expect(state.lives).toBe(0)
        expect(state.over).toBe(true)
        expect(state.score).toBe(0)
        expect(nextWave(state)).toBe(state)
        expect(tapBox(state, state.boxes[0]!.id)).toBe(state)
    })
    it('expired gold costs only one life per wave; untouched TNT is harmless', () => {
        const state = nextWave(initialState(), () => 0)
        expect(expireWave(state).lives).toBe(2)
        expect(expireWave(state).boxes).toEqual([])
        const collected = tapBox(state, state.boxes[0]!.id)
        expect(expireWave(collected).lives).toBe(3)
    })
    it('increases difficulty and never goes below half a second', () => {
        expect(lifetime(1)).toBe(1800)
        expect(lifetime(10)).toBeLessThan(lifetime(1))
        expect(lifetime(30)).toBe(500)
        expect(lifetime(10000)).toBe(500)
    })
    it('ends after three missed waves and ignores stale target IDs', () => {
        let state = initialState()
        state = nextWave(state)
        const stale = state.boxes[0]!.id
        state = nextWave(expireWave(state))
        expect(tapBox(state, stale)).toBe(state)
        state = expireWave(state)
        state = expireWave(nextWave(state))
        expect(state.over).toBe(true)
        expect(initialState().score).toBe(0)
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
