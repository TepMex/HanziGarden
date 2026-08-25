export type HanziWriterDemoType = 'hanzi-writer-animation' | 'hanzi-writer-quiz'

export type WalkthroughDemo = {
  type: HanziWriterDemoType
  character?: string
  options?: Record<string, unknown>
}

export type HanziWalkthrough = {
  id: string
  hanzi: string
  trigger: { type: 'first-appearance' }
  title: string
  chineseTitle?: string
  description: string
  demo?: WalkthroughDemo
}

export type WalkthroughSurface = 'battle' | 'preview'

export type WalkthroughAppearance = {
  surface: WalkthroughSurface
  isFirstEncounter: boolean
  completedWalkthroughIds: readonly string[]
}

export const hanziWalkthroughs: Readonly<Record<string, readonly HanziWalkthrough[]>> = {
  二: [{
    id: 'stroke-order-top-to-bottom',
    hanzi: '二',
    trigger: { type: 'first-appearance' },
    title: 'Сверху вниз',
    chineseTitle: '从上到下',
    description: 'Если черты расположены одна над другой, обычно сначала пишется верхняя, затем нижняя.\n\nНа 二 сначала пишется верхняя 一, затем нижняя 一.',
    demo: { type: 'hanzi-writer-animation' },
  }],
  四: [{
    id: 'stroke-order-outside-then-inside',
    hanzi: '四',
    trigger: { type: 'first-appearance' },
    title: 'Сначала снаружи, потом внутри',
    chineseTitle: '先外后内',
    description: 'Когда элементы находятся внутри рамки, сначала начинаем внешнюю часть иероглифа, а затем переходим к содержимому.\n\nПосмотри на порядок черт в 四.',
    demo: { type: 'hanzi-writer-animation' },
  }],
  八: [{
    id: 'stroke-order-left-falling-then-right-falling',
    hanzi: '八',
    trigger: { type: 'first-appearance' },
    title: 'Сначала влево, потом вправо',
    chineseTitle: '先撇后捺',
    description: 'Когда рядом встречаются откидные черты 丿 и ㇏, сначала обычно пишется 丿, затем ㇏.\n\nЭто хорошо видно на 八.',
    demo: { type: 'hanzi-writer-animation' },
  }],
  十: [{
    id: 'stroke-order-horizontal-then-vertical',
    hanzi: '十',
    trigger: { type: 'first-appearance' },
    title: 'Горизонталь перед вертикалью',
    chineseTitle: '先横后竖',
    description: 'Когда горизонтальная и вертикальная черты пересекаются, обычно сначала пишется горизонтальная, затем вертикальная.\n\nНа 十: сначала 一, потом 丨.',
    demo: { type: 'hanzi-writer-animation' },
  }],
  日: [{
    id: 'stroke-order-close-the-frame',
    hanzi: '日',
    trigger: { type: 'first-appearance' },
    title: 'Закрываем рамку в конце',
    chineseTitle: '先外后内再封口',
    description: 'Если иероглиф содержит закрытую рамку, её нижняя закрывающая черта обычно пишется после содержимого.\n\nНа 日 сначала строится рамка, затем пишется внутренняя черта, и только после этого рамка закрывается снизу.',
    demo: { type: 'hanzi-writer-animation' },
  }],
  胡: [{
    id: 'stroke-order-left-to-right',
    hanzi: '胡',
    trigger: { type: 'first-appearance' },
    title: 'Слева направо',
    chineseTitle: '从左到右',
    description: 'Если иероглиф состоит из частей, расположенных рядом, обычно сначала пишется левая часть, затем правая.\n\nВ 胡 сначала полностью пишется 古, затем 月.',
    demo: { type: 'hanzi-writer-animation' },
  }],
  小: [{
    id: 'stroke-order-center-then-sides',
    hanzi: '小',
    trigger: { type: 'first-appearance' },
    title: 'Сначала центр, потом стороны',
    chineseTitle: '先中间后两边',
    description: 'В некоторых симметричных иероглифах сначала пишется центральная часть, а затем элементы по сторонам.\n\nНа 小 сначала идёт центральная черта, затем боковые.',
    demo: { type: 'hanzi-writer-animation' },
  }],
}

export function walkthroughsForHanzi(
  hanzi: string,
  registry: Readonly<Record<string, readonly HanziWalkthrough[]>> = hanziWalkthroughs,
): readonly HanziWalkthrough[] {
  return registry[hanzi] ?? []
}

export function nextEligibleWalkthrough(
  hanzi: string,
  appearance: WalkthroughAppearance,
  registry: Readonly<Record<string, readonly HanziWalkthrough[]>> = hanziWalkthroughs,
): HanziWalkthrough | undefined {
  if (appearance.surface !== 'battle') return undefined
  const completed = new Set(appearance.completedWalkthroughIds)
  return walkthroughsForHanzi(hanzi, registry).find((item) => {
    if (completed.has(item.id)) return false
    if (item.trigger.type === 'first-appearance' && !appearance.isFirstEncounter) return false
    return true
  })
}

export function withCompletedWalkthroughId(
  completedWalkthroughIds: readonly string[],
  walkthroughId: string,
): string[] {
  return completedWalkthroughIds.includes(walkthroughId)
    ? [...completedWalkthroughIds]
    : [...completedWalkthroughIds, walkthroughId]
}

export function demoCharacter(walkthrough: HanziWalkthrough): string {
  return walkthrough.demo?.character ?? walkthrough.hanzi
}
