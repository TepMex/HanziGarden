import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { HanziCharacterJson } from '../src/hanziData'
import {
  classifyStrokeError,
  diagnoseStrokeError,
  displayStrokeNumber,
  type DrawnPath,
} from '../src/strokeErrorClassifier'

function loadCharacter(hanzi: string): HanziCharacterJson {
  const path = resolve(import.meta.dir, `../public/hanzi/${hanzi}.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as HanziCharacterJson
}

function pathFromMedian(median: number[][], options?: {
  reverse?: boolean
  dense?: boolean
  offset?: { x: number; y: number }
}): DrawnPath {
  let points = median.map(([x, y]) => ({ x, y }))
  if (options?.reverse) points = [...points].reverse()
  if (options?.offset) {
    points = points.map((point) => ({ x: point.x + options.offset!.x, y: point.y + options.offset!.y }))
  }
  if (options?.dense) {
    const dense: Array<{ x: number; y: number }> = []
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]!
      const end = points[index + 1]!
      for (let step = 0; step < 12; step += 1) {
        const t = step / 12
        dense.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
      }
    }
    dense.push(points[points.length - 1]!)
    points = dense
  }
  return { points }
}

function classify(hanzi: string, expectedStrokeIndex: number, drawnPath: DrawnPath, isBackwards?: boolean) {
  return classifyStrokeError({
    expectedStrokeIndex,
    drawnPath,
    characterData: loadCharacter(hanzi),
    isBackwards,
  })
}

describe('stroke error classifier', () => {
  test('classifies a later-stroke gesture as wrong-order', () => {
    const san = loadCharacter('三')
    const error = classify('三', 0, pathFromMedian(san.medians[2]!, { dense: true }))

    expect(error).toMatchObject({
      type: 'wrong-order',
      expectedStroke: 0,
      attemptedStroke: 2,
    })
    if (error.type !== 'wrong-order') throw new Error('expected wrong-order')
    expect(error.confidence).toBeGreaterThan(0.7)
    expect(displayStrokeNumber(error.expectedStroke)).toBe(1)
    expect(displayStrokeNumber(error.attemptedStroke)).toBe(3)
  })

  test('maps expected stroke 2 to attempted stroke 4 when that later median is the match', () => {
    const horizontals = [0, 80, 160, 240, 500].map((y) => [[40, y], [220, y], [900, y]])
    const error = classifyStrokeError({
      expectedStrokeIndex: 2,
      drawnPath: pathFromMedian(horizontals[4]!, { dense: true }),
      characterData: { medians: horizontals },
    })

    expect(error).toMatchObject({
      type: 'wrong-order',
      expectedStroke: 2,
      attemptedStroke: 4,
    })
    expect(displayStrokeNumber(2)).toBe(3)
    expect(displayStrokeNumber(4)).toBe(5)
  })

  test('classifies a reversed expected stroke as wrong-direction', () => {
    const san = loadCharacter('三')
    const error = classify('三', 2, pathFromMedian(san.medians[2]!, { reverse: true, dense: true }))

    expect(error.type).toBe('wrong-direction')
    expect(error.expectedStroke).toBe(2)
    if (error.type !== 'wrong-direction') throw new Error('expected wrong-direction')
    expect(error.confidence).toBeGreaterThan(0.7)
  })

  test('uses Hanzi Writer isBackwards when the expected geometry still fits', () => {
    const san = loadCharacter('三')
    const error = classify('三', 0, pathFromMedian(san.medians[0]!, { reverse: true, dense: true }), true)

    expect(error.type).toBe('wrong-direction')
    expect(error.expectedStroke).toBe(0)
  })

  test('classifies an unrelated scribble as bad-shape', () => {
    const error = classify('三', 0, {
      points: [
        { x: 80, y: 80 },
        { x: 140, y: 520 },
        { x: 90, y: 900 },
        { x: 200, y: 860 },
      ],
    })

    expect(error.type).toBe('bad-shape')
    expect(error.expectedStroke).toBe(0)
  })

  test('does not claim wrong-order for similar nearby horizontals', () => {
    const wang = loadCharacter('王')
    const top = wang.medians[0]!
    const middle = wang.medians[1]!
    const blended = top.map((point, index) => {
      const other = middle[Math.min(index, middle.length - 1)]!
      return {
        x: point[0] * 0.55 + other[0] * 0.45,
        y: point[1] * 0.55 + other[1] * 0.45,
      }
    })

    const error = classify('王', 0, { points: blended })
    expect(error.type).not.toBe('wrong-order')
  })

  test('does not throw or return NaN confidence for tiny or malformed paths', () => {
    const characterData = loadCharacter('一')
    const empty = classifyStrokeError({ expectedStrokeIndex: 0, drawnPath: { points: [] }, characterData })
    const single = classifyStrokeError({
      expectedStrokeIndex: 0,
      drawnPath: { points: [{ x: 10, y: 10 }] },
      characterData,
    })
    const malformed = classifyStrokeError({
      expectedStrokeIndex: 0,
      drawnPath: { points: [{ x: Number.NaN, y: 4 }, { x: 8, y: Number.POSITIVE_INFINITY }, null] },
      characterData,
    })

    expect(empty.type).toBe('unknown')
    expect(single.type).toBe('unknown')
    expect(malformed.type).toBe('unknown')
    expect(empty.expectedStroke).toBe(0)
  })

  test('cannot classify wrong-order on the last stroke', () => {
    const yi = loadCharacter('一')
    const error = classify('一', 0, pathFromMedian(yi.medians[0]!, { reverse: true, dense: true }))

    expect(error.type).not.toBe('wrong-order')
    expect(diagnoseStrokeError({
      expectedStrokeIndex: 0,
      drawnPath: pathFromMedian(yi.medians[0]!, { reverse: true }),
      characterData: yi,
    }).debug.bestFutureStroke).toBeNull()
  })

  test('converts internal index 0 to UI number 1', () => {
    expect(displayStrokeNumber(0)).toBe(1)
    expect(displayStrokeNumber(4)).toBe(5)
  })

  test('keeps dense and sparse copies of the same gesture in the same category', () => {
    const san = loadCharacter('三')
    const sparse = classify('三', 0, pathFromMedian(san.medians[2]!))
    const dense = classify('三', 0, pathFromMedian(san.medians[2]!, { dense: true }))
    expect(sparse.type).toBe(dense.type)
    expect(sparse).toMatchObject({ type: 'wrong-order', attemptedStroke: 2 })
  })
})
