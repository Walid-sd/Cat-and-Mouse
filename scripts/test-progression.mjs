import { readFile } from 'node:fs/promises'

const progression = await readFile(new URL('../src/progression.ts', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const failures = []

for (const required of [
  'export const characters',
  "id: 'mouse-classic'",
  "id: 'cat-classic'",
  'export function loadProfile',
  'export function saveProfile',
  'export function resetProfile',
  'export function addCoins',
  'export function selectCharacter',
  'export function unlockCharacter',
  'export function collectCoin',
  'export function completeLevel',
  'export function coinSpawns',
  'export function coinKey',
]) {
  if (!progression.includes(required)) failures.push(`Progression module is missing: ${required}`)
}

const costs = [...progression.matchAll(/cost:\s*(\d+)/g)].map(match => Number(match[1]))
if (costs.length !== 6) failures.push('The initial roster must contain exactly six characters.')
if (costs.filter(cost => cost === 0).length !== 2) failures.push('Exactly one starter character per role must be free.')
if (!costs.some(cost => cost > 0)) failures.push('The roster must include unlockable characters.')
if (costs.some(cost => cost < 0)) failures.push('Character costs cannot be negative.')
if (!progression.includes("const PROFILE_KEY = 'cat-and-mouse-profile-v2'")) failures.push('Progression must use a versioned storage key.')
if (!progression.includes('coins: profile.coins - character.cost')) failures.push('Character unlocks must deduct coins safely.')
if (!progression.includes('collectedCoins: []')) failures.push('Profiles must initialize persistent collected coin IDs.')
if (!progression.includes('if (!coinId || profile.collectedCoins.includes(coinId)) return profile')) failures.push('Coin collection must reject already-collected IDs.')
if (!progression.includes('return { ...addCoins(profile, COIN_VALUE), collectedCoins: [...profile.collectedCoins, coinId] }')) failures.push('Collecting a new coin must persist its ID and award its configured value.')
if (!progression.includes('unlocked.includes(source.selected!.mouse!)') || !progression.includes('unlocked.includes(source.selected!.cat!)')) failures.push('Persisted selections must fall back when a stored character is locked.')
if (!progression.includes('try { storage?.removeItem(PROFILE_KEY) } catch')) failures.push('Profile reset must remove the persisted profile safely.')
if (!progression.includes('const previousCompleted = profile.completed[mode]')) failures.push('Level completion must never reduce progression or farm repeat-completion rewards.')
if (!progression.includes('return addCoins({ ...profile, completed: { ...profile.completed, [mode]: completed } }, LEVEL_COMPLETION_BONUS)')) failures.push('First-time level completion must award the configured coin bonus.')
if (!progression.includes('let attempts = 0') || !progression.includes('attempts < candidates.length') || !progression.includes('attempts += 1')) failures.push('Coin spawning must have a bounded selection loop.')
if (!progression.includes('if (chosen.length < targetCount)')) failures.push('Coin spawning must have a deterministic fallback when the stride cycles early.')

for (const required of [
  'Character selection and shop',
  'unlockCharacter',
  'character.cost',
  'SELECTED',
  'LOCKED',
]) {
  if (!app.includes(required)) failures.push(`Character shop UI is missing: ${required}`)
}

for (const required of [
  'collectCoin as collectPersistentCoin',
  'profile.collectedCoins.includes(coin)',
  'profile.collectedCoins.includes(coinId)',
]) {
  if (!app.includes(required)) failures.push(`Persistent coin collection is missing: ${required}`)
}

if (!app.includes('const [rewardEarned, setRewardEarned] = useState(false)')) failures.push('Victory reward state is missing.')
if (!app.includes('setRewardEarned(false)')) failures.push('Reset must clear the per-run reward state.')
if (!app.includes('setRewardEarned(profile.completed[mode] <= levelIndex)')) failures.push('Victory must distinguish first-time completion from replay completion.')
if (!app.includes('{rewardEarned ? <p className="reward">🪙 +10 coins · Total: {profile.coins}</p> : <p className="reward">No first-time reward · Total: {profile.coins}</p>}')) failures.push('Victory reward messaging must match whether the level bonus was actually earned.')
const lossModal = app.match(/\{gameOver &&([\s\S]*?)\}\n      \{victory &&/)
if (!lossModal) failures.push('Loss result modal could not be located for reward validation.')
else if (lossModal[1].includes('className="reward"')) failures.push('Loss result modal must not display a level reward.')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Progression smoke test passed: starter characters, unlockable tiers, persistent profile, safe selection normalization, profile reset, one-time maze coin collection, level completion, bounded deterministic coin spawning, character shop UI, and accurate first-time victory reward messaging are defined.')
