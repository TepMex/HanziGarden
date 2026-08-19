function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function randomAt(seed: number, x: number, y: number): number {
  let value = (seed ^ Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value)
}

function valueNoise(seed: number, x: number, y: number, scale: number): number {
  const scaledX = x / scale
  const scaledY = y / scale
  const left = Math.floor(scaledX)
  const top = Math.floor(scaledY)
  const amountX = smooth(scaledX - left)
  const amountY = smooth(scaledY - top)
  const topValue = randomAt(seed, left, top) * (1 - amountX) + randomAt(seed, left + 1, top) * amountX
  const bottomValue = randomAt(seed, left, top + 1) * (1 - amountX) + randomAt(seed, left + 1, top + 1) * amountX
  return topValue * (1 - amountY) + bottomValue * amountY
}

/** Stable low-frequency noise used to shape a bed's organic weed patch. */
export function organicWeedNoise(seed: number, x: number, y: number, width: number, height: number): number {
  const baseScale = Math.max(5, Math.min(width, height) / 2.8)
  const base = valueNoise(seed, x, y, baseScale)
  const detail = valueNoise(seed ^ 0x6d2b79f5, x, y, baseScale / 2)
  return base * 0.76 + detail * 0.24
}

/** Select an exact fraction of eligible pixels by deterministic noise rank. */
export function organicWeedMask(
  seed: number,
  coverage: number,
  width: number,
  height: number,
  eligible?: Uint8Array,
): Uint8Array {
  const pixelCount = Math.max(0, Math.floor(width) * Math.floor(height))
  const mask = new Uint8Array(pixelCount)
  const normalizedCoverage = clamp01(coverage)
  if (normalizedCoverage === 0) return mask
  if (normalizedCoverage === 1) {
    for (let index = 0; index < pixelCount; index += 1) {
      if (!eligible || eligible[index] !== 0) mask[index] = 255
    }
    return mask
  }
  const candidates: { index: number; noise: number }[] = []
  for (let index = 0; index < pixelCount; index += 1) {
    if (eligible && eligible[index] === 0) continue
    candidates.push({
      index,
      noise: organicWeedNoise(seed, index % width, Math.floor(index / width), width, height),
    })
  }
  const selectedCount = Math.round(candidates.length * normalizedCoverage)
  candidates.sort((left, right) => right.noise - left.noise || left.index - right.index)
  for (let index = 0; index < selectedCount; index += 1) mask[candidates[index]!.index] = 255
  return mask
}

export function measuredWeedCoverage(mask: Uint8Array, eligible?: Uint8Array): number {
  let total = 0
  let covered = 0
  for (let index = 0; index < mask.length; index += 1) {
    if (eligible && eligible[index] === 0) continue
    total += 1
    if (mask[index]! > 0) covered += 1
  }
  return total ? covered / total : 0
}
