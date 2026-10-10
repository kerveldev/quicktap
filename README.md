# QuickTap — Survival Rush

A responsive reflex arcade and full-stack portfolio demo built with **Laravel 12,
Vue 3 Composition API, TypeScript, Vite, Tailwind CSS 4 and MySQL**.

Enter a player name, collect gold, dodge TNT, and compete on an all-time top-ten
leaderboard. The application is served from a single origin: Laravel serves the
SPA shell and REST API, and Vite bundles the client.

## Survival Rush gameplay

- Survive **60 seconds of active play**, or finish early when all three lives are
  lost. The main timer and wave timer pause together; hidden tabs pause automatically
  and require an explicit resume. Neither gameplay clock continues after game over.
- Each wave contains **3–5 non-overlapping targets** in randomly shuffled cells
  with bounded offsets. Every wave contains gold, and targets stay inside the arena
  on desktop and mobile.
- Gold awards **10 points + one coin**. TNT costs **one life** and resets the streak.
  Missed gold and ignored TNT have no penalty. Repeated input on a removed target
  cannot award points or deduct another life.
- Wave durations are independently randomized when each wave starts, using elapsed
  active play time (not wave count):

  | Elapsed time | Remaining countdown | Wave duration |
  | --- | --- | --- |
  | 0–<15s | 60–46s | 3–5s |
  | 15–<30s | 45–31s | 2–3s |
  | 30–<45s | 30–16s | 1–2s |
  | 45–60s | 15–0s | 0.5–1s |

- Consecutive gold hits award bonuses at **3 (+5), 5 (+15), and 10 (+30)**.
  Milestones repeat every ten hits while the total streak keeps growing: hit 13
  awards +5 again. A milestone fires once, and missed targets do not reset a streak.
- The HUD shows score, coins, three fixed-size hearts, time remaining, and combo.
  Gold/TNT feedback, combo bursts and final-15-second urgency respect reduced motion.
  Existing audio assets provide collection, explosion, combo, final-ten-second ticks
  and game-over cues; volume controls and saved preferences still apply.
- Game over shows score, coins, highest combo, active time survived and end reason,
  with **PLAY AGAIN** and **LEADERBOARD** actions. The existing API submits once per
  completed run; manual retries reuse the same UUID. Unsaved runs must be saved or
  explicitly discarded before restart.
- Highest combo and time survived are session-only statistics. The API still saves
  only player name, score and server date; its schema and endpoints are unchanged.
  Score validation now accepts multiples of **five**, including all legacy scores.
  Existing leaderboard entries remain available alongside Survival Rush scores.

## Requirements

- PHP 8.2+ and Composer 2; standard Laravel extensions including `mbstring`,
  `dom`, `xml`, `curl`, `fileinfo`, `openssl`, `pdo`, and `pdo_mysql`.
- Node.js 22.12+ (or 24 LTS), npm.
- MySQL 8+ for deployed persistence; `pdo_sqlite` for isolated PHP tests only.
- HTTPS in production (also required for `crypto.randomUUID`; localhost works).

## Local setup — no database operations

```sh
composer install
npm ci
cp .env.example .env
php artisan key:generate
npm run build
php artisan serve
```

Open `http://localhost:8000`. For hot reload, also run `npm run dev` in a second
terminal and continue opening Laravel on port 8000.

These commands **do not run migrations**. Composer hooks only discover packages.
The game works without a database connection; the leaderboard shows an unavailable
state and score submissions can be retried. To play without any API/database calls,
run the production-build test harness (`node scripts/serve-test.mjs`) and visit
`http://127.0.0.1:4173`; it has no API and therefore cannot save scores.

Do not put remote credentials in local `.env` while testing. Production credentials
belong in the hosting provider's secret environment configuration. `.env` and its
variants are ignored; `.env.example` contains placeholders only. No client-side
`VITE_*` variables contain database credentials.

## Assets

The original game images and sounds are present and preserved. The application
uses these existing paths:

```text
assets/images/background.png
assets/images/box.png
assets/images/bomb.png
assets/images/coin.png
assets/images/life.png
assets/sounds/coin.mp3
assets/sounds/explosion.mp3
assets/sounds/gameplay.mp3
assets/sounds/mainscreen.mp3
assets/sounds/tap.mp3
```

Keep these original files in place. `npm run dev` and
`npm run build` copy `assets/` into `public/assets/`; `npm run assets` refreshes them
without restarting Vite. The UI provides CSS/Unicode fallback artwork. Missing
sounds are silent and the settings panel reports unavailable audio; original
music and effects use the supplied assets without introducing new file paths.

Music and effects have independent 0–100% sliders and a global mute. Preferences
persist locally when storage is available. Playback begins only after a user
interaction, rejected autoplay promises are handled, and screen changes crossfade
menu/gameplay tracks over 400ms. Hidden tabs stop all audio. Effects are bounded to
eight concurrent instances, and timers/audio are cleaned up on component unmount.

## Architecture

```text
app/Http/Controllers/ScoreController.php    HTTP orchestration
app/Http/Requests/StoreScoreRequest.php     Input validation
app/Http/Resources/ScoreResource.php        Stable public response shape
app/Services/ScoreService.php               Ranking and idempotent persistence
app/Models/Score.php                        Eloquent model
resources/js/game/engine.ts                 Pure, independently tested game rules
resources/js/composables/useGame.ts         Timer, pause and lifecycle management
resources/js/composables/useAudio.ts        Audio, crossfades and preferences
resources/js/services/api.ts               Typed API client, timeouts and errors
resources/js/App.vue                        Screens and accessible interaction
resources/js/components/GameAsset.vue       Original assets with fallback artwork
```

Database sessions, queues and cache are intentionally disabled by default: sessions
and rate-limit cache use files, and queues run synchronously. Ordinary boot/build
commands do not require a database.

## REST API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/leaderboard` | Top ten runs, score descending, then earliest date and ID; 60 requests/min/IP |
| POST | `/api/scores` | Store a run; 20 requests/min/IP |

Example body:

```json
{
  "submission_id": "569bef2d-74f2-4f0e-8c91-b839cff7bb14",
  "player_name": "Luna",
  "score": 120
}
```

Names are trimmed, 1–24 characters, and accept Unicode letters/numbers, spaces,
underscores, dots and hyphens. Scores must be integers between 0 and 1,000,000,
in multiples of five. Dates are assigned by the server and returned in UTC ISO 8601.
A new run returns **201**, and retries with the same UUID return the original run
with **200** (they do not overwrite its score). The database enforces UUID uniqueness.
Invalid input returns **422**; rate-limited calls return **429**.

```json
{
  "data": {
    "id": 1,
    "player_name": "Luna",
    "score": 120,
    "created_at": "2026-10-09T12:00:00.000000Z"
  }
}
```

The leaderboard returns an array under `data`. Submission UUIDs are not exposed.
This is an anonymous portfolio demo: validation and throttling limit malformed
input and casual spam, but **client-calculated scores are not cheat-proof**. A
competitive production leaderboard should use server-authoritative sessions and
validated event sequences. No authentication or personal account system is implied.

## Verification

```sh
npm test                      # Pure game rules and audio preference tests
npm run build                 # Strict TypeScript checks + production bundle
composer test                 # Laravel HTTP/persistence tests
vendor/bin/pint --test        # PHP formatting check
npm run format:check           # Vue/TypeScript/CSS formatting
npx playwright install chromium
npm run test:e2e              # Desktop and mobile browser flows
```

If Chromium is already installed, use
`CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` instead of downloading it.
Build before browser tests. Browser tests serve the production bundle locally and
mock every REST request; they never contact MySQL. Tests cover the 60-second limit,
TNT losses, single submission, retry/restart, pause, mobile bounds and non-overlap,
heart sizing, combos, reduced motion, settings persistence and the leaderboard.
Pure-rule and fake-clock tests also check exact difficulty boundaries, repeated
combo cycles, timer cleanup, hidden-tab pause and rejection of late input.

The test bootstrap reads only `.env.example`, never a developer’s `.env`.
PHPUnit **forces SQLite `:memory:`**, an empty `DB_URL`, array sessions/cache and a
fixed non-production test key. Tests create a small disposable fixture table with
SQL; they do **not** call migration commands or run the migration file. Each test
asserts the database configuration before opening a connection. They exercise real
Eloquent persistence, validation, stable top-ten ordering, duplicate submissions,
empty leaderboards and throttling. MySQL integration and the migration itself
remain unverified until a separately authorized database validation phase.

## Deployment requirements (not performed)

1. Keep original assets, run the verification commands, and build assets with
   `npm ci && npm run build`. Install runtime PHP dependencies with
   `composer install --no-dev --optimize-autoloader`.
2. Provision PHP-FPM and Nginx/Apache with the document root set to **`public/`**,
   routing missing paths to `public/index.php`. Serve `public/build` and
   `public/assets` as static files. Use HTTPS and `APP_DEBUG=false`.
3. Supply `APP_ENV=production`, a unique stable `APP_KEY`, `APP_URL`, and secret
   `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`,
   `DB_PASSWORD`. Set `MYSQL_ATTR_SSL_CA` to the provider's CA path for TLS.
   Never copy an environment file into source control or the public web root.
4. Give PHP write access to `storage/` and `bootstrap/cache/`. Keep the file cache
   writable; use a shared Redis cache if scaling to multiple app instances so
   throttling remains consistent. Configure trusted proxies for the actual hosting
   topology rather than trusting arbitrary forwarded headers.
5. **Database change is a separate operator action requiring approval.** Review
   `database/migrations/2026_10_09_000000_create_scores_table.php`, take appropriate
   backups and arrange an authorized schema rollout. No automatic setup, build,
   deployment or test command runs it. Do not enable remote credentials or launch
   live score traffic until the schema is provisioned.
6. After the approved schema rollout, an operator can cache config/routes/views,
   check `/up`, and smoke-test score submission and leaderboard reads in the target
   environment. `/up` checks application boot, not database readiness.

No remote database was accessed, no migrations were executed, and no production
deployment was performed during implementation.
