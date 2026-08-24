/**
 * Deterministic 32-bit hashing used for garden generation.
 * Independent streams (`biome`, `plant`, `nuclei`, …) must not share mixing
 * so a later algorithm change in one stream cannot rewrite another.
 */

function fnv1a(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function avalanche(value: number): number {
  let hash = value >>> 0
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b)
  hash ^= hash >>> 16
  return hash >>> 0
}

export function hashStream(seed: string, q: number, r: number, stream: string): number {
  const mixed = avalanche(
    fnv1a(seed)
    ^ Math.imul(avalanche(fnv1a(stream)), 0x9e3779b9)
    ^ Math.imul(q + 0x85ebca6b, 0xc2b2ae35)
    ^ Math.imul(r + 0x27d4eb2f, 0x165667b1),
  )
  return mixed
}

/** Uniform value in `[0, 1)`. */
export function unitRandom(seed: string, q: number, r: number, stream: string): number {
  return hashStream(seed, q, r, stream) / 0x1_0000_0000
}

export function intRandom(seed: string, q: number, r: number, stream: string, modulo: number): number {
  if (modulo <= 0) throw new Error('intRandom modulo must be positive')
  return hashStream(seed, q, r, stream) % modulo
}

export function createGardenSeed(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Stable seed derived from a legacy save so migration is replay-safe. */
export function gardenSeedFromLegacyMaterial(material: string): string {
  const first = avalanche(fnv1a(`garden-seed-a:${material}`)).toString(16).padStart(8, '0')
  const second = avalanche(fnv1a(`garden-seed-b:${material}`)).toString(16).padStart(8, '0')
  const third = avalanche(fnv1a(`garden-seed-c:${material}`)).toString(16).padStart(8, '0')
  const fourth = avalanche(fnv1a(`garden-seed-d:${material}`)).toString(16).padStart(8, '0')
  return `${first}${second}${third}${fourth}`
}

export function mulberry32(state: number): () => number {
  let current = state >>> 0
  return () => {
    current = current + 0x6d2b79f5 >>> 0
    let next = Math.imul(current ^ current >>> 15, 1 | current)
    next ^= next + Math.imul(next ^ next >>> 7, 61 | next)
    return ((next ^ next >>> 14) >>> 0) / 0x1_0000_0000
  }
}
