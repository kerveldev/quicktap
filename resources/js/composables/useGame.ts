import { computed, onUnmounted, ref, shallowRef } from 'vue'
import {
    advanceTime,
    GAME_DURATION,
    initialState,
    nextWave,
    tapBox,
    type Box,
} from '../game/engine'

export function useGame(
    onEnd: () => void,
    onTap: (kind: Box['kind'], bonus: number) => void,
    onCountdown: (seconds: number) => void = () => {},
) {
    const state = shallowRef(initialState())
    const running = ref(false)
    const paused = ref(false)
    const waveRemaining = ref(0)
    let lastTick = 0
    let lastSecond = 60
    let timer: ReturnType<typeof setInterval> | undefined
    const duration = computed(() => state.value.waveDuration)
    const remaining = computed(() => GAME_DURATION - state.value.elapsedMs)
    const seconds = computed(() => Math.ceil(remaining.value / 1000))
    const urgent = computed(() => remaining.value <= 15_000 && running.value)
    const progress = computed(() => (remaining.value / GAME_DURATION) * 100)
    const waveProgress = computed(() =>
        duration.value ? (waveRemaining.value / duration.value) * 100 : 0,
    )
    function stop() {
        clearInterval(timer)
        timer = undefined
        running.value = false
    }
    function finish() {
        if (!running.value) return
        stop()
        paused.value = false
        waveRemaining.value = 0
        onEnd()
    }
    function wave() {
        state.value = nextWave(state.value)
        waveRemaining.value = duration.value
    }
    function tick() {
        if (!running.value || paused.value) return
        const now = performance.now()
        const delta = Math.max(0, now - lastTick)
        lastTick = now
        state.value = advanceTime(state.value, delta)
        if (state.value.over) {
            finish()
            return
        }
        waveRemaining.value = Math.max(0, waveRemaining.value - delta)
        if (seconds.value !== lastSecond) {
            lastSecond = seconds.value
            if (lastSecond <= 10) onCountdown(lastSecond)
        }
        if (waveRemaining.value === 0) wave()
    }
    function start() {
        stop()
        state.value = initialState()
        paused.value = false
        running.value = true
        lastTick = performance.now()
        lastSecond = 60
        wave()
        timer = setInterval(tick, 16)
    }
    function tap(id: number) {
        if (!running.value || paused.value) return
        tick() // Expired waves and the 60s deadline take priority over late input.
        const box = state.value.boxes.find((box) => box.id === id)
        if (!box || !running.value) return
        state.value = tapBox(state.value, id)
        onTap(box.kind, state.value.lastBonus)
        if (state.value.over) finish()
    }
    function pause() {
        if (!running.value || paused.value) return
        tick()
        if (running.value) paused.value = true
    }
    function resume() {
        if (running.value && paused.value) {
            lastTick = performance.now()
            paused.value = false
        }
    }
    function visibility() {
        if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', visibility)
    onUnmounted(() => {
        stop()
        document.removeEventListener('visibilitychange', visibility)
    })
    return {
        state,
        running,
        paused,
        duration,
        remaining,
        seconds,
        urgent,
        progress,
        waveProgress,
        start,
        tap,
        pause,
        resume,
        stop,
    }
}
