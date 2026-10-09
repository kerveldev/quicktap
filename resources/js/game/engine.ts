export type Box = { id: number; kind: 'gold' | 'tnt'; cell: number; x: number; y: number }
export type GameState = {
    score: number
    coins: number
    lives: number
    wave: number
    boxes: Box[]
    over: boolean
}
export const initialState = (): GameState => ({
    score: 0,
    coins: 0,
    lives: 3,
    wave: 0,
    boxes: [],
    over: false,
})
export const lifetime = (wave: number) => Math.max(500, 1800 - Math.max(0, wave - 1) * 45)

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
        x: 8 + random() * 16,
        y: 5 + random() * 12,
    }))
    return { ...state, wave, boxes }
}

export function tapBox(state: GameState, id: number): GameState {
    const box = state.boxes.find((box) => box.id === id)
    if (!box || state.over) return state
    const lives = Math.max(0, state.lives - (box.kind === 'tnt' ? 1 : 0))
    return {
        ...state,
        boxes: state.boxes.filter((box) => box.id !== id),
        lives,
        over: lives === 0,
        score: Math.min(1000000, state.score + (box.kind === 'gold' ? 10 : 0)),
        coins: state.coins + (box.kind === 'gold' ? 1 : 0),
    }
}

export function expireWave(state: GameState): GameState {
    if (state.over) return state
    // At most one life lost per wave, so simultaneous expiry is never an instant loss.
    const lives = Math.max(
        0,
        state.lives - (state.boxes.some((box) => box.kind === 'gold') ? 1 : 0),
    )
    return { ...state, boxes: [], lives, over: lives === 0 }
}
