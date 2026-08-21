import { describe, expect, test } from 'bun:test'
import { PinyinAudioPlayer, pinyinAudioAssetPath, type PinyinPronunciation } from '../src/pinyinAudio'

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

function pronunciation(audioFile: string | null = 'cmn-mao1.mp3'): PinyinPronunciation {
  return { pinyin: 'māo', audioFile }
}

describe('pinyin audio', () => {
  test('uses a lazy public-asset path', () => {
    expect(pinyinAudioAssetPath('cmn-mao1.mp3')).toBe('assets/audio/pinyin/cmn-mao1.mp3')
  })

  test('preloads once, replays from the start, and disposes the audio', async () => {
    const created: Array<{ url: string; audio: FakeAudio }> = []
    const player = new PinyinAudioPlayer({
      resolveUrl: (path) => `file:///android_asset/www/${path}`,
      createAudio: (url) => {
        const audio: FakeAudio = {
          currentTime: 7,
          loadCalls: 0,
          pauseCalls: 0,
          playCalls: 0,
          preload: 'none',
          load() { this.loadCalls += 1 },
          pause() { this.pauseCalls += 1 },
          async play() { this.playCalls += 1 },
        }
        created.push({ url, audio })
        return audio
      },
    })

    player.prepare(pronunciation())
    player.prepare(pronunciation())
    player.play(pronunciation())
    await Promise.resolve()

    expect(created).toHaveLength(1)
    expect(created[0]!.url).toBe('file:///android_asset/www/assets/audio/pinyin/cmn-mao1.mp3')
    expect(created[0]!.audio.preload).toBe('auto')
    expect(created[0]!.audio.loadCalls).toBe(1)
    expect(created[0]!.audio.currentTime).toBe(0)
    expect(created[0]!.audio.playCalls).toBe(1)

    player.dispose()
    expect(created[0]!.audio.pauseCalls).toBe(1)
  })

  test('silently skips a reading when upstream has no correct MP3', () => {
    let created = false
    const player = new PinyinAudioPlayer({
      createAudio: () => {
        created = true
        throw new Error('must not create audio')
      },
    })

    player.play(pronunciation(null))
    expect(created).toBe(false)
  })
})
