/** A tiny synthesized cue keeps Combo feedback offline and avoids another audio asset. */
export function playComboMilestoneCue(combo: number): void {
  if (typeof window === 'undefined') return
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) return
  try {
    const context = new AudioContextConstructor()
    const now = context.currentTime
    const notes = combo >= 100 ? [440, 659, 880] : combo >= 10 ? [440, 659] : [523]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const start = now + index * .075
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(.0001, start)
      gain.gain.exponentialRampToValueAtTime(.055, start + .018)
      gain.gain.exponentialRampToValueAtTime(.0001, start + .28)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + .3)
    })
    window.setTimeout(() => void context.close(), 700)
  } catch {
    // Audio is optional feedback; gameplay remains deterministic if the device blocks it.
  }
}
