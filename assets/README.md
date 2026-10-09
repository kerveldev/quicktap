# Original assets

The initial repository did not contain the requested media. Place the original
`background.png`, `box.png`, `bomb.png`, `coin.png`, `life.png` in `images/`, and
`coin.mp3`, `explosion.mp3`, `gameplay.mp3`, `mainscreen.mp3`, `tap.mp3` in `sounds/`.
Vite copies this directory to public/assets on startup/build. Run `npm run assets`
after changing media during development. The UI uses built-in CSS/Unicode fallbacks
when images are absent. Missing sounds are silent; no substitute music is bundled.
