import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { cleanup } = vi.hoisted(() => ({ cleanup: [] as Array<() => void> }))
vi.mock('vue', async (importOriginal) => ({
    ...(await importOriginal<typeof import('vue')>()),
    onUnmounted: (fn: () => void) => cleanup.push(fn),
}))
import { useGame } from '../../resources/js/composables/useGame'

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
    vi.spyOn(Math, 'random').mockReturnValue(0)
})
afterEach(() => {
    cleanup.splice(0).forEach((fn) => fn())
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
describe('game lifecycle', () => {
    it('finishes exactly once at 60 seconds and leaves no timer running', () => {
        const end = vi.fn(),
            countdown = vi.fn()
        const game = useGame(end, vi.fn(), countdown)
        game.start()
        vi.advanceTimersByTime(59999)
        expect(end).not.toHaveBeenCalled()
        expect(game.state.value.lives).toBe(3)
        vi.advanceTimersByTime(1)
        expect(end).toHaveBeenCalledTimes(1)
        expect(game.seconds.value).toBe(0)
        expect(game.running.value).toBe(false)
        expect(vi.getTimerCount()).toBe(0)
        expect(countdown.mock.calls.map((call) => call[0])).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
        const snapshot = game.state.value
        vi.advanceTimersByTime(60000)
        game.tap(100)
        expect(game.state.value).toBe(snapshot)
        expect(end).toHaveBeenCalledTimes(1)
    })
    it('finishes once on TNT, rejects repeated taps, and resets all state on restart', () => {
        const end = vi.fn(),
            tap = vi.fn(),
            game = useGame(end, tap)
        game.start()
        game.tap(game.state.value.boxes[0]!.id)
        for (let i = 0; i < 3; i++) {
            let bomb = game.state.value.boxes.find((box) => box.kind === 'tnt')
            if (!bomb) {
                vi.advanceTimersByTime(3100)
                bomb = game.state.value.boxes.find((box) => box.kind === 'tnt')
            }
            game.tap(bomb!.id)
            game.tap(bomb!.id)
        }
        expect(game.state.value.lives).toBe(0)
        expect(game.state.value.endReason).toBe('lives')
        expect(end).toHaveBeenCalledTimes(1)
        expect(tap).toHaveBeenCalledTimes(4)
        expect(vi.getTimerCount()).toBe(0)
        game.start()
        expect(game.state.value).toMatchObject({
            score: 0,
            coins: 0,
            lives: 3,
            streak: 0,
            highestCombo: 0,
            lastBonus: 0,
            elapsedMs: 0,
            over: false,
            endReason: null,
            wave: 1,
        })
        expect(game.seconds.value).toBe(60)
        expect(game.paused.value).toBe(false)
        expect(vi.getTimerCount()).toBe(1)
    })
    it('pauses both clocks, including when hidden, and cleans up on unmount', () => {
        const end = vi.fn(),
            game = useGame(end, vi.fn())
        game.start()
        vi.advanceTimersByTime(1000)
        game.pause()
        const time = game.remaining.value,
            wave = game.waveProgress.value
        vi.advanceTimersByTime(60000)
        expect(game.remaining.value).toBe(time)
        expect(game.waveProgress.value).toBe(wave)
        game.resume()
        vi.advanceTimersByTime(1000)
        Object.defineProperty(document, 'hidden', { value: true })
        document.dispatchEvent(new Event('visibilitychange'))
        expect(game.paused.value).toBe(true)
        cleanup.splice(0).forEach((fn) => fn())
        vi.advanceTimersByTime(60000)
        expect(end).not.toHaveBeenCalled()
    })
    it('rejects a tap at the time limit even before the next interval fires', () => {
        const end = vi.fn(),
            game = useGame(end, vi.fn())
        game.start()
        const id = game.state.value.boxes[0]!.id
        vi.spyOn(performance, 'now').mockReturnValue(60000)
        game.tap(id)
        expect(game.state.value.score).toBe(0)
        expect(end).toHaveBeenCalledTimes(1)
    })
})
