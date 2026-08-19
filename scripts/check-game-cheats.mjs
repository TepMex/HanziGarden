#!/usr/bin/env bun
/** Regression for the production/file:// browser cheat API. */
import { chromium } from 'playwright'
import path from 'path'
import { existsSync } from 'fs'

const www = path.resolve(process.argv[2] ?? 'dist')
const indexPath = path.join(www, 'index.html')
if (!existsSync(indexPath)) {
  console.error(`FAIL: missing ${indexPath} — run npm run build first`)
  process.exit(1)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--allow-file-access-from-files', '--disable-web-security'],
})
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(error.message))

try {
  await page.goto(`file://${indexPath}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  const backup = await page.evaluate(() => window.hanziGardenCheats.dumpDb())
  if (typeof backup !== 'string') throw new Error('dumpDb() did not return JSON')

  await page.evaluate(async (json) => {
    const save = JSON.parse(json)
    save.unlockedPlotIds = ['plot-001']
    save.masteredPlotIds = []
    save.lastActivePlotId = null
    save.seenCharacterIds = []
    save.cards = {}
    save.reviewEvents = []
    await window.hanziGardenCheats.loadDb(save)
  }, backup)

  const welcome = page.getByRole('button', { name: /Войти в сад/i })
  if (await welcome.count()) await welcome.click()
  await page.waitForSelector('.world-map-world.is-ready')
  const firstPlot = page.locator('[data-plot-id="plot-001"]')
  await firstPlot.click()
  await page.waitForTimeout(450)
  if (!await page.locator('.battle-screen').count()) await firstPlot.click()
  await page.waitForSelector('.battle-screen .writing-circle svg')

  await page.evaluate(() => window.hanziGardenCheats.drawWrongStroke())
  await page.evaluate(() => window.hanziGardenCheats.drawCorrectStroke())

  const review = await page.evaluate(async () => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    const event = save.reviewEvents.at(-1)
    const card = event ? save.cards[event.characterId] : undefined
    return {
      event,
      dueIsDate: card?.due instanceof Date,
      objectDump: typeof save === 'object',
    }
  })
  if (!review.objectDump || !review.event || review.event.totalMistakes !== 1 || !review.dueIsDate) {
    throw new Error(`stroke cheats produced wrong save: ${JSON.stringify(review)}`)
  }

  const imported = await page.evaluate(async () => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    save.unlockedPlotIds = ['plot-debug-only']
    save.masteredPlotIds = ['plot-mastered-without-unlock']
    save.lastActivePlotId = 'plot-not-unlocked'
    save.seenCharacterIds = ['character-debug-only']
    await window.hanziGardenCheats.loadDb(save)
    const loaded = await window.hanziGardenCheats.dumpDb('object')
    return {
      onMap: Boolean(document.querySelector('.map-screen')),
      unlockedPlotIds: loaded.unlockedPlotIds,
      masteredPlotIds: loaded.masteredPlotIds,
      lastActivePlotId: loaded.lastActivePlotId,
      seenCharacterIds: loaded.seenCharacterIds,
    }
  })
  if (!imported.onMap || imported.unlockedPlotIds[0] !== 'plot-debug-only' ||
      imported.masteredPlotIds[0] !== 'plot-mastered-without-unlock' ||
      imported.lastActivePlotId !== 'plot-not-unlocked' ||
      imported.seenCharacterIds[0] !== 'character-debug-only') {
    throw new Error(`loadDb did not apply debug state: ${JSON.stringify(imported)}`)
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  const persisted = await page.evaluate(async () => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    return save.unlockedPlotIds[0]
  })
  if (persisted !== 'plot-debug-only') throw new Error(`import did not survive reload: ${persisted}`)

  await page.evaluate((json) => window.hanziGardenCheats.loadDb(json), backup)
  if (errors.length) throw new Error(`browser errors: ${errors.slice(0, 5).join(' | ')}`)
  console.log('OK: production cheat API strokes + dump round-trip')
} finally {
  await browser.close()
}
