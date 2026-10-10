export const GAME_DURATION = 60_000
export const TARGET_WIDTH = 72
export const TARGET_HEIGHT = 78
export type Box = { id: number; kind: 'gold' | 'tnt'; cell: number; x: number; y: number }
export type EndReason = 'time' | 'lives'
export type GameState = {
    score: number
    coins: number
    lives: number
    wave: number
    boxes: Box[]
    over: boolean
    elapsedMs: number
    waveDuration: number
    streak: number
    highestCombo: number
    lastBonus: number
    endReason: EndReason | null
}
export const initialState = (): GameState => ({
    score: 0,
    coins: 0,
    lives: 3,
    wave: 0,
    boxes: [],
    over: false,
    elapsedMs: 0,
    waveDuration: 0,
    streak: 0,
    highestCombo: 0,
    lastBonus: 0,
    endReason: null,
})
export function difficulty(elapsedMs: number): number {
    return Math.min(3, Math.floor(Math.max(0, elapsedMs) / 15_000))
}
export function lifetime(elapsedMs: number, random = Math.random): number {
    const [min, max] = [
        [3000, 5000],
        [2000, 3000],
        [1000, 2000],
        [500, 1000],
    ][difficulty(elapsedMs)]!
    return min! + random() * (max! - min!)
}
export function endGame(state: GameState, reason: EndReason): GameState {
    if (state.over) return state
    return { ...state, over: true, boxes: [], endReason: reason }
}
export function advanceTime(state: GameState, deltaMs: number): GameState {
    if (state.over) return state
    const next = {
        ...state,
        elapsedMs: Math.min(GAME_DURATION, state.elapsedMs + Math.max(0, deltaMs)),
    }
    return next.elapsedMs >= GAME_DURATION ? endGame(next, 'time') : next
}
export function nextWave(state: GameState, random = Math.random): GameState {
    if (state.over) return state
    const cells = Array.from({ length: 12 }, (_, i) => i)
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[cells[i], cells[j]] = [cells[j]!, cells[i]!]
    }
    const wave = state.wave + 1
    const count = 3 + Math.floor(random() * 3)
    const boxes = cells.slice(0, count).map((cell, i): Box => ({
        id: wave * 100 + i,
        kind: i === 0 || random() > 0.3 ? 'gold' : 'tnt',
        cell,
        // CSS target size is 72% × 78%; these offsets keep it inside its own cell.
        x: 8 + random() * 16,
        y: 5 + random() * 12,
    }))
    return { ...state, wave, boxes, waveDuration: lifetime(state.elapsedMs, random) }
}
export function tapBox(state: GameState, id: number): GameState {
    const box = state.boxes.find((box) => box.id === id)
    if (!box || state.over) return state
    const gold = box.kind === 'gold'
    const lives = Math.max(0, state.lives - (gold ? 0 : 1))
    const streak = gold ? state.streak + 1 : 0
    const milestone = streak % 10
    const bonus = gold ? (milestone === 3 ? 5 : milestone === 5 ? 15 : milestone === 0 ? 30 : 0) : 0
    const next = {
        ...state,
        boxes: state.boxes.filter((box) => box.id !== id),
        lives,
        streak,
        highestCombo: Math.max(state.highestCombo, streak),
        lastBonus: bonus,
        score: Math.min(1_000_000, state.score + (gold ? 10 + bonus : 0)),
        coins: state.coins + (gold ? 1 : 0),
    }
    return lives === 0 ? endGame(next, 'lives') : next
}
export function expireWave(state: GameState): GameState {
    return state.over ? state : { ...state, boxes: [] }
}
