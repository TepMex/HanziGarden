import { describe, expect, test } from 'bun:test'
import {
  CORRECT_STROKE_SOUND_PATH,
  MISTAKE_STROKE_SOUND_PATH,
  StrokeFeedbackAudioPlayer,
} from '../src/strokeFeedbackAudio'

type FakeAudio = {
  currentTime: number
  loadCalls: number
  pauseCalls: number
  playCalls: number
  preload: string
  load: () => void
  pause: () => void
  play: () => Promise<void>
}

function fakeAudio(): FakeAudio {
  return {
    currentTime: 5,
    loadCalls: 0,
    pauseCalls: 0,
    playCalls: 0,
    preload: '',
    load() { this.loadCalls += 1 },
    pause() { this.pauseCalls += 1 },
    async play() { this.playCalls += 1 },
  }
}

describe('stroke feedback audio', () => {
  test('preloads and plays the correct and mistake public assets', () => {
    const created: Array<{ url: string; audio: FakeAudio }> = []
    const player = new StrokeFeedbackAudioPlayer({
      resolveUrl: (path) => `file:///android_asset/www/${path}`,
      createAudio: (url) => {
        const audio = fakeAudio()
        created.push({ url, audio })
        return audio
      },
    })

    expect(CORRECT_STROKE_SOUND_PATH).toBe('assets/audio/sound/sfx/correct.wav')
    expect(MISTAKE_STROKE_SOUND_PATH).toBe('assets/audio/sound/sfx/mistake.wav')
    expect(created.map(({ url }) => url)).toEqual([
      `file:///android_asset/www/${CORRECT_STROKE_SOUND_PATH}`,
      `file:///android_asset/www/${MISTAKE_STROKE_SOUND_PATH}`,
    ])
    expect(created.every(({ audio }) => audio.preload === 'auto' && audio.loadCalls === 1)).toBe(true)

    player.playCorrect()
    player.playMistake()

    expect(created[0]!.audio.currentTime).toBe(0)
    expect(created[0]!.audio.playCalls).toBe(1)
    expect(created[1]!.audio.currentTime).toBe(0)
    expect(created[1]!.audio.playCalls).toBe(1)

    player.dispose()
    expect(created.every(({ audio }) => audio.pauseCalls === 1)).toBe(true)
  })

  test('keeps grading safe when audio cannot initialize', () => {
    const player = new StrokeFeedbackAudioPlayer({
      createAudio: () => { throw new Error('Audio is unavailable') },
      resolveUrl: (path) => path,
    })

    expect(() => player.playCorrect()).not.toThrow()
    expect(() => player.playMistake()).not.toThrow()
  })
})
