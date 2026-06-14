import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.map': 'application/json',
}

/** Minimální statický file server pro Vite build (s SPA fallbackem na index.html). */
export function createStaticHandler(dir: string) {
  const root = resolve(dir)
  return (req: IncomingMessage, res: ServerResponse): void => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    let file = resolve(root, '.' + urlPath)
    // ochrana proti path traversal
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    if (urlPath.endsWith('/') || !existsSync(file) || statSync(file).isDirectory()) {
      file = resolve(root, 'index.html')
    }
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' })
    createReadStream(file).pipe(res)
  }
}
