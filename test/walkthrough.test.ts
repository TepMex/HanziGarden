import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { hanziWalkthroughs, nextEligibleWalkthrough, withCompletedWalkthroughId, type HanziWalkthrough } from '../src/walkthrough'

function walkthrough(overrides: Partial<HanziWalkthrough> & Pick<HanziWalkthrough, 'id' | 'hanzi'>): HanziWalkthrough {
  return {
    trigger: { type: 'first-appearance' },
    title: 'Правило',
    description: 'Объяснение.',
    demo: { type: 'hanzi-writer-animation' },
    ...overrides,
  }
}

function appearance(overrides: Parameters<typeof nextEligibleWalkthrough>[1] = {
  surface: 'battle',
  isFirstEncounter: true,
  completedWalkthroughIds: [],
}) {
  return {
    surface: 'battle' as const,
    isFirstEncounter: true,
    completedWalkthroughIds: [] as readonly string[],
    ...overrides,
  }
}

describe('walkthrough eligibility', () => {
  test('selects the first unseen first-appearance walkthrough in a real battle', () => {
    const registry = {
      木: [
        walkthrough({ id: 'center-then-sides', hanzi: '木', title: 'Сначала центр' }),
        walkthrough({ id: 'left-to-right', hanzi: '木', title: 'Слева направо' }),
      ],
    }

    const selected = nextEligibleWalkthrough('木', appearance(), registry)
    expect(selected?.id).toBe('center-then-sides')
    expect(selected?.title).toBe('Сначала центр')
  })

  test('skips completed ids and continues with the next walkthrough for the same hanzi', () => {
    const registry = {
      木: [
        walkthrough({ id: 'center-then-sides', hanzi: '木' }),
        walkthrough({ id: 'left-to-right', hanzi: '木' }),
      ],
    }

    const selected = nextEligibleWalkthrough('木', appearance({
      completedWalkthroughIds: ['center-then-sides'],
    }), registry)
    expect(selected?.id).toBe('left-to-right')
  })

  test('does not reopen a walkthrough after it has been completed', () => {
    const registry = {
      二: [walkthrough({ id: 'top-to-bottom', hanzi: '二' })],
    }

    expect(nextEligibleWalkthrough('二', appearance({
      completedWalkthroughIds: ['top-to-bottom'],
    }), registry)).toBeUndefined()
  })

  test('first-appearance does not trigger on a later review of the same hanzi', () => {
    const registry = {
      二: [walkthrough({ id: 'top-to-bottom', hanzi: '二' })],
    }

    expect(nextEligibleWalkthrough('二', appearance({ isFirstEncounter: false }), registry)).toBeUndefined()
  })

  test('preview and debug surfaces do not mark or show a teaching walkthrough', () => {
    const registry = {
      二: [walkthrough({ id: 'top-to-bottom', hanzi: '二' })],
    }

    expect(nextEligibleWalkthrough('二', appearance({ surface: 'preview' }), registry)).toBeUndefined()
  })

  test('an unregistered hanzi never requires a special-case in game flow', () => {
    expect(nextEligibleWalkthrough('一', appearance(), { 二: [walkthrough({ id: 'top-to-bottom', hanzi: '二' })] })).toBeUndefined()
  })
})

describe('walkthrough completion state', () => {
  test('records completion by walkthrough id, not by opening or by hanzi', () => {
    expect(withCompletedWalkthroughId([], 'top-to-bottom')).toEqual(['top-to-bottom'])
    expect(withCompletedWalkthroughId(['top-to-bottom'], 'top-to-bottom')).toEqual(['top-to-bottom'])
    expect(withCompletedWalkthroughId(['top-to-bottom'], 'left-to-right')).toEqual(['top-to-bottom', 'left-to-right'])
  })
})

describe('stroke-order walkthrough catalog', () => {
  const examples = [
    { hanzi: '二', title: 'Сверху вниз', chineseTitle: '从上到下' },
    { hanzi: '四', title: 'Сначала снаружи, потом внутри', chineseTitle: '先外后内' },
    { hanzi: '八', title: 'Сначала влево, потом вправо', chineseTitle: '先撇后捺' },
    { hanzi: '十', title: 'Горизонталь перед вертикалью', chineseTitle: '先横后竖' },
    { hanzi: '日', title: 'Закрываем рамку в конце', chineseTitle: '先外后内再封口' },
    { hanzi: '胡', title: 'Слева направо', chineseTitle: '从左到右' },
    { hanzi: '小', title: 'Сначала центр, потом стороны', chineseTitle: '先中间后两边' },
  ] as const

  test('binds one stroke-order rule to each introductory hanzi without special-casing game flow', () => {
    const ids = Object.values(hanziWalkthroughs).flat().map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(7)

    for (const example of examples) {
      const list = hanziWalkthroughs[example.hanzi]
      expect(list).toHaveLength(1)
      const item = list![0]!
      expect(item.hanzi).toBe(example.hanzi)
      expect(item.trigger).toEqual({ type: 'first-appearance' })
      expect(item.title).toBe(example.title)
      expect(item.chineseTitle).toBe(example.chineseTitle)
      expect(item.demo?.type).toBe('hanzi-writer-animation')
      expect(item.demo?.character ?? item.hanzi).toBe(example.hanzi)
    }
  })

  test('introduces only the rule assigned to that hanzi', () => {
    const outside = hanziWalkthroughs['四']![0]!
    const closeFrame = hanziWalkthroughs['日']![0]!
    expect(outside.description).not.toMatch(/закрыва/i)
    expect(outside.chineseTitle).not.toContain('封口')
    expect(closeFrame.description).toMatch(/закрыва/i)
    expect(closeFrame.chineseTitle).toContain('封口')
    expect(hanziWalkthroughs['八']![0]!.description).toMatch(/丿/)
    expect(hanziWalkthroughs['八']![0]!.description).toMatch(/㇏/)
  })

  test('battle flow looks up walkthroughs by registry instead of hardcoded hanzi branches', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
    for (const hanzi of examples.map((example) => example.hanzi)) {
      expect(app).not.toContain(`'${hanzi}'`)
      expect(app).not.toContain(`"${hanzi}"`)
    }
    expect(app).toContain('nextEligibleWalkthrough')
  })
})
