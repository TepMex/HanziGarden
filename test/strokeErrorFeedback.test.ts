import { describe, expect, test } from 'bun:test'
import { isSameStrokeErrorHint, strokeErrorCopy } from '../src/strokeErrorFeedback'

describe('stroke error feedback copy', () => {
  test('uses generic copy for a confident order miss without stroke numbers', () => {
    const copy = strokeErrorCopy({
      type: 'wrong-order',
      expectedStroke: 2,
      attemptedStroke: 4,
      confidence: 0.9,
    })

    expect(copy).toEqual({
      type: 'wrong-order',
      title: 'Неправильный порядок черт',
      detail: 'Кажется ты поспешил нарисовать эту черту',
    })
  })

  test('shows nothing for a low-confidence order miss', () => {
    expect(strokeErrorCopy({
      type: 'wrong-order',
      expectedStroke: 2,
      attemptedStroke: 4,
      confidence: 0.4,
    })).toBeNull()
  })

  test('shows instructional copy for reverse direction without internal type names', () => {
    expect(strokeErrorCopy({ type: 'wrong-direction', expectedStroke: 2, confidence: 0.85 })).toEqual({
      type: 'wrong-direction',
      title: 'Неверное направление',
      detail: 'Проведи эту черту в другую сторону.',
    })
  })

  test('shows nothing for shape and unknown misses', () => {
    expect(strokeErrorCopy({ type: 'bad-shape', expectedStroke: 2, confidence: 0.5 })).toBeNull()
    expect(strokeErrorCopy({ type: 'unknown', expectedStroke: 2 })).toBeNull()
  })

  test('treats an identical hint as a replacement rather than a new message', () => {
    const hint = strokeErrorCopy({ type: 'wrong-direction', expectedStroke: 0, confidence: 0.9 })
    const other = strokeErrorCopy({
      type: 'wrong-order',
      expectedStroke: 0,
      attemptedStroke: 1,
      confidence: 0.9,
    })
    expect(hint).not.toBeNull()
    expect(other).not.toBeNull()
    expect(isSameStrokeErrorHint(hint, hint!)).toBe(true)
    expect(isSameStrokeErrorHint(hint, other!)).toBe(false)
  })
})
