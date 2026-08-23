import { describe, expect, test } from 'bun:test'
import { FIRST_ENCOUNTER_OUTLINE_OPACITY, inkWithOpacity, writingInkForBackdrop } from '../src/battleInk'

function rgbaParts(color: string): [number, number, number, number] {
  const match = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color)
  if (!match) throw new Error(`Expected an rgba colour, received ${color}`)
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
}

describe('battle writing ink', () => {
  test('keeps completed strokes opaque and bright on the two dark battle states', () => {
    for (const stage of ['fullDirty', 'halfDirty'] as const) {
      const [red, green, blue, opacity] = rgbaParts(writingInkForBackdrop(stage).completedStrokeColor)
      const brightness = red * 0.2126 + green * 0.7152 + blue * 0.0722

      expect(opacity).toBeGreaterThanOrEqual(.94)
      expect(brightness).toBeGreaterThanOrEqual(220)
    }
  })

  test('turns drawing ink into a first-encounter ghost at the documented opacity', () => {
    expect(inkWithOpacity('#fff2ca', FIRST_ENCOUNTER_OUTLINE_OPACITY)).toBe('rgba(255, 242, 202, 0.3)')
    expect(inkWithOpacity('#25201c', FIRST_ENCOUNTER_OUTLINE_OPACITY)).toBe('rgba(37, 32, 28, 0.3)')
    expect(inkWithOpacity('rgba(255, 239, 198, .98)', FIRST_ENCOUNTER_OUTLINE_OPACITY)).toBe(
      'rgba(255, 239, 198, 0.3)',
    )
  })
})
