import type { BattleBackdropStage } from './data/battleBiomeArt'

export type BattleInkPalette = {
  drawingColor: string
  completedStrokeColor: string
}

/** Faint full-character ghost used only on the first encounter (SRS Новый). */
export const FIRST_ENCOUNTER_OUTLINE_OPACITY = 0.3

export function inkWithOpacity(color: string, opacity: number): string {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim())
  if (hex) {
    let body = hex[1]!
    if (body.length === 3) body = [...body].map((digit) => digit + digit).join('')
    const red = Number.parseInt(body.slice(0, 2), 16)
    const green = Number.parseInt(body.slice(2, 4), 16)
    const blue = Number.parseInt(body.slice(4, 6), 16)
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color)
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${opacity})`
  throw new Error(`Unsupported ink color: ${color}`)
}

const FULL_DIRTY_WRITING_INK: BattleInkPalette = {
  // Warm parchment ink reads clearly above the near-black stone at Y≈91.
  drawingColor: '#fff2ca',
  completedStrokeColor: 'rgba(255, 239, 198, .98)',
}

const HALF_DIRTY_WRITING_INK: BattleInkPalette = {
  drawingColor: '#ffedbd',
  completedStrokeColor: 'rgba(250, 230, 180, .96)',
}

const QUARTER_DIRTY_WRITING_INK: BattleInkPalette = {
  drawingColor: '#3d2e23',
  completedStrokeColor: 'rgba(52, 39, 30, .82)',
}

const CLEAN_WRITING_INK: BattleInkPalette = {
  drawingColor: '#25201c',
  completedStrokeColor: '#25201c',
}

/**
 * Kept at the battle-screen seam so every state change can use the same
 * palette as Hanzi Writer, rather than styling only the SVG after the fact.
 */
export function writingInkForBackdrop(stage: BattleBackdropStage): BattleInkPalette {
  switch (stage) {
    case 'fullDirty': return FULL_DIRTY_WRITING_INK
    case 'halfDirty': return HALF_DIRTY_WRITING_INK
    case 'quarterDirty': return QUARTER_DIRTY_WRITING_INK
    case 'clean': return CLEAN_WRITING_INK
  }
}
