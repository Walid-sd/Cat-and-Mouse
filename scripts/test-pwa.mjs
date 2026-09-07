import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const failures = []

const [index, manifestSource, serviceWorker, main, icon, install] = await Promise.all([
  read('index.html'),
  read('public/manifest.webmanifest'),
  read('public/sw.js'),
  read('src/main.tsx'),
  read('public/icon.svg'),
  read('public/install.js'),
])

let manifest
try {
  manifest = JSON.parse(manifestSource)
} catch {
  failures.push('PWA manifest is not valid JSON')
}

if (manifest) {
  for (const field of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) {
    if (!manifest[field]) failures.push(`PWA manifest is missing ${field}`)
  }
  if (manifest.display !== 'standalone') failures.push('PWA manifest must use standalone display mode')
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    failures.push('PWA manifest must define at least one icon')
  } else {
    for (const iconEntry of manifest.icons) {
      if (!iconEntry?.src || !iconEntry?.type || !iconEntry?.sizes) failures.push('Every PWA manifest icon must define src, type, and sizes')
      if (iconEntry?.type === 'image/svg+xml' && iconEntry?.sizes !== 'any') failures.push('SVG PWA icons must use sizes="any"')
      if (iconEntry?.src === '/icon.svg' && !iconEntry?.purpose?.includes('maskable')) failures.push('The app icon should support maskable installation')
    }
    if (!manifest.icons.some(iconEntry => iconEntry?.src === '/icon.svg')) failures.push('PWA manifest must reference /icon.svg')
  }
}

if (!icon.includes('<svg') || !icon.includes('viewBox="0 0 512 512"')) failures.push('PWA icon must be a valid 512x512-viewBox SVG')

for (const required of [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="icon" href="/icon.svg" type="image/svg+xml" />',
  '<button id="install-app"',
  '<script src="/install.js"></script>',
  'navigator.serviceWorker.register(\'/sw.js\')',
]) {
  const source = required.includes('register') ? main : index
  if (!source.includes(required)) failures.push(`PWA integration is missing: ${required}`)
}

for (const required of [
  "beforeinstallprompt",
  "prompt.prompt()",
  "prompt.userChoice",
  "appinstalled",
  "display-mode: standalone",
]) {
  if (!install.includes(required)) failures.push(`PWA install helper is missing: ${required}`)
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

console.log('PWA smoke test passed: manifest identity, truthful SVG icon metadata, install UI and prompt handling, icon integrity, service-worker registration, versioning, activation, cleanup, and navigation-only offline fallback are present.')
