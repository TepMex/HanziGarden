import { describe, expect, test } from 'bun:test'
import { STROKE_FEEDBACK_VOLUME } from '../src/strokeFeedbackAudio'
import { THEME_MUSIC_PATH, THEME_MUSIC_VOLUME, ThemeMusicPlayer } from '../src/themeMusic'

function fakeAudio() {
  return {
    loadCalls: 0,
    pauseCalls: 0,
    playCalls: 0,
    loop: false,
    preload: '',
    volume: 1,
    load() { this.loadCalls += 1 },
    pause() { this.pauseCalls += 1 },
    play() {
      this.playCalls += 1
      return Promise.resolve()
    },
  }
}

describe('ThemeMusicPlayer', () => {
  test('loads the public theme asset as a loop', () => {
    const audio = fakeAudio()
    let createdUrl = ''
    new ThemeMusicPlayer({
      createAudio: (url) => {
        createdUrl = url
        return audio
      },
      resolveUrl: (path) => `file:///android_asset/www/${path}`,
    })

    expect(THEME_MUSIC_PATH).toBe('assets/audio/sound/theme.mp3')
    expect(createdUrl).toBe('file:///android_asset/www/assets/audio/sound/theme.mp3')
    expect(THEME_MUSIC_VOLUME).toBeLessThan(STROKE_FEEDBACK_VOLUME)
    expect(audio.loop).toBe(true)
    expect(audio.preload).toBe('auto')
    expect(audio.volume).toBe(THEME_MUSIC_VOLUME)
    expect(audio.loadCalls).toBe(1)
  })

  test('plays, pauses, and disposes without resetting the shared track', () => {
    const audio = fakeAudio()
    const player = new ThemeMusicPlayer({ createAudio: () => audio, resolveUrl: (path) => path })

    player.play()
    player.pause()
    player.dispose()

    expect(audio.playCalls).toBe(1)
    expect(audio.pauseCalls).toBe(2)
  })

  test('ignores a blocked autoplay attempt', () => {
    const audio = fakeAudio()
    audio.play = () => {
      audio.playCalls += 1
      return Promise.reject(new Error('NotAllowedError'))
    }
    const player = new ThemeMusicPlayer({ createAudio: () => audio, resolveUrl: (path) => path })

    expect(() => player.play()).not.toThrow()
    expect(audio.playCalls).toBe(1)
  })

  test('stays inert when the audio device cannot be initialized', () => {
    const player = new ThemeMusicPlayer({
      createAudio: () => { throw new Error('Audio is unavailable') },
      resolveUrl: (path) => path,
    })

    expect(() => player.play()).not.toThrow()
    expect(() => player.pause()).not.toThrow()
  })
})
