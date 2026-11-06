import type { BiomeCulture } from '../data/mapLayout'

type PlantArt = { ground: string; accent: string; size: number; sprites: string[] }
// Whole transparent plants and the terrain palette come from the supplied Site.
// The seven additional cultures retain their own silhouettes in the canvas painter.
export const hexGardenArt: Record<BiomeCulture, PlantArt> = {
  bamboo: { ground: '#528449', accent: '#81a744', size: 305, sprites: ['bamboo-green', 'bamboo', 'bamboo-black'] },
  rice: { ground: '#a6b66b', accent: '#e5ce71', size: 220, sprites: [] },
  lotus: { ground: '#61b5a0', accent: '#53aaa1', size: 220, sprites: ['lotus', 'lotus-white', 'lotus-double'] },
  tea: { ground: '#749d55', accent: '#bfd084', size: 230, sprites: [] },
  blossom: { ground: '#b9bf79', accent: '#dca1b3', size: 305, sprites: ['sakura', 'sakura-white', 'sakura-weeping'] },
  peony: { ground: '#a9b66d', accent: '#cc7298', size: 230, sprites: ['peony-common', 'peony-rare', 'peony-legend'] },
  chrysanthemum: { ground: '#b6b871', accent: '#e9b94d', size: 215, sprites: [] },
  pine: { ground: '#7d956c', accent: '#57836b', size: 290, sprites: ['pine-common', 'pine-rare', 'pine-legend'] },
  persimmon: { ground: '#a8b66d', accent: '#d8a758', size: 290, sprites: ['fruit-common', 'fruit-rare', 'fruit-legend'] },
  orchid: { ground: '#9aa288', accent: '#c9a0d9', size: 215, sprites: [] },
  berries: { ground: '#899e69', accent: '#b7688b', size: 215, sprites: [] },
  rapeseed: { ground: '#c2c77e', accent: '#f1d75f', size: 215, sprites: [] },
  wheat: { ground: '#bdb37a', accent: '#e5c078', size: 220, sprites: [] },
  wisteria: { ground: '#9aa87d', accent: '#a38bc3', size: 305, sprites: ['wisteria-common', 'wisteria-rare', 'wisteria-legend'] },
  herbs: { ground: '#a1b97a', accent: '#d4bc64', size: 215, sprites: ['meadow-common', 'meadow-rare', 'meadow-legend'] },
}

/** Stable decoration; never use Math.random or alter a save to place plants. */
export function artRandom(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

export function spriteForBed(culture: BiomeCulture, seed: number): string | null {
  const roll = artRandom(seed, 0)
  return hexGardenArt[culture].sprites[roll < 0.85 ? 0 : roll < 0.95 ? 1 : 2] ?? null
}
