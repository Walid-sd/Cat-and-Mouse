import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const failures = []

const [index, manifestSource, serviceWorker, main] = await Promise.all([
  read('index.html'),
  read('public/manifest.webmanifest'),
  read('public/sw.js'),
  read('src/main.tsx'),
])

let manifest
try {
  manifest = JSON.parse(manifestSource)
} catch {
  failures.push('PWA manifest is not valid JSON')
}

if (manifest) {
  for (const field of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) {
    if (!manifest[field]) failures.push(`PWA manifest is missing ${field}`)
  }
  if (manifest.display !== 'standalone') failures.push('PWA manifest must use standalone display mode')
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) failures.push('PWA manifest must define at least one icon')
}

for (const required of [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="icon" href="/icon.svg" type="image/svg+xml" />',
  'navigator.serviceWorker.register(\'/sw.js\')',
]) {
  const source = required.includes('register') ? main : index
  if (!source.includes(required)) failures.push(`PWA integration is missing: ${required}`)
}

const cacheMatch = serviceWorker.match(/const CACHE_NAME = '([^']+)'/)
if (!cacheMatch) failures.push('Service worker does not define a named cache')
else if (!/-v\d+$/.test(cacheMatch[1])) failures.push(`Service worker cache name should be versioned: ${cacheMatch[1]}`)

if (!serviceWorker.includes('self.skipWaiting()')) failures.push('Service worker must activate the newest version immediately')
if (!serviceWorker.includes('self.clients.claim()')) failures.push('Service worker must claim controlled clients after activation')
if (!serviceWorker.includes("caches.delete(key)")) failures.push('Service worker must remove obsolete caches')
if (!serviceWorker.includes("caches.match('/index.html')")) failures.push('Service worker must provide an offline app-shell fallback')
if (!serviceWorker.includes("request.mode === 'navigate'")) failures.push('Offline app-shell fallback must only apply to navigation requests')
if (!serviceWorker.includes('return Response.error()')) failures.push('Missing offline non-navigation assets must not receive the HTML app shell')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('PWA smoke test passed: manifest, installation metadata, service-worker registration, versioning, activation, cleanup, and navigation-only offline fallback are present.')
