import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  CORRECT_STROKE_SOUND_PATH,
  MISTAKE_STROKE_SOUND_PATH,
  STROKE_FEEDBACK_VOLUME,
  StrokeFeedbackAudioPlayer,
} from '../src/strokeFeedbackAudio'

type FakeAudio = {
  currentTime: number
  loadCalls: number
  pauseCalls: number
  playCalls: number
  preload: string
  volume: number
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
    volume: 0,
    load() { this.loadCalls += 1 },
    pause() { this.pauseCalls += 1 },
    async play() { this.playCalls += 1 },
  }
}

async function pcm16Levels(path: string): Promise<{ peakDb: number; rmsDb: number }> {
  const buf = Buffer.from(await Bun.file(path).arrayBuffer())
  const dataIndex = buf.indexOf(Buffer.from('data'))
  if (dataIndex < 0) throw new Error(`WAV data chunk missing: ${path}`)
  const dataSize = buf.readUInt32LE(dataIndex + 4)
  const start = dataIndex + 8
  let peak = 0
  let sumSquares = 0
  const sampleCount = dataSize / 2
  for (let offset = 0; offset < dataSize; offset += 2) {
    const sample = Math.abs(buf.readInt16LE(start + offset)) / 32768
    peak = Math.max(peak, sample)
    sumSquares += sample * sample
  }
  const rms = Math.sqrt(sumSquares / sampleCount)
  return {
    peakDb: 20 * Math.log10(peak || Number.EPSILON),
    rmsDb: 20 * Math.log10(rms || Number.EPSILON),
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
    expect(created.every(({ audio }) => (
      audio.preload === 'auto'
      && audio.loadCalls === 1
      && audio.volume === STROKE_FEEDBACK_VOLUME
    ))).toBe(true)

    player.playCorrect()
    player.playMistake()

    expect(created[0]!.audio.currentTime).toBe(0)
    expect(created[0]!.audio.playCalls).toBe(1)
    expect(created[1]!.audio.currentTime).toBe(0)
    expect(created[1]!.audio.playCalls).toBe(1)

    player.dispose()
    expect(created.every(({ audio }) => audio.pauseCalls === 1)).toBe(true)
  })

  test('keeps stroke cues as loud as a full-mix effect', async () => {
    for (const relativePath of [CORRECT_STROKE_SOUND_PATH, MISTAKE_STROKE_SOUND_PATH]) {
      const levels = await pcm16Levels(join(import.meta.dir, '..', 'public', relativePath))
      expect(levels.peakDb).toBeGreaterThanOrEqual(-3)
      expect(levels.rmsDb).toBeGreaterThanOrEqual(-28)
    }
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
