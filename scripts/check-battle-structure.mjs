#!/usr/bin/env bun
/**
 * Regression: primitive information and direct components stay available in
 * the battle UI without allowing clicks through the composition dialog.
 * Usage: bun scripts/check-battle-structure.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { plots } from '../src/data/model.ts'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')
const plot = plots.find((candidate) => candidate.id === 'plot-001')
if (!plot) throw new Error('missing plot-001')

function saveForFrame(frame) {
  const index = plot.characters.findIndex((character) => character.frame === frame)
  return {
    id: 'main', version: 3, unlockedPlotIds: [plot.id], masteredPlotIds: [], lastActivePlotId: plot.id, seenCharacterIds: [],
    cards: Object.fromEntries(plot.characters.slice(0, index).map((character) => [character.id, { due: '2999-01-01T00:00:00.000Z' }])),
    reviewEvents: [], updatedAt: Date.now(),
  }
}

async function seedSave(page, save) {
  await page.evaluate(async (nextSave) => {
    sessionStorage.setItem('memory-garden-welcomed', 'yes')
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('memory-garden')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('saves', 'readwrite')
      transaction.objectStore('saves').put(nextSave)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, save)
}

async function enterBattle(page, frame) {
  await seedSave(page, saveForFrame(frame))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.world-map-world.is-ready')
  await page.locator('[data-plot-id="plot-001"]').click({ force: true })
  await page.waitForSelector('.battle-screen .writing-circle')
}

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Войти в сад/i }).waitFor()

  await enterBattle(page, 1)
  if (await page.getByRole('button', { name: /Показать состав/i }).count()) throw new Error('composition button shown for 一')
  if ((await page.locator('.primitive-prompt').innerText()).replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru') !== 'пол') {
    throw new Error('primitive for 一 is missing')
  }
  if (await page.getByText('Примитив', { exact: true }).count()) throw new Error('removed primitive label is visible')

  await page.locator('.back-button').click()
  await page.waitForSelector('.map-screen')
  await enterBattle(page, 2)
  await page.getByRole('button', { name: /Показать состав/i }).click()
  const dialog = page.getByRole('dialog', { name: /二\s+два/i })
  await dialog.waitFor()
  const component = await page.locator('.composition-list li').allInnerTexts()
  if (component.length !== 1 || !/一\s*один/.test(component[0])) throw new Error(`unexpected composition: ${component}`)
  let writingBlocked = false
  try {
    await page.locator('.writing-target').click({ timeout: 500 })
  } catch {
    writingBlocked = true
  }
  if (!writingBlocked) throw new Error('composition dialog allows clicks through to the writer')
  await page.keyboard.press('Escape')
  if (await page.getByRole('dialog').count()) throw new Error('composition dialog did not close on Escape')

  await page.getByRole('button', { name: /Показать состав/i }).click()
  await page.getByRole('button', { name: /Закрыть состав/i }).click()
  if (await page.getByRole('dialog').count()) throw new Error('composition dialog did not close with its button')

  await page.getByRole('button', { name: /Показать состав/i }).click()
  await page.mouse.click(5, 500)
  if (await page.getByRole('dialog').count()) throw new Error('composition dialog did not close on its backdrop')

  await context.close()
  console.log('OK: battle primitive and composition')
} finally {
  await browser.close()
}
