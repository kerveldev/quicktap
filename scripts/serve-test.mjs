// Serves the production SPA solely for browser tests. API calls are mocked by Playwright.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'
const root = resolve('public')
const manifest = JSON.parse(readFileSync(resolve(root, 'build/manifest.json'), 'utf8'))
const entry = manifest['resources/js/app.ts']
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>QuickTap</title>${entry.css.map((css) => `<link rel="stylesheet" href="/build/${css}">`).join('')}</head><body><div id="app"></div><script type="module" src="/build/${entry.file}"></script></body></html>`
createServer((req, res) => {
    if (req.url === '/') {
        res.setHeader('Content-Type', 'text/html')
        return res.end(html)
    }
    const file = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname)
    if (!file.startsWith(root + '/')) {
        res.writeHead(403)
        return res.end()
    }
    try {
        const data = readFileSync(file)
        res.setHeader(
            'Content-Type',
            {
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.mp3': 'audio/mpeg',
            }[extname(file)] || 'application/octet-stream',
        )
        res.end(data)
    } catch {
        res.writeHead(404)
        res.end()
    }
}).listen(4173, '127.0.0.1')
