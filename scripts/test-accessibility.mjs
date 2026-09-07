import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const failures = []

const requiredPatterns = [
  ['Riddle dialog is modal', /role="dialog" aria-modal="true" aria-labelledby="riddle-title"/],
  ['Result dialog is modal', /role="dialog" aria-modal="true" aria-labelledby="result-title"/],
  ['Victory dialog is modal', /role="dialog" aria-modal="true" aria-labelledby="victory-title"/],
  ['Riddle error is announced', /riddleError && <p className="error" role="alert">/],
  ['Status changes are announced', /className=\{`status-card[^`]*`} role=\{danger && !thinking \? 'alert' : undefined\} aria-live="polite" aria-atomic="true"/],
  ['Sound control exposes pressed state', /className="sound-toggle" onClick=\{toggleSound\} aria-pressed=\{!muted\}/],
  ['Movement controls have a group label', /className="controls" aria-label="Movement controls"/],
  ['Up control has an accessible label', /aria-label="Move up"/],
  ['Down control has an accessible label', /aria-label="Move down"/],
  ['Left control has an accessible label', /aria-label="Move left"/],
  ['Right control has an accessible label', /aria-label="Move right"/],
  ['Level selector has an accessible label', /className="level-strip" aria-label="Level selection"/],
  ['Locked levels expose their state', /aria-label=\{`Level \$\{l\.id\}\$\{i > progress\[mode\] \? ', locked' : ''\}`\}/],
  ['Riddle answers receive initial focus', /riddleFirstAnswer\.current\?\.focus\(\)/],
  ['Result actions receive initial focus', /resultFirstAction\.current\?\.focus\(\)/],
  ['Modal focus is trapped with Tab', /event\.key !== 'Tab'[\s\S]*?modalRef\.current[\s\S]*?event\.shiftKey/],
  ['Modal ref is attached to rendered dialogs', /ref=\{modalRef\}/],
  ['Escape closes result screens', /if \(gameOver \|\| victory\)[\s\S]*?event\.key === 'Escape'/],
]

for (const [label, pattern] of requiredPatterns) {
  if (!pattern.test(source)) failures.push(label)
}

if (failures.length) {
  console.error('Accessibility contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Accessibility contract passed: ${requiredPatterns.length} keyboard and semantic UI requirements are present.`)
