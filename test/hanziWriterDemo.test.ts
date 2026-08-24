import { describe, expect, mock, test } from 'bun:test'
import { mountHanziWriterDemo } from '../src/walkthrough/writerAdapter'

function fakeWriter() {
  return {
    animateCharacter: mock(() => Promise.resolve({ canceled: false })),
    quiz: mock(() => Promise.resolve()),
    pauseAnimation: mock(() => Promise.resolve()),
    hideCharacter: mock(() => Promise.resolve({ canceled: false })),
    cancelQuiz: mock(() => undefined),
    updateDimensions: mock(() => undefined),
  }
}

describe('Hanzi Writer walkthrough demo', () => {
  test('animates the character once loaded and can replay from the start', async () => {
    const writer = fakeWriter()
    const createWriter = mock((_element: HTMLElement, character: string) => {
      expect(character).toBe('二')
      return writer
    })
    const statuses: string[] = []
    const target = { replaceChildren() {}, clientWidth: 240 } as HTMLElement

    const handle = mountHanziWriterDemo(
      target,
      { character: '二', mode: 'hanzi-writer-animation' },
      {
        createWriter: createWriter as never,
        onStatus: (status) => statuses.push(status),
      },
    )

    expect(createWriter).toHaveBeenCalledTimes(1)
    expect(writer.animateCharacter).toHaveBeenCalledTimes(1)

    await handle.replay()
    expect(writer.pauseAnimation).toHaveBeenCalled()
    expect(writer.hideCharacter).toHaveBeenCalled()
    expect(writer.animateCharacter).toHaveBeenCalledTimes(2)

    handle.destroy()
    await handle.replay()
    expect(writer.animateCharacter).toHaveBeenCalledTimes(2)
  })

  test('quiz mode starts a quiz instead of a stroke-order animation', () => {
    const writer = fakeWriter()
    const handle = mountHanziWriterDemo(
      { replaceChildren() {}, clientWidth: 200 } as HTMLElement,
      { character: '十', mode: 'hanzi-writer-quiz' },
      { createWriter: (() => writer) as never },
    )

    expect(writer.quiz).toHaveBeenCalled()
    expect(writer.animateCharacter).not.toHaveBeenCalled()
    handle.destroy()
    expect(writer.cancelQuiz).toHaveBeenCalled()
  })
})
