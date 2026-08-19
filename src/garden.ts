import type { PlotDefinition } from './data/model'
import type { CardState } from './learning'
import { isCardDue } from './learning'

type InfectionPlot = Pick<PlotDefinition, 'characters'>

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Fraction of characters which are new or due, without stroke weighting. */
export function plotDueFraction(
  plot: InfectionPlot,
  cards: Readonly<Record<string, CardState>>,
  now = new Date(),
): number {
  if (plot.characters.length === 0) return 0
  const due = plot.characters.filter((character) => isCardDue(cards[character.id], now)).length
  return due / plot.characters.length
}

/** Visual weed area for an unlocked plot. */
export function weedCoverageFromDueFraction(dueFraction: number): number {
  const due = clamp01(dueFraction)
  if (due === 0) return 0
  if (due <= 0.3) return 0.3
  return due
}

/**
 * Infection is a live projection of unfinished memory work.  Progression
 * access deliberately has no role here: a locked plot still contains new
 * characters and therefore remains visually overgrown.
 */
export function plotInfection(
  plot: InfectionPlot,
  cards: Readonly<Record<string, CardState>>,
  now = new Date(),
): number {
  const totalWeight = plot.characters.reduce((sum, character) => sum + character.strokeCount, 0)
  const weedWeight = plot.characters.reduce(
    (sum, character) => sum + (isCardDue(cards[character.id], now) ? character.strokeCount : 0),
    0,
  )
  return totalWeight ? weedWeight / totalWeight : 0
}

/** Preserve the battle health behaviour independently from the map mask. */
export function battlePlotCleanliness(infection: number): number {
  const normalized = clamp01(infection)
  if (normalized === 0) return 1
  return Math.min(0.4, 1 - normalized)
}
