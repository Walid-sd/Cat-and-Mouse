import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const failures = []

const [index, config, ads] = await Promise.all([
  read('index.html'),
  read('public/ads-config.js'),
  read('public/rewarded-ads.js'),
])

for (const required of [
  'id="rewarded-ads-panel"',
  'id="rewarded-ad-button"',
  'id="rewarded-ad-status"',
  '<script src="/ads-config.js"></script>',
  '<script src="/rewarded-ads.js"></script>',
]) {
  if (!index.includes(required)) failures.push(`Rewarded ads integration is missing: ${required}`)
}

for (const required of [
  'publisherId:',
  'testMode:',
  'rewardCoins: 15',
]) {
  if (!config.includes(required)) failures.push(`Rewarded ads configuration is missing: ${required}`)
}

for (const required of [
  "type: 'reward'",
  'beforeReward:',
  'showAd()',
  'adViewed:',
  'adDismissed:',
  'adBreakDone:',
  "localStorage.getItem('cat-and-mouse-profile-v2')",
  "profile.coins = currentCoins + rewardCoins",
  "localStorage.setItem('cat-and-mouse-profile-v2'",
]) {
  if (!ads.includes(required)) failures.push(`Rewarded ads flow is missing: ${required}`)
}

if (!ads.includes('panel.hidden = !menu')) failures.push('Rewarded ads must be hidden outside the main menu')
if (!ads.includes('setButton(true') || !ads.includes('LOADING REWARDED AD')) failures.push('Rewarded ad button must enter a loading state before an ad request')
const loadingIndex = ads.indexOf('setButton(true')
const requestIndex = ads.indexOf('window.adBreak({')
if (loadingIndex === -1 || requestIndex === -1 || loadingIndex > requestIndex) failures.push('Rewarded ad loading state must be set before calling the ad placement API')
if (!ads.includes('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')) failures.push('Rewarded ad loader must use the official Google AdSense H5 Games script')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Rewarded ads smoke test passed: opt-in UI, configurable H5 Games Ads loader, completion-only +15 coin reward, dismissal handling, loading-state ordering, and menu-only placement are present.')
