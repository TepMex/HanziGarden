import { assetUrl } from './assetUrl'

type PlayableAudio = Pick<HTMLAudioElement, 'currentTime' | 'load' | 'pause' | 'play' | 'preload' | 'volume'>

type StrokeFeedbackAudioPlayerOptions = {
  createAudio?: (url: string) => PlayableAudio
  resolveUrl?: (path: string) => string
}

export const CORRECT_STROKE_SOUND_PATH = 'assets/audio/sound/sfx/correct.wav'
export const MISTAKE_STROKE_SOUND_PATH = 'assets/audio/sound/sfx/mistake.wav'
/** Linear HTMLMediaElement volume for one-shot stroke cues. */
export const STROKE_FEEDBACK_VOLUME = 1

export class StrokeFeedbackAudioPlayer {
  private readonly correctAudio: PlayableAudio | null
  private readonly mistakeAudio: PlayableAudio | null

  constructor(options: StrokeFeedbackAudioPlayerOptions = {}) {
    const createAudio = options.createAudio ?? ((url) => new Audio(url))
    const resolveUrl = options.resolveUrl ?? assetUrl
    this.correctAudio = this.createAudio(createAudio, resolveUrl(CORRECT_STROKE_SOUND_PATH))
    this.mistakeAudio = this.createAudio(createAudio, resolveUrl(MISTAKE_STROKE_SOUND_PATH))
  }

  playCorrect(): void {
    this.play(this.correctAudio)
  }

  playMistake(): void {
    this.play(this.mistakeAudio)
  }

  dispose(): void {
    this.correctAudio?.pause()
    this.mistakeAudio?.pause()
  }

  private createAudio(createAudio: (url: string) => PlayableAudio, url: string): PlayableAudio | null {
    try {
      const audio = createAudio(url)
      audio.preload = 'auto'
      audio.volume = STROKE_FEEDBACK_VOLUME
      audio.load()
      return audio
    } catch {
      return null
    }
  }

  private play(audio: PlayableAudio | null): void {
    if (!audio) return
    try {
      audio.currentTime = 0
      void audio.play().catch(() => {})
    } catch {
      // Sound effects are optional feedback and must never affect stroke grading.
    }
  }
}
