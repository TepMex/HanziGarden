import { assetUrl } from './assetUrl'

type PlayableThemeAudio = Pick<HTMLAudioElement, 'load' | 'loop' | 'pause' | 'play' | 'preload'>

type ThemeMusicPlayerOptions = {
  createAudio?: (url: string) => PlayableThemeAudio
  resolveUrl?: (path: string) => string
}

export const THEME_MUSIC_PATH = 'assets/audio/sound/theme.mp3'

/** Owns the single looping theme shared by the menu and garden map. */
export class ThemeMusicPlayer {
  private readonly audio: PlayableThemeAudio | null

  constructor(options: ThemeMusicPlayerOptions = {}) {
    const createAudio = options.createAudio ?? ((url) => new Audio(url))
    const resolveUrl = options.resolveUrl ?? assetUrl
    try {
      const audio = createAudio(resolveUrl(THEME_MUSIC_PATH))
      audio.loop = true
      audio.preload = 'auto'
      audio.load()
      this.audio = audio
    } catch {
      this.audio = null
    }
  }

  play(): void {
    if (!this.audio) return
    try {
      void this.audio.play().catch(() => {})
    } catch {
      // Music is optional presentation and must never prevent navigation.
    }
  }

  pause(): void {
    this.audio?.pause()
  }

  dispose(): void {
    this.pause()
  }
}
