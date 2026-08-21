import { assetUrl } from './assetUrl'

export type PinyinPronunciation = {
  pinyin: string
  audioFile: string | null
}

type PlayableAudio = Pick<HTMLAudioElement, 'currentTime' | 'load' | 'pause' | 'play' | 'preload'>

type PinyinAudioPlayerOptions = {
  createAudio?: (url: string) => PlayableAudio
  resolveUrl?: (path: string) => string
}

export function pinyinAudioAssetPath(audioFile: string): string {
  return `assets/audio/pinyin/${audioFile}`
}

/**
 * Keeps only the next pronunciation in memory. Public MP3 assets are therefore
 * loaded lazily instead of becoming part of the JavaScript bundle.
 */
export class PinyinAudioPlayer {
  private readonly createAudio: (url: string) => PlayableAudio
  private readonly resolveUrl: (path: string) => string
  private preparedFile: string | null = null
  private audio: PlayableAudio | null = null

  constructor(options: PinyinAudioPlayerOptions = {}) {
    this.createAudio = options.createAudio ?? ((url) => new Audio(url))
    this.resolveUrl = options.resolveUrl ?? assetUrl
  }

  prepare(pronunciation: PinyinPronunciation | null): void {
    const audioFile = pronunciation?.audioFile ?? null
    if (audioFile === this.preparedFile) return

    this.audio?.pause()
    this.audio = null
    this.preparedFile = audioFile
    if (!audioFile) return

    try {
      const audio = this.createAudio(this.resolveUrl(pinyinAudioAssetPath(audioFile)))
      audio.preload = 'auto'
      audio.load()
      this.audio = audio
    } catch {
      // Pronunciation is optional feedback and must never interrupt a review.
      this.preparedFile = null
    }
  }

  play(pronunciation: PinyinPronunciation | null): void {
    this.prepare(pronunciation)
    if (!this.audio) return

    try {
      this.audio.currentTime = 0
      void this.audio.play().catch(() => {})
    } catch {
      // Browser autoplay/device failures do not affect game progression.
    }
  }

  dispose(): void {
    this.audio?.pause()
    this.audio = null
    this.preparedFile = null
  }
}
