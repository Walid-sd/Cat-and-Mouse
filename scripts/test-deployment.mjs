import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const failures = []

const [netlify, headers, robots, packageSource] = await Promise.all([
  read('netlify.toml'),
  read('public/_headers'),
  read('public/robots.txt'),
  read('package.json'),
])

if (!netlify.includes('command = "npm run build"')) failures.push('Netlify build command must be npm run build')
if (!netlify.includes('publish = "dist"')) failures.push('Netlify publish directory must be dist')

for (const required of [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(), microphone=(), geolocation=()',
  'X-Frame-Options: DENY',
]) {
  if (!headers.includes(required)) failures.push(`Security headers are missing: ${required}`)
}

if (!headers.includes('/index.html') || !headers.includes('Cache-Control: no-cache, must-revalidate')) failures.push('index.html must bypass stale browser caching during deployments')
if (!headers.includes('/sw.js') || !headers.includes('Cache-Control: no-cache, must-revalidate')) failures.push('The service worker script must bypass stale browser caching during deployments')

if (!/^User-agent: \*\nAllow: \/\n?$/.test(robots)) failures.push('robots.txt must allow public crawling')

let pkg
try {
  pkg = JSON.parse(packageSource)
} catch {
  failures.push('package.json is not valid JSON')
}

if (pkg) {
  if (pkg.scripts?.build !== 'vite build') failures.push('Production build script must remain vite build')
  if (!pkg.scripts?.['test:release']?.includes('npm run test:deployment')) failures.push('Release verification must include deployment smoke tests')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Deployment smoke test passed: Netlify build/publish settings, security headers, crawler policy, and cache freshness controls are present.')
