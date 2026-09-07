import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url)
const dist = new URL('../dist/', import.meta.url)
const failures = []

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

if (!(await exists(dist))) failures.push('Production dist directory is missing; run npm run build first.')

if (!failures.length) {
  const indexPath = new URL('../dist/index.html', import.meta.url)
  if (!(await exists(indexPath))) {
    failures.push('Production index.html is missing.')
  } else {
    const html = await readFile(indexPath, 'utf8')
    if (!html.includes('<div id="root"></div>')) failures.push('Production index.html is missing the application root.')

    const references = [...html.matchAll(/(?:src|href)="(assets\/[^"?#]+)"/g)].map(match => match[1])
    if (!references.length) failures.push('Production index.html does not reference generated assets.')
    for (const relativePath of references) {
      if (!(await exists(join(dist.pathname, relativePath)))) failures.push(`Production asset is missing: ${relativePath}`)
    }

    if (html.includes('/src/main.tsx')) failures.push('Production index.html must not reference source TypeScript entrypoints.')
    if (!html.includes('manifest.webmanifest')) failures.push('Production index.html must retain the PWA manifest reference.')
  }

  for (const required of ['manifest.webmanifest', 'icon.svg', 'sw.js', 'robots.txt', '_headers']) {
    if (!(await exists(new URL(`../dist/${required}`, import.meta.url)))) failures.push(`Production public asset is missing: ${required}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Build artifact smoke test passed: production HTML, generated assets, PWA files, and public deployment files are present and internally referenced.')
