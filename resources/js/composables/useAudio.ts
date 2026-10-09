import { onUnmounted, reactive, ref, watch } from 'vue'
export type AudioSettings = { music: number; effects: number; muted: boolean }
export function readAudioSettings(storage: Pick<Storage, 'getItem'>): AudioSettings {
    const defaults = { music: 40, effects: 75, muted: false }
    try {
        const value = JSON.parse(storage.getItem('quicktap.audio') || '{}')
        for (const key of ['music', 'effects'] as const) {
            if (typeof value?.[key] === 'number' && Number.isFinite(value[key]))
                defaults[key] = Math.max(0, Math.min(100, value[key]))
        }
        if (typeof value?.muted === 'boolean') defaults.muted = value.muted
    } catch {
        /* Private browsing or malformed preferences must never block play. */
    }
    return defaults
}

// A frame timestamp can precede performance.now() within the current frame.
export const fadeProgress = (now: number, started: number) =>
    Math.max(0, Math.min(1, (now - started) / 400))

export function useAudio() {
    let defaults: AudioSettings = { music: 40, effects: 75, muted: false }
    try {
        defaults = readAudioSettings(localStorage)
    } catch {
        /* Storage may be disabled. */
    }
    const settings = reactive(defaults)
    const unavailable = ref(false)
    let unlocked = false
    let selected: 'mainscreen' | 'gameplay' = 'mainscreen'
    let animation = 0
    let active = true
    const tracks = {
        mainscreen: new Audio('/assets/sounds/mainscreen.mp3'),
        gameplay: new Audio('/assets/sounds/gameplay.mp3'),
    }
    const gains = { mainscreen: 0, gameplay: 0 }
    const effects = new Set<HTMLAudioElement>()
    for (const track of Object.values(tracks)) {
        track.loop = true
        track.preload = 'none'
        track.volume = 0
        track.addEventListener('error', () => {
            unavailable.value = true
        })
    }
    function volume() {
        for (const key of ['mainscreen', 'gameplay'] as const)
            tracks[key].volume = settings.muted || !active ? 0 : (gains[key] * settings.music) / 100
        for (const effect of effects)
            effect.volume = settings.muted || !active ? 0 : settings.effects / 100
    }
    function play(track: HTMLAudioElement) {
        void track.play().catch(() => {
            /* Retry on the next user gesture. */
        })
    }
    function transition() {
        cancelAnimationFrame(animation)
        if (!unlocked || !active) return
        play(tracks[selected])
        const from = { ...gains },
            started = performance.now()
        function step(now: number) {
            const t = fadeProgress(now, started)
            for (const key of ['mainscreen', 'gameplay'] as const)
                gains[key] = from[key] + ((key === selected ? 1 : 0) - from[key]) * t
            volume()
            if (t < 1) animation = requestAnimationFrame(step)
            else tracks[selected === 'mainscreen' ? 'gameplay' : 'mainscreen'].pause()
        }
        animation = requestAnimationFrame(step)
    }
    function unlock() {
        if (!unlocked) {
            unlocked = true
            transition()
        } else if (tracks[selected].paused) transition()
    }
    function screen(name: 'mainscreen' | 'gameplay') {
        selected = name
        transition()
    }
    function effect(name: 'tap' | 'coin' | 'explosion') {
        if (!unlocked || settings.muted || !active || settings.effects === 0) return
        if (effects.size >= 8) {
            const oldest = effects.values().next().value!
            oldest.pause()
            effects.delete(oldest)
        }
        const audio = new Audio(`/assets/sounds/${name}.mp3`)
        audio.volume = settings.effects / 100
        effects.add(audio)
        const remove = () => effects.delete(audio)
        audio.addEventListener('ended', remove, { once: true })
        audio.addEventListener(
            'error',
            () => {
                unavailable.value = true
                remove()
            },
            { once: true },
        )
        void audio.play().catch(remove)
    }
    function visibility() {
        active = !document.hidden
        if (!active) {
            cancelAnimationFrame(animation)
            Object.values(tracks).forEach((track) => track.pause())
            effects.forEach((effect) => effect.pause())
            effects.clear()
        } else transition()
    }
    watch(settings, () => {
        volume()
        try {
            localStorage.setItem('quicktap.audio', JSON.stringify(settings))
        } catch {
            /* Optional persistence. */
        }
    })
    document.addEventListener('visibilitychange', visibility)
    onUnmounted(() => {
        cancelAnimationFrame(animation)
        Object.values(tracks).forEach((track) => track.pause())
        effects.forEach((effect) => effect.pause())
        document.removeEventListener('visibilitychange', visibility)
    })
    return { settings, unavailable, unlock, screen, effect }
}
