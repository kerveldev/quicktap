import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { expireWave, initialState, lifetime, nextWave, tapBox, type Box } from '../game/engine'

export function useGame(onEnd: () => void, onTap: (kind: Box['kind']) => void) {
    const state = shallowRef(initialState())
    const running = ref(false)
    const paused = ref(false)
    const remaining = ref(1800)
    let deadline = 0
    let timer: ReturnType<typeof setInterval> | undefined
    const duration = computed(() => lifetime(state.value.wave))
    const progress = computed(() => Math.max(0, (remaining.value / duration.value) * 100))
    function stop() {
        clearInterval(timer)
        timer = undefined
        running.value = false
    }
    function finish() {
        stop()
        onEnd()
    }
    function wave() {
        state.value = nextWave(state.value)
        remaining.value = duration.value
        deadline = performance.now() + remaining.value
    }
    function tick() {
        if (!running.value || paused.value) return
        remaining.value = Math.max(0, deadline - performance.now())
        if (remaining.value > 0) return
        state.value = expireWave(state.value)
        if (state.value.over) finish()
        else wave()
    }
    function start() {
        stop()
        state.value = initialState()
        paused.value = false
        running.value = true
        wave()
        timer = setInterval(tick, 16)
    }
    function tap(id: number) {
        if (!running.value || paused.value) return
        tick() // Never accept a click against an already-expired wave.
        const box = state.value.boxes.find((box) => box.id === id)
        if (!box || !running.value) return
        state.value = tapBox(state.value, id)
        onTap(box.kind)
        if (state.value.over) finish()
    }
    function pause() {
        if (!running.value || paused.value) return
        tick()
        if (running.value) {
            remaining.value = Math.max(0, deadline - performance.now())
            paused.value = true
        }
    }
    function resume() {
        if (running.value && paused.value) {
            deadline = performance.now() + remaining.value
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
    return { state, running, paused, duration, progress, start, tap, pause, resume, stop }
}
