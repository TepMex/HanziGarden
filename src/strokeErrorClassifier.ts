import type { HanziCharacterJson } from './hanziData'

export type Point = { x: number; y: number }

export type DrawnPath = {
  points?: Array<Partial<Point> | null> | null
}

export type ClassifyStrokeErrorInput = {
  expectedStrokeIndex: number
  drawnPath: DrawnPath | null | undefined
  characterData: Pick<HanziCharacterJson, 'medians'>
  /** Public Hanzi Writer quiz field: the reversed path would have matched the expected stroke. */
  isBackwards?: boolean
}

export type StrokeError =
  | {
      type: 'wrong-order'
      expectedStroke: number
      attemptedStroke: number
      confidence: number
    }
  | {
      type: 'wrong-direction'
      expectedStroke: number
      confidence: number
    }
  | {
      type: 'bad-shape'
      expectedStroke: number
      confidence: number
    }
  | {
      type: 'unknown'
      expectedStroke: number
    }

export type StrokeErrorDebugInfo = {
  expectedStroke: number
  expectedDistance: number | null
  bestFutureStroke: number | null
  bestFutureDistance: number | null
  normalDirectionScore: number | null
  reverseDirectionScore: number | null
  result: StrokeError['type']
  confidence: number
}

/** Resample both the user path and each median so drawing speed does not dominate the score. */
export const STROKE_SAMPLE_COUNT = 24

/**
 * A later stroke must be this much closer than the expected one.
 * 0.55 is stricter than a naive 0.65 so similar horizontals in 三/王/丰 stay conservative.
 */
export const WRONG_ORDER_DISTANCE_RATIO = 0.55

/** Absolute cap (Make Me a Hanzi 1024-space) for treating a later stroke as a real match. */
export const MAX_MATCH_DISTANCE = 110

/**
 * If the expected stroke is still reasonably close, the player probably aimed at it.
 * Do not accuse them of writing a later stroke.
 */
export const MIN_EXPECTED_DISTANCE_FOR_WRONG_ORDER = 140

/** When two later strokes fit almost equally well, do not name one of them. */
export const FUTURE_AMBIGUITY_RATIO = 0.82

export const MIN_WRONG_ORDER_CONFIDENCE = 0.62

/** Expected-stroke chamfer must be this good before reverse direction is claimed. */
export const DIRECTION_MAX_MATCH_DISTANCE = 160

/** Reverse start/end score must beat the forward score by this ratio. */
export const DIRECTION_REVERSE_RATIO = 0.55

export const MIN_DIRECTION_CONFIDENCE = 0.58

/** Ignore specks and tap artefacts; Hanzi Writer also needs at least two distinct points. */
export const MIN_PATH_LENGTH = 40

export const MIN_LENGTH_RATIO = 0.4

export const MIN_POINTS_FOR_CLASSIFICATION = 2

export function displayStrokeNumber(strokeIndex: number): number {
  return strokeIndex + 1
}

/**
 * Classify a rejected Hanzi Writer stroke.
 *
 * Check order first: a later stroke of 三/王 can look "backwards" relative to the
 * expected one if we only inspect endpoints. Only after that, if the geometry
 * still belongs to the expected stroke, detect reverse direction. Everything
 * else is a shape/placement miss. Hanzi Writer remains the authority for
 * accept/reject; this module only explains an already-rejected gesture.
 */
export function classifyStrokeError(input: ClassifyStrokeErrorInput): StrokeError {
  const { error, debug } = diagnoseStrokeError(input)
  logStrokeErrorDebug(debug)
  return error
}

export function diagnoseStrokeError(input: ClassifyStrokeErrorInput): {
  error: StrokeError
  debug: StrokeErrorDebugInfo
} {
  const expectedStroke = Number.isInteger(input.expectedStrokeIndex) ? input.expectedStrokeIndex : 0
  const unknown = (): { error: StrokeError; debug: StrokeErrorDebugInfo } => ({
    error: { type: 'unknown', expectedStroke },
    debug: emptyDebug(expectedStroke, 'unknown'),
  })

  const medians = input.characterData.medians
  if (!Array.isArray(medians) || expectedStroke < 0 || expectedStroke >= medians.length) {
    return unknown()
  }

  const userPoints = sanitizePoints(input.drawnPath?.points)
  if (userPoints.length < MIN_POINTS_FOR_CLASSIFICATION) return unknown()

  const userLength = polylineLength(userPoints)
  if (!Number.isFinite(userLength) || userLength < MIN_PATH_LENGTH) return unknown()

  const expectedMedian = toPoints(medians[expectedStroke])
  if (expectedMedian.length < 1) return unknown()

  const sampledUser = resample(userPoints, STROKE_SAMPLE_COUNT)
  const expectedDistance = chamferDistance(sampledUser, expectedMedian)
  const expectedLength = polylineLength(expectedMedian)
  const expectedLengthRatio = lengthRatio(userLength, expectedLength)

  const futureMatches: Array<{ index: number; distance: number }> = []
  for (let index = expectedStroke + 1; index < medians.length; index += 1) {
    const median = toPoints(medians[index])
    if (median.length < 1) continue
    if (lengthRatio(userLength, polylineLength(median)) < MIN_LENGTH_RATIO) continue
    const distance = chamferDistance(sampledUser, median)
    if (!Number.isFinite(distance)) continue
    futureMatches.push({ index, distance })
  }
  futureMatches.sort((left, right) => left.distance - right.distance)

  const bestFuture = futureMatches[0] ?? null
  const secondFuture = futureMatches[1] ?? null
  const endpoints = endpointScores(userPoints, expectedMedian)
  const orderedForward = orderedAverageDistance(sampledUser, resample(expectedMedian, STROKE_SAMPLE_COUNT))
  const orderedReverse = orderedAverageDistance(
    sampledUser,
    resample([...expectedMedian].reverse(), STROKE_SAMPLE_COUNT),
  )

  const wrongOrder = evaluateWrongOrder({
    expectedStroke,
    expectedDistance,
    bestFuture,
    secondFuture,
  })
  if (wrongOrder) {
    return finish(wrongOrder, {
      expectedStroke,
      expectedDistance,
      bestFutureStroke: bestFuture?.index ?? null,
      bestFutureDistance: bestFuture?.distance ?? null,
      normalDirectionScore: endpoints.normal,
      reverseDirectionScore: endpoints.reverse,
      result: wrongOrder.type,
      confidence: wrongOrder.confidence,
    })
  }

  const wrongDirection = evaluateWrongDirection({
    expectedStroke,
    expectedDistance,
    expectedLengthRatio,
    endpoints,
    orderedForward,
    orderedReverse,
    isBackwards: input.isBackwards === true,
  })
  if (wrongDirection) {
    return finish(wrongDirection, {
      expectedStroke,
      expectedDistance,
      bestFutureStroke: bestFuture?.index ?? null,
      bestFutureDistance: bestFuture?.distance ?? null,
      normalDirectionScore: endpoints.normal,
      reverseDirectionScore: endpoints.reverse,
      result: wrongDirection.type,
      confidence: wrongDirection.confidence,
    })
  }

  const badShape: StrokeError = {
    type: 'bad-shape',
    expectedStroke,
    confidence: badShapeConfidence(expectedDistance, bestFuture?.distance ?? null),
  }
  return finish(badShape, {
    expectedStroke,
    expectedDistance,
    bestFutureStroke: bestFuture?.index ?? null,
    bestFutureDistance: bestFuture?.distance ?? null,
    normalDirectionScore: endpoints.normal,
    reverseDirectionScore: endpoints.reverse,
    result: 'bad-shape',
    confidence: badShape.confidence,
  })
}

export function isStrokeErrorDebugEnabled(): boolean {
  try {
    if (!import.meta.env?.DEV) return false
    if (typeof window !== 'undefined' && window.hanziGardenDebugStrokeErrors === true) return true
    if (typeof localStorage !== 'undefined' && localStorage.getItem('hanziGarden.debugStrokeErrors') === '1') {
      return true
    }
    if (typeof location !== 'undefined') {
      return new URLSearchParams(location.search).get('debugStrokes') === '1'
    }
  } catch {
    return false
  }
  return false
}

export function logStrokeErrorDebug(
  debug: StrokeErrorDebugInfo,
  sink: (entry: StrokeErrorDebugInfo) => void = defaultDebugSink,
): void {
  if (!isStrokeErrorDebugEnabled()) return
  sink(debug)
}

declare global {
  interface Window {
    hanziGardenDebugStrokeErrors?: boolean
  }
}

function evaluateWrongOrder({
  expectedStroke,
  expectedDistance,
  bestFuture,
  secondFuture,
}: {
  expectedStroke: number
  expectedDistance: number
  bestFuture: { index: number; distance: number } | null
  secondFuture: { index: number; distance: number } | null
}): Extract<StrokeError, { type: 'wrong-order' }> | null {
  if (!bestFuture) return null
  if (!Number.isFinite(expectedDistance) || !Number.isFinite(bestFuture.distance)) return null
  if (bestFuture.distance >= MAX_MATCH_DISTANCE) return null
  if (expectedDistance < MIN_EXPECTED_DISTANCE_FOR_WRONG_ORDER) return null
  if (bestFuture.distance >= expectedDistance * WRONG_ORDER_DISTANCE_RATIO) return null
  if (secondFuture && secondFuture.distance <= bestFuture.distance / FUTURE_AMBIGUITY_RATIO) return null

  const ratio = bestFuture.distance / Math.max(expectedDistance, 1)
  const ratioScore = clamp01((WRONG_ORDER_DISTANCE_RATIO - ratio) / WRONG_ORDER_DISTANCE_RATIO)
  const absScore = clamp01(1 - bestFuture.distance / MAX_MATCH_DISTANCE)
  const gapScore = clamp01((expectedDistance - bestFuture.distance) / Math.max(expectedDistance, 1))
  const uniqueness = secondFuture
    ? clamp01(1 - bestFuture.distance / Math.max(secondFuture.distance, 1))
    : 1
  const confidence = clamp01(0.35 * ratioScore + 0.3 * absScore + 0.2 * gapScore + 0.15 * uniqueness)
  if (confidence < MIN_WRONG_ORDER_CONFIDENCE) return null

  return {
    type: 'wrong-order',
    expectedStroke,
    attemptedStroke: bestFuture.index,
    confidence,
  }
}

function evaluateWrongDirection({
  expectedStroke,
  expectedDistance,
  expectedLengthRatio,
  endpoints,
  orderedForward,
  orderedReverse,
  isBackwards,
}: {
  expectedStroke: number
  expectedDistance: number
  expectedLengthRatio: number
  endpoints: { normal: number; reverse: number }
  orderedForward: number
  orderedReverse: number
  isBackwards: boolean
}): Extract<StrokeError, { type: 'wrong-direction' }> | null {
  if (!Number.isFinite(expectedDistance) || expectedDistance > DIRECTION_MAX_MATCH_DISTANCE) return null
  if (expectedLengthRatio < MIN_LENGTH_RATIO) return null
  if (!Number.isFinite(endpoints.normal) || !Number.isFinite(endpoints.reverse)) return null

  const reverseEndpointsBetter = endpoints.reverse < endpoints.normal * DIRECTION_REVERSE_RATIO
  const reverseShapeBetter = orderedReverse < orderedForward * DIRECTION_REVERSE_RATIO
  const writerBackwards = isBackwards && expectedDistance <= DIRECTION_MAX_MATCH_DISTANCE
  if (!writerBackwards && !(reverseEndpointsBetter && reverseShapeBetter)) return null

  const reverseAdvantage = clamp01(1 - endpoints.reverse / Math.max(endpoints.normal, 1))
  const fitScore = clamp01(1 - expectedDistance / DIRECTION_MAX_MATCH_DISTANCE)
  const confidence = clamp01(
    writerBackwards
      ? Math.max(0.82, 0.4 * reverseAdvantage + 0.6 * fitScore)
      : 0.55 * reverseAdvantage + 0.45 * fitScore,
  )
  if (confidence < MIN_DIRECTION_CONFIDENCE) return null

  return { type: 'wrong-direction', expectedStroke, confidence }
}

function badShapeConfidence(expectedDistance: number, bestFutureDistance: number | null): number {
  const expectedScore = clamp01(expectedDistance / 400)
  const futureScore = bestFutureDistance == null ? 0.3 : clamp01(bestFutureDistance / 400)
  return clamp01(0.45 + 0.3 * expectedScore + 0.15 * futureScore)
}

function finish(error: StrokeError, debug: StrokeErrorDebugInfo): { error: StrokeError; debug: StrokeErrorDebugInfo } {
  return { error, debug }
}

function emptyDebug(expectedStroke: number, result: StrokeError['type']): StrokeErrorDebugInfo {
  return {
    expectedStroke,
    expectedDistance: null,
    bestFutureStroke: null,
    bestFutureDistance: null,
    normalDirectionScore: null,
    reverseDirectionScore: null,
    result,
    confidence: 0,
  }
}

function defaultDebugSink(debug: StrokeErrorDebugInfo): void {
  console.info('[HanziGarden:stroke-error]', debug)
}

function sanitizePoints(points: DrawnPath['points']): Point[] {
  if (!Array.isArray(points)) return []
  const sanitized: Point[] = []
  for (const point of points) {
    const x = point?.x
    const y = point?.y
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const previous = sanitized[sanitized.length - 1]
    if (previous && previous.x === x && previous.y === y) continue
    sanitized.push({ x, y })
  }
  return sanitized
}

function toPoints(median: number[][] | undefined): Point[] {
  if (!Array.isArray(median)) return []
  const points: Point[] = []
  for (const pair of median) {
    const x = pair?.[0]
    const y = pair?.[1]
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    points.push({ x, y })
  }
  return points
}

function polylineLength(points: Point[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += hypot(points[index - 1]!, points[index]!)
  }
  return total
}

function lengthRatio(left: number, right: number): number {
  const longest = Math.max(left, right, 1)
  const shortest = Math.min(left, right)
  return shortest / longest
}

function resample(points: Point[], sampleCount: number): Point[] {
  if (points.length === 0) return []
  if (sampleCount <= 1) return [{ ...points[0]! }]
  if (points.length === 1) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }))

  const total = polylineLength(points)
  if (total === 0) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }))

  const sampled: Point[] = [{ ...points[0]! }]
  const step = total / (sampleCount - 1)
  let accumulated = 0
  let cursor = 0

  for (let index = 1; index < sampleCount - 1; index += 1) {
    const target = step * index
    while (cursor < points.length - 1) {
      const start = points[cursor]!
      const end = points[cursor + 1]!
      const segment = hypot(start, end)
      if (accumulated + segment >= target) {
        const t = segment === 0 ? 0 : (target - accumulated) / segment
        sampled.push({
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        })
        break
      }
      accumulated += segment
      cursor += 1
    }
  }

  sampled.push({ ...points[points.length - 1]! })
  while (sampled.length < sampleCount) sampled.push({ ...points[points.length - 1]! })
  return sampled
}

function chamferDistance(left: Point[], right: Point[]): number {
  const sampledRight = resample(right, STROKE_SAMPLE_COUNT)
  return (averageDistanceToPolyline(left, right) + averageDistanceToPolyline(sampledRight, left)) / 2
}

function averageDistanceToPolyline(points: Point[], polyline: Point[]): number {
  if (points.length === 0 || polyline.length === 0) return Number.POSITIVE_INFINITY
  let total = 0
  for (const point of points) total += distanceToPolyline(point, polyline)
  return total / points.length
}

function orderedAverageDistance(left: Point[], right: Point[]): number {
  const count = Math.min(left.length, right.length)
  if (count === 0) return Number.POSITIVE_INFINITY
  let total = 0
  for (let index = 0; index < count; index += 1) total += hypot(left[index]!, right[index]!)
  return total / count
}

function endpointScores(user: Point[], median: Point[]): { normal: number; reverse: number } {
  const userStart = user[0]!
  const userEnd = user[user.length - 1]!
  const medianStart = median[0]!
  const medianEnd = median[median.length - 1]!
  return {
    normal: hypot(userStart, medianStart) + hypot(userEnd, medianEnd),
    reverse: hypot(userStart, medianEnd) + hypot(userEnd, medianStart),
  }
}

function distanceToPolyline(point: Point, polyline: Point[]): number {
  if (polyline.length === 1) return hypot(point, polyline[0]!)
  let min = Number.POSITIVE_INFINITY
  for (let index = 1; index < polyline.length; index += 1) {
    min = Math.min(min, distanceToSegment(point, polyline[index - 1]!, polyline[index]!))
  }
  return min
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return hypot(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq))
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

function hypot(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
