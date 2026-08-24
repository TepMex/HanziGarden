import { describe, expect, test } from 'bun:test'
import { displayStrokeNumber } from '../src/strokeErrorClassifier'
import { isSameStrokeErrorHint, strokeErrorCopy } from '../src/strokeErrorFeedback'

describe('stroke error feedback copy', () => {
  test('uses 1-based stroke numbers for a confident order miss', () => {
    const copy = strokeErrorCopy({
      type: 'wrong-order',
      expectedStroke: 2,
      attemptedStroke: 4,
      confidence: 0.9,
    })

    expect(copy.title).toBe('Неправильный порядок черт')
    expect(copy.detail).toContain(`черту ${displayStrokeNumber(2)}`)
    expect(copy.detail).toContain(`черты ${displayStrokeNumber(4)}`)
    expect(copy.detail).toContain('3')
    expect(copy.detail).toContain('5')
    expect(copy.detail).not.toContain('wrong-order')
  })

  test('keeps low-confidence order misses generic', () => {
    const copy = strokeErrorCopy({
      type: 'wrong-order',
      expectedStroke: 2,
      attemptedStroke: 4,
      confidence: 0.4,
    })

    expect(copy.detail).toBe('Сначала напиши выделенную черту.')
    expect(copy.detail).not.toContain('5')
  })

  test('uses instructional copy for direction and shape without internal type names', () => {
    expect(strokeErrorCopy({ type: 'wrong-direction', expectedStroke: 2, confidence: 0.85 })).toEqual({
      type: 'wrong-direction',
      title: 'Неверное направление',
      detail: 'Проведи эту черту в другую сторону.',
    })
    expect(strokeErrorCopy({ type: 'bad-shape', expectedStroke: 2, confidence: 0.5 }).title).toBe('Попробуй ещё раз')
    expect(strokeErrorCopy({ type: 'unknown', expectedStroke: 2 }).detail).toBe('Следуй форме выделенной черты.')
  })

  test('treats an identical hint as a replacement rather than a new message', () => {
    const hint = strokeErrorCopy({ type: 'wrong-direction', expectedStroke: 0, confidence: 0.9 })
    expect(isSameStrokeErrorHint(hint, hint)).toBe(true)
    expect(isSameStrokeErrorHint(hint, strokeErrorCopy({ type: 'bad-shape', expectedStroke: 0, confidence: 0.5 }))).toBe(false)
  })
})
