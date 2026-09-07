import { isMuted, playSound, primeAudio, toggleMute } from './audio'

function buttonSound(button: HTMLButtonElement) {
  const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase()
  if (label.includes('move ')) return 'move' as const
  if (label.includes('unlock') || label.includes('answer')) return 'gate' as const
  if (label.includes('reset') || label.includes('try again')) return 'start' as const
  if (label.includes('menu') || label.includes('level')) return 'move' as const
  return null
}

function mountSoundControl() {
  if (document.querySelector('[data-sound-control]')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.soundControl = 'true'
  button.className = 'sound-control'
  button.setAttribute('aria-label', 'Toggle sound effects')
  button.addEventListener('click', () => {
    const muted = toggleMute()
    button.textContent = muted ? 'SOUND OFF' : 'SOUND ON'
    button.setAttribute('aria-pressed', String(!muted))
    if (!muted) {
      primeAudio()
      playSound('start')
    }
  })
  button.textContent = isMuted() ? 'SOUND OFF' : 'SOUND ON'
  button.setAttribute('aria-pressed', String(!isMuted()))
  document.body.appendChild(button)
}

export function installAudioBridge() {
  if (typeof window === 'undefined') return
  document.addEventListener('click', event => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (!(button instanceof HTMLButtonElement) || button.dataset.soundControl) return
    const sound = buttonSound(button)
    if (sound) {
      primeAudio()
      playSound(sound)
    }
  })
  window.addEventListener('keydown', event => {
    if (event.key === 'm' || event.key === 'M') {
      const control = document.querySelector<HTMLButtonElement>('[data-sound-control]')
      control?.click()
      return
    }
    if (/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|w|a|s|d)$/i.test(event.key)) {
      primeAudio()
      playSound('move')
    }
  })
  mountSoundControl()
}
