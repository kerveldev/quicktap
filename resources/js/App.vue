<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import GameAsset from './components/GameAsset.vue'
import UiIcon from './components/UiIcon.vue'
import { useAudio } from './composables/useAudio'
import { useGame } from './composables/useGame'
import { getLeaderboard, saveScore, type Score, type Submission } from './services/api'

const screen = ref<'menu' | 'game' | 'over'>('menu')
const player = ref('')
const nameError = ref('')
const audio = useAudio()
const settingsOpen = ref(false)
const scores = ref<Score[]>([])
const loading = ref(false)
const leaderboardError = ref('')
const saving = ref(false)
const saveMessage = ref('')
const saveFailed = ref(false)
const pending = ref<Submission | null>(null)
const savedId = ref<number | null>(null)
const best = ref(0)
const feedback = ref('')
const heading = ref<HTMLElement>()
const settingsButton = ref<HTMLButtonElement>()
const settingsPanel = ref<HTMLElement>()
const game = useGame(endGame, (kind) => {
    audio.effect(kind === 'gold' ? 'coin' : 'explosion')
    feedback.value = kind === 'gold' ? '+10 points' : 'TNT! −1 life'
})
const { state, paused, duration, progress } = game
const level = computed(() => Math.floor((state.value.wave - 1) / 5) + 1)
const formattedScore = computed(() => state.value.score.toLocaleString())

async function refreshLeaderboard() {
    if (loading.value) return
    loading.value = true
    leaderboardError.value = ''
    try {
        scores.value = await getLeaderboard()
    } catch (error) {
        leaderboardError.value =
            error instanceof Error && error.name === 'Error'
                ? error.message
                : 'Could not reach the leaderboard. Try again shortly.'
    } finally {
        loading.value = false
    }
}
async function submit() {
    if (!pending.value || saving.value) return
    saving.value = true
    saveFailed.value = false
    saveMessage.value = 'Saving your run…'
    try {
        const result = await saveScore(pending.value)
        savedId.value = result.id
        pending.value = null
        saveMessage.value = 'Your run is on the board.'
        try {
            localStorage.removeItem('quicktap.pending')
        } catch {
            /* Optional recovery. */
        }
        await refreshLeaderboard()
    } catch (error) {
        saveFailed.value = true
        saveMessage.value =
            error instanceof Error && error.name === 'Error'
                ? error.message
                : 'Score not saved. Check your connection and retry.'
    } finally {
        saving.value = false
    }
}
function start() {
    audio.unlock()
    player.value = player.value.trim()
    if (!/^[\p{L}\p{N} _.-]{1,24}$/u.test(player.value)) {
        nameError.value = 'Use 1–24 letters, numbers, spaces, dots, dashes or underscores.'
        return
    }
    if (pending.value) return
    nameError.value = ''
    feedback.value = ''
    saveMessage.value = ''
    savedId.value = null
    try {
        localStorage.setItem('quicktap.player', player.value)
    } catch {
        /* Optional preference. */
    }
    audio.effect('tap')
    audio.screen('gameplay')
    screen.value = 'game'
    game.start()
}
function endGame() {
    screen.value = 'over'
    audio.screen('mainscreen')
    best.value = Math.max(best.value, state.value.score)
    pending.value = {
        submission_id: crypto.randomUUID(),
        player_name: player.value,
        score: state.value.score,
    }
    try {
        localStorage.setItem('quicktap.best', String(best.value))
        localStorage.setItem('quicktap.pending', JSON.stringify(pending.value))
    } catch {
        /* Keep in memory. */
    }
    void submit()
}
function discard() {
    pending.value = null
    saveFailed.value = false
    saveMessage.value = ''
    try {
        localStorage.removeItem('quicktap.pending')
    } catch {
        /* Optional recovery. */
    }
}
function menu() {
    game.stop()
    screen.value = 'menu'
    audio.screen('mainscreen')
    audio.effect('tap')
}
function togglePause() {
    if (paused.value) {
        game.resume()
        audio.screen('gameplay')
    } else {
        game.pause()
        audio.screen('mainscreen')
    }
}
async function toggleSettings() {
    audio.unlock()
    settingsOpen.value = !settingsOpen.value
    if (settingsOpen.value) {
        if (screen.value === 'game') game.pause()
        await nextTick()
        settingsPanel.value?.focus()
    } else {
        await nextTick()
        settingsButton.value?.focus()
    }
}
function settingsKeys(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        event.preventDefault()
        void toggleSettings()
    }
    if (event.key !== 'Tab') return
    const nodes = settingsPanel.value?.querySelectorAll<HTMLElement>('button, input')
    if (!nodes?.length) return
    const first = nodes[0]!,
        last = nodes[nodes.length - 1]!
    if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === settingsPanel.value)
    ) {
        event.preventDefault()
        last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
    }
}
watch(screen, async () => {
    await nextTick()
    heading.value?.focus()
})
watch(paused, (value) => {
    if (screen.value === 'game') audio.screen(value ? 'mainscreen' : 'gameplay')
})
onMounted(() => {
    try {
        player.value = localStorage.getItem('quicktap.player')?.slice(0, 24) || ''
        best.value = Math.max(0, Number(localStorage.getItem('quicktap.best')) || 0)
        const recovered = JSON.parse(localStorage.getItem('quicktap.pending') || 'null')
        if (
            recovered &&
            typeof recovered.submission_id === 'string' &&
            typeof recovered.player_name === 'string' &&
            Number.isInteger(recovered.score)
        ) {
            pending.value = recovered
            saveFailed.value = true
            saveMessage.value = 'You have an unsaved run. Retry saving it or discard it to play.'
        }
    } catch {
        /* The game works without local storage. */
    }
    void refreshLeaderboard()
})
</script>

<template>
    <div class="app-shell" @pointerdown.capture="audio.unlock" @keydown.capture="audio.unlock">
        <header class="topbar">
            <a class="brand" href="/" aria-label="QuickTap home"><span
                    class="brand-icon">ϟ</span>quick<span>tap</span><span class="brand-dot">®</span></a>
            <div class="topbar-right">
                <span class="edition">THE REFLEX ARCADE <span>VOL. 001</span></span><button ref="settingsButton"
                    class="icon-button" aria-label="Audio settings" @click="toggleSettings">
                    ☷</button><button class="icon-button"
                    :aria-label="audio.settings.muted ? 'Unmute audio' : 'Mute audio'"
                    :aria-pressed="audio.settings.muted" @click="audio.settings.muted = !audio.settings.muted">
                    {{ audio.settings.muted ? '♪̸' : '♫' }}
                </button>
            </div>
        </header>

        <main>
            <div class="section-label">
                <span class="status-dot"></span> SMALL GAME. BIG REFLEX ENERGY.
                <span class="label-right">EST. 2026 / PLAY ANYWHERE</span>
            </div>
            <div class="main-layout">
                <section class="arcade-column">
                    <div class="intro">
                        <div>
                            <p class="eyebrow">YOUR NEXT “JUST ONE MORE.”</p>
                            <h1>
                                Make every <br /><span>tap count.</span><span class="heading-spark">✳</span>
                            </h1>
                        </div>
                        <p class="intro-copy">
                            Chase the gold. Dodge the TNT. <br />How quick are your hands?
                        </p>
                    </div>

                    <section class="arcade" :class="{ 'is-playing': screen === 'game' }" aria-label="QuickTap arcade">
                        <div class="arcade-top">
                            <span><i class="status-dot"></i>
                                {{
                                    screen === 'game'
                                        ? paused
                                            ? 'PAUSED'
                                            : 'LIVE SESSION'
                                        : 'QUICKTAP / CLASSIC'
                                }}</span><span>{{
                                    screen === 'game'
                                        ? `LEVEL ${level.toString().padStart(2, '0')}`
                                        : '3 LIVES. NO SECOND GUESSES.'
                                }}</span>
                        </div>
                        <div v-if="screen === 'menu'" class="menu-screen">
                            <div class="hero-art" aria-hidden="true">
                                <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span
                                    class="art-plus plus-one">+</span><span class="art-plus plus-two">✧</span>
                                <GameAsset name="coin" class="floating-coin" />
                                <GameAsset name="box" class="hero-box" /><span class="art-tag">+10 PTS</span>
                                <GameAsset name="bomb" class="hero-bomb" />
                            </div>
                            <p class="eyebrow lime">READY WHEN YOU ARE</p>
                            <h2 ref="heading" tabindex="-1">Got quick hands?</h2>
                            <p class="screen-copy">
                                A little focus. A lot of gold. Let’s find your high score.
                            </p>
                            <form class="start-form" @submit.prevent="start">
                                <label for="player-name">YOUR PLAYER NAME</label>
                                <div class="input-wrap">
                                    <span aria-hidden="true">›</span><input id="player-name" v-model="player"
                                        maxlength="24" placeholder="Enter your name" autocomplete="nickname" required
                                        :aria-invalid="!!nameError" aria-describedby="name-help"
                                        :disabled="!!pending" />
                                </div>
                                <p id="name-help" class="field-help" :class="{ error: nameError }">
                                    {{
                                        nameError || 'This is how you’ll appear on the leaderboard.'
                                    }}
                                </p>
                                <button class="primary-button" :disabled="!!pending" type="submit">
                                    Let’s play <span>
                                        <UiIcon />
                                    </span>
                                </button>
                            </form>
                            <p class="screen-footnote">
                                FREE TO PLAY <span>✦</span> IMPOSSIBLE TO PLAY JUST ONCE
                            </p>
                        </div>

                        <div v-else-if="screen === 'game'" class="game-screen">
                            <div class="hud">
                                <div>
                                    <span class="stat-label">SCORE</span><strong>{{ formattedScore }}</strong>
                                </div>
                                <div class="coin-stat">
                                    <GameAsset name="coin" /><strong>{{ state.coins }}</strong>
                                </div>
                                <div class="lives">
                                    <span class="sr-only">{{ state.lives }} lives remaining</span>
                                    <GameAsset v-for="n in 3" :key="n" name="life" :class="{ lost: n > state.lives }" />
                                </div>
                                <button class="icon-button" :aria-label="paused ? 'Resume game' : 'Pause game'"
                                    @click="togglePause">
                                    {{ paused ? '▶' : 'Ⅱ' }}
                                </button>
                            </div>
                            <div class="pace">
                                <span>WAVE {{ state.wave }}</span><span>{{ (duration / 1000).toFixed(2) }}s /
                                    wave</span>
                            </div>
                            <div class="timer-track">
                                <div :style="{ width: `${progress}%` }"></div>
                            </div>
                            <div class="playfield" :class="{ 'field-paused': paused }">
                                <div v-for="cell in 12" :key="cell" class="field-cell">
                                    <template v-for="box in state.boxes.filter(
                                        (b) => b.cell === cell - 1,
                                    )" :key="box.id"><button v-if="!paused" class="target" :class="box.kind"
                                            :style="{ left: `${box.x}%`, top: `${box.y}%` }" :aria-label="box.kind === 'gold'
                                                    ? 'Golden box: collect 10 points'
                                                    : 'TNT: avoid this box'
                                                " @pointerdown.prevent="game.tap(box.id)" @click="
                                                (event) => {
                                                    if (event.detail === 0) game.tap(box.id)
                                                }
                                            ">
                                            <GameAsset :name="box.kind === 'gold' ? 'box' : 'bomb'" />
                                        </button></template>
                                </div>
                                <div v-if="paused" class="pause-overlay">
                                    <span class="eyebrow lime">TAKE A BREATHER</span>
                                    <h2>On your time.</h2>
                                    <p>Your run is safely paused.</p>
                                    <button class="primary-button" @click="togglePause">
                                        Back to it <span>▶</span>
                                    </button>
                                </div>
                            </div>
                            <div class="game-bottom">
                                <span role="status" aria-live="polite">{{
                                    feedback || 'Find the gold. Leave the TNT.'
                                    }}</span><span>GOLD +10 <span class="muted">/</span> TNT −1 ♥</span>
                            </div>
                        </div>

                        <div v-else class="over-screen">
                            <span class="result-emblem">⚑</span>
                            <p class="eyebrow lime">THAT WAS A GOOD RUN, {{ player }}.</p>
                            <h2 ref="heading" tabindex="-1">Quick hands.<br />One more round?</h2>
                            <div class="final-score">
                                <span class="stat-label">FINAL SCORE</span><strong>{{ formattedScore
                                    }}</strong><span>POINTS</span>
                            </div>
                            <div class="result-stats">
                                <span>
                                    <GameAsset name="coin" /> {{ state.coins }} coins
                                    collected
                                </span><span>Wave {{ state.wave }} reached</span>
                            </div>
                            <p class="save-status" role="status" :class="{ error: saveFailed }">
                                {{ saveMessage }}
                            </p>
                            <button v-if="saveFailed" class="text-button" :disabled="saving" @click="submit">
                                Retry saving ↻</button><button v-if="pending && !saving" class="text-button muted"
                                @click="discard">
                                Discard unsaved score</button><button class="primary-button"
                                :disabled="!!pending || saving" @click="start">
                                Play again <span>
                                    <UiIcon />
                                </span></button><button class="text-button" @click="menu">Back to the arcade</button>
                        </div>
                        <div class="arcade-bottom">
                            <span>CLICK. TAP. REPEAT.</span><span>✳</span><span>BUILT FOR THE QUICK.</span>
                        </div>
                    </section>
                    <div v-if="screen === 'menu' && pending" class="recovery" role="status">
                        <p>{{ saveMessage }}</p>
                        <button class="text-button" :disabled="saving" @click="submit">
                            {{ saving ? 'Saving…' : 'Retry saving' }}</button><button class="text-button"
                            :disabled="saving" @click="discard">
                            Discard score
                        </button>
                    </div>
                    <div class="game-tips">
                        <span><span class="keycap">+</span> Click or tap to collect</span><span><span
                                class="keycap">♥</span> Three lives.
                            Make them count.</span><span class="tip-desktop"><span class="keycap">
                                <UiIcon />
                            </span> Faster with every wave</span>
                    </div>
                </section>

                <aside class="sidebar">
                    <section class="leaderboard panel">
                        <div class="panel-title">
                            <div>
                                <p class="eyebrow">THE FAST-HANDS CLUB</p>
                                <h2>
                                    Top tappers<span>
                                        <UiIcon />
                                    </span>
                                </h2>
                            </div>
                            <span class="trophy">♜</span>
                        </div>
                        <div class="board-subtitle">
                            <span>ALL-TIME TOP 10</span><button class="refresh-button" :disabled="loading"
                                aria-label="Refresh leaderboard" @click="refreshLeaderboard">
                                {{ loading ? '···' : '↻' }}
                            </button>
                        </div>
                        <div class="board-head"><span>RANK / PLAYER</span><span>POINTS</span></div>
                        <div v-if="loading && !scores.length" class="board-empty" role="status">
                            <span class="empty-symbol">↻</span><strong>Finding the quick ones…</strong>
                        </div>
                        <div v-else-if="leaderboardError" class="board-empty" role="status">
                            <span class="empty-symbol">⌁</span><strong>The board’s taking a breather.</strong>
                            <p>{{ leaderboardError }}</p>
                            <button class="text-button" @click="refreshLeaderboard">
                                Try again
                                <UiIcon />
                            </button>
                        </div>
                        <ol v-else-if="scores.length" class="score-list">
                            <li v-for="(entry, index) in scores" :key="entry.id"
                                :class="{ 'your-score': entry.id === savedId }">
                                <span class="rank">{{ String(index + 1).padStart(2, '0') }}</span>
                                <div class="player-entry">
                                    <strong>{{ entry.player_name }}</strong><time :datetime="entry.created_at">{{
                                        new Date(entry.created_at).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                        })
                                    }}</time>
                                </div>
                                <strong class="entry-score">{{
                                    entry.score.toLocaleString()
                                    }}</strong>
                            </li>
                        </ol>
                        <div v-else class="board-empty">
                            <span class="empty-symbol">⚑</span><strong>A fresh board. Your first place?</strong>
                            <p>Play a round to set the score to beat.</p>
                        </div>
                        <div class="personal-best">
                            <span>YOUR LOCAL BEST</span><strong>{{ best.toLocaleString() }} <small>PTS</small></strong>
                        </div>
                        <p class="board-footer">A little friendly competition never hurt.</p>
                    </section>
                    <section class="how-to panel">
                        <p class="eyebrow">THE 10-SECOND BRIEFING</p>
                        <h2>Simple rules.<br />Serious reflexes.</h2>
                        <div class="rule">
                            <GameAsset name="box" />
                            <div>
                                <strong>Gold is the goal.</strong>
                                <p>Tap golden boxes for a coin and 10 points.</p>
                            </div>
                            <span class="rule-points">+10</span>
                        </div>
                        <div class="rule">
                            <GameAsset name="bomb" />
                            <div>
                                <strong>TNT? Let it be.</strong>
                                <p>Tap an explosive and lose a life.</p>
                            </div>
                            <span class="rule-points danger">−1 ♥</span>
                        </div>
                        <div class="rule">
                            <span class="clock-icon">◷</span>
                            <div>
                                <strong>Don’t blink.</strong>
                                <p>
                                    Miss any gold in a wave? Lose one life. Waves speed up to 0.5s.
                                </p>
                            </div>
                        </div>
                        <div class="how-to-footer">
                            <span>✳</span> Easy to learn. Hard to put down.
                        </div>
                    </section>
                </aside>
            </div>
        </main>
        <footer class="site-footer">
            <span class="footer-logo">
                quicktap<span>®</span>
            </span>

            <span>A SMALL ARCADE FOR YOUR BIG BREAK.</span>

            <a href="https://kerveldev.com" target="_blank" rel="noopener noreferrer" class="kerveldev-brand"
                aria-label="Visit KerVelDev website">
                <img :src="'/assets/images/kerveldev-logo.png'" alt="" class="kerveldev-logo" />

                <span>
                    POWERED BY
                    <strong>KerVelDev</strong>
                </span>
            </a>
        </footer>

        <div v-if="settingsOpen" class="modal-backdrop" @click.self="toggleSettings">
            <section ref="settingsPanel" class="settings-dialog panel" role="dialog" aria-modal="true"
                aria-labelledby="audio-title" tabindex="-1" @keydown="settingsKeys">
                <div class="panel-title">
                    <div>
                        <p class="eyebrow">SET YOUR OWN VIBE</p>
                        <h2 id="audio-title">Sound check.</h2>
                    </div>
                    <button class="icon-button" aria-label="Close audio settings" @click="toggleSettings">
                        ×
                    </button>
                </div>
                <label class="volume-label" for="music-volume">Music <span>{{ audio.settings.music
                        }}%</span></label><input id="music-volume" v-model.number="audio.settings.music" type="range"
                    min="0" max="100" /><label class="volume-label" for="effects-volume">Sound effects <span>{{
                        audio.settings.effects
                        }}%</span></label><input id="effects-volume" v-model.number="audio.settings.effects"
                    type="range" min="0" max="100" /><button class="mute-button" :aria-pressed="audio.settings.muted"
                    @click="audio.settings.muted = !audio.settings.muted">
                    {{ audio.settings.muted ? 'Unmute all audio' : 'Mute all audio' }}
                    <span>{{ audio.settings.muted ? 'OFF' : 'ON' }}</span>
                </button>
                <p class="settings-note">
                    Your preferences are saved on this device. Sound starts after you interact with
                    the game.
                </p>
                <p v-if="audio.unavailable.value" class="settings-note">
                    Some audio files are unavailable. You can keep playing.
                </p>
            </section>
        </div>
    </div>
</template>
