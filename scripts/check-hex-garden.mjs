#!/usr/bin/env bun
/**
 * Browser regression for hexagonal garden exploration.
 *
 * Usage: bun scripts/check-hex-garden.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { hexContent } from '../src/hexGarden/gardenGenerator.ts'
import { gardenHexes, hasHex, hexId } from '../src/hexGarden/hexGrid.ts'
import { EDGE_DIRECTIONS } from '../src/hexGarden/hexMath.ts'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const seed = 'browser-check-seed'
const otherSeed = 'browser-check-seed-b'
const expectedSouth = hexContent(seed, { q: 0, r: 1 })

function expectedFenceCount(mapSeed) {
  let fences = 0
  let merged = 0
  for (const hex of gardenHexes()) {
    const content = hexContent(mapSeed, hex)
    EDGE_DIRECTIONS.forEach((dir, direction) => {
      const neighbor = { q: hex.q + dir.q, r: hex.r + dir.r }
      if (!hasHex(neighbor)) return
      const neighborId = hexId(neighbor)
      if (hexId(hex) >= neighborId) return
      if (hexContent(mapSeed, neighbor).biomeId === content.biomeId) merged += 1
      else fences += 1
      void direction
    })
  }
  return { fences, merged }
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()
page.setDefaultTimeout(12_000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

async function enterGarden() {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  const welcome = page.getByRole('button', { name: /Войти в сад/i })
  if (await welcome.count()) await welcome.click()
  await page.waitForSelector('.garden-map-content.is-ready')
}

try {
  await enterGarden()
  const backup = await page.evaluate(() => window.hanziGardenCheats.dumpDb())

  await page.evaluate(async (nextSeed) => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    save.gardenSeed = nextSeed
    save.gardenGenerationVersion = 1
    save.clearedHexes = ['0,0']
    save.pendingClearActions = 2
    save.unlockedBedIds = ['bed-001']
    save.masteredBedIds = []
    save.lastActiveBedId = 'bed-001'
    await window.hanziGardenCheats.loadDb(save)
  }, seed)

  await page.waitForSelector('.garden-map-content.is-ready')
  await page.waitForSelector('[data-hex-id="0,0"]')

  const start = await page.evaluate(() => {
    const ground = (id) => document.querySelector(`g[data-hex-id="${id}"] .hex-garden-ground`)
    const plant = (id) => document.querySelector(`g[data-hex-id="${id}"] .hex-garden-plant`)
    return {
      cellCount: document.querySelectorAll('.hex-garden-cell').length,
      centerBed: document.querySelector('[data-hex-id="0,0"][data-bed-id="bed-001"]')?.getAttribute('data-bed-id'),
      frontier: [...document.querySelectorAll('.hex-garden-hit.is-frontier')].map((node) => node.getAttribute('data-hex-id')),
      banner: document.querySelector('.hex-garden-banner')?.textContent ?? null,
      southFill: ground('0,1')?.getAttribute('fill') ?? null,
      eastFill: ground('1,0')?.getAttribute('fill') ?? null,
      southPlant: Boolean(plant('0,1')),
      centerPlant: Boolean(plant('0,0')),
    }
  })
  const seeded = await page.evaluate(() => window.hanziGardenCheats.dumpDb('object'))
  if (seeded.gardenSeed !== seed) throw new Error(`seed not applied: ${seeded.gardenSeed}`)
  if (start.cellCount !== 217) throw new Error(`expected 217 hexes, got ${start.cellCount}`)
  if (start.centerBed !== 'bed-001') throw new Error(`center missing bed-001: ${start.centerBed}`)
  if (!start.frontier.includes('0,1') || !start.frontier.includes('1,0') || start.frontier.length !== 6) {
    throw new Error(`frontier wrong: ${JSON.stringify(start.frontier)}`)
  }
  if (!start.banner?.includes('Можно расчистить: 2')) throw new Error(`missing banner: ${start.banner}`)
  if (start.southFill !== '#2a3530' || start.eastFill !== '#2a3530') {
    throw new Error(`available hex leaked biome fill: ${start.southFill} / ${start.eastFill}`)
  }
  if (start.southPlant) throw new Error('available hex leaked a plant sprite')
  if (!start.centerPlant) throw new Error('center hex has no plant')

  await page.locator('.hex-garden-hit[data-hex-id="0,1"]').click()
  await page.waitForSelector('g[data-hex-id="0,1"] .hex-garden-plant')
  await page.locator('.hex-garden-hit[data-hex-id="1,0"]').click()
  await page.waitForSelector('g[data-hex-id="1,0"] .hex-garden-plant')

  const afterClear = await page.evaluate(() => {
    const ground = (id) => document.querySelector(`g[data-hex-id="${id}"] .hex-garden-ground`)
    const plant = (id) => document.querySelector(`g[data-hex-id="${id}"] .hex-garden-plant`)
    return {
      southFill: ground('0,1')?.getAttribute('fill') ?? null,
      eastFill: ground('1,0')?.getAttribute('fill') ?? null,
      southPlant: plant('0,1')?.getAttribute('href') ?? null,
      eastPlant: plant('1,0')?.getAttribute('href') ?? null,
      banner: document.querySelector('.hex-garden-banner')?.textContent ?? null,
      frontier: [...document.querySelectorAll('.hex-garden-hit.is-frontier')].map((node) => node.getAttribute('data-hex-id')),
    }
  })
  const clearedSave = await page.evaluate(() => window.hanziGardenCheats.dumpDb('object'))
  if (!clearedSave.clearedHexes.includes('0,1') || !clearedSave.clearedHexes.includes('1,0') || clearedSave.pendingClearActions !== 0) {
    throw new Error(`clear did not persist: ${JSON.stringify({
      clearedHexes: clearedSave.clearedHexes,
      pendingClearActions: clearedSave.pendingClearActions,
    })}`)
  }
  if (afterClear.southFill === '#2a3530' || afterClear.eastFill === '#2a3530') {
    throw new Error('cleared hex still shows fog fill')
  }
  if (!afterClear.southPlant || !afterClear.eastPlant) throw new Error('cleared hex has no plant sprite')
  if (!afterClear.southPlant.includes('/plants/rapeseed/very_rare.png')) {
    throw new Error(`south plant did not match seeded very-rare rapeseed: ${afterClear.southPlant}`)
  }
  if (afterClear.banner) throw new Error(`banner still visible: ${afterClear.banner}`)
  if (afterClear.frontier.length !== 0) throw new Error(`frontier remained with 0 pending: ${JSON.stringify(afterClear.frontier)}`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  const welcome = page.getByRole('button', { name: /Войти в сад/i })
  if (await welcome.count()) await welcome.click()
  await page.waitForSelector('.garden-map-content.is-ready')
  const restored = await page.evaluate(() => window.hanziGardenCheats.dumpDb('object'))
  if (restored.gardenSeed !== seed) throw new Error(`seed changed after reload: ${restored.gardenSeed}`)
  if (!restored.clearedHexes.includes('0,1') || !restored.clearedHexes.includes('1,0')) {
    throw new Error(`cleared hex lost after reload: ${JSON.stringify(restored.clearedHexes)}`)
  }
  const restoredPlant = await page.locator('g[data-hex-id="0,1"] .hex-garden-plant').getAttribute('href')
  if (restoredPlant !== afterClear.southPlant) throw new Error(`plant changed after reload: ${restoredPlant} vs ${afterClear.southPlant}`)

  await page.locator('.hex-garden-hit[data-hex-id="0,0"]').click()
  await page.waitForSelector('.battle-screen')
  const keyword = (await page.locator('.battle-screen').innerText()).toLowerCase()
  if (!keyword.includes('один')) throw new Error(`Heisig order changed, expected keyword один: ${keyword.slice(0, 240)}`)

  await page.evaluate(async (nextSeed) => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    save.gardenSeed = nextSeed
    save.clearedHexes = ['0,0']
    save.pendingClearActions = 0
    await window.hanziGardenCheats.loadDb(save)
  }, otherSeed)
  await page.waitForSelector('.garden-map-content.is-ready')
  await page.getByRole('button', { name: 'Reveal all' }).click()
  const revealed = await page.evaluate(() => ({
    plants: document.querySelectorAll('.hex-garden-plant').length,
    fences: document.querySelectorAll('.hex-garden-fence').length,
    rims: document.querySelectorAll('.hex-garden-rim').length,
    fogged: document.querySelectorAll('.hex-garden-cell.is-fogged').length,
  }))
  const expectedFences = expectedFenceCount(otherSeed)
  if (revealed.plants !== 217) throw new Error(`reveal-all plants: ${revealed.plants}`)
  if (revealed.fences !== expectedFences.fences) {
    throw new Error(`fence count ${revealed.fences} != ${expectedFences.fences} (merged ${expectedFences.merged})`)
  }
  if (expectedFences.merged < 50) throw new Error(`biomes are not coherent enough: merged ${expectedFences.merged}`)
  if (revealed.fogged !== 0) throw new Error(`reveal-all still fogged: ${revealed.fogged}`)

  const otherCenter = await page.locator('g[data-hex-id="0,0"] .hex-garden-plant').getAttribute('href')
  const originalCenter = hexContent(seed, { q: 0, r: 0 }).plantId
  const otherCenterId = hexContent(otherSeed, { q: 0, r: 0 }).plantId
  if (originalCenter === otherCenterId) {
    console.warn('center plant happened to match across seeds; map signatures still differ in unit tests')
  }
  if (!otherCenter) throw new Error('other seed center has no plant')

  await page.screenshot({ path: '/tmp/hex-garden-revealed.png' })
  await page.evaluate(async (json) => {
    await window.hanziGardenCheats.loadDb(json)
  }, backup)

  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`)
  console.log(JSON.stringify({
    ok: true,
    seed,
    south: expectedSouth,
    southPlant: afterClear.southPlant,
    southFill: afterClear.southFill,
    fences: revealed.fences,
    mergedBiomeEdges: expectedFences.merged,
    otherCenter,
  }, null, 2))
} catch (error) {
  await page.screenshot({ path: '/tmp/hex-garden-fail.png', fullPage: true })
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
