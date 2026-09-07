type SoundName = 'start' | 'move' | 'opponent' | 'gate' | 'error' | 'win' | 'lose'

const SOUND_KEY = 'cat-and-mouse-sound-v1'
let context: AudioContext | null = null
let muted = false

try {
  muted = localStorage.getItem(SOUND_KEY) === 'muted'
} catch {
  // Audio preference persistence is optional.
}

function getContext() {
  if (typeof window === 'undefined') return null
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    context = new AudioContextClass()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

export function primeAudio() {
  if (muted) return
  getContext()
}

export function isMuted() {
  return muted
}

export function toggleMute() {
  muted = !muted
  try {
    localStorage.setItem(SOUND_KEY, muted ? 'muted' : 'on')
  } catch {
    // Audio preference persistence is optional.
  }
  return muted
}

export function playSound(name: SoundName) {
  if (muted) return
  const audio = getContext()
  if (!audio) return

  const now = audio.currentTime
  const settings: Record<SoundName, { frequency: number; duration: number; type: OscillatorType; volume: number; slide?: number }> = {
    start: { frequency: 220, duration: 0.16, type: 'sine', volume: 0.045, slide: 330 },
    move: { frequency: 180, duration: 0.055, type: 'triangle', volume: 0.035, slide: 150 },
    opponent: { frequency: 120, duration: 0.075, type: 'triangle', volume: 0.04, slide: 105 },
    gate: { frequency: 320, duration: 0.2, type: 'sine', volume: 0.055, slide: 520 },
    error: { frequency: 115, duration: 0.12, type: 'square', volume: 0.025, slide: 90 },
    win: { frequency: 440, duration: 0.34, type: 'sine', volume: 0.06, slide: 660 },
    lose: { frequency: 190, duration: 0.32, type: 'sawtooth', volume: 0.035, slide: 80 },
  }
  const { frequency, duration, type, volume, slide } = settings[name]
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  if (slide) oscillator.frequency.exponentialRampToValueAtTime(slide, now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.01)
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
