import { defineConfig } from 'vitest/config'
import laravel from 'laravel-vite-plugin'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import './scripts/sync-assets.mjs'

export default defineConfig({
    plugins: [laravel({ input: ['resources/js/app.ts'], refresh: true }), vue(), tailwindcss()],
    test: { include: ['tests/Frontend/**/*.test.ts'] },
})
