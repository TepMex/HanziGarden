import { describe, expect, test } from 'bun:test'
import type { CardState } from '../src/learning'
import { isInitialTrace } from '../src/learning'

describe('initial learning sequence', () => {
  test('traces only before the persisted initial recall becomes pending', () => {
    expect(isInitialTrace(undefined, false)).toBe(true)
    expect(isInitialTrace(undefined, true)).toBe(false)
    expect(isInitialTrace({} as CardState, false)).toBe(false)
  })
})
