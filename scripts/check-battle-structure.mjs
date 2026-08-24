#!/usr/bin/env bun
/**
 * Regression: primitive information and direct components stay available in
 * the battle UI without allowing clicks through the composition dialog.
 * Usage: bun scripts/check-battle-structure.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { beds } from '../src/data/model.ts'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')
const bed = beds.find((candidate) => candidate.id === 'bed-001')
if (!bed) throw new Error('missing bed-001')

function saveForFrame(frame) {
  const index = bed.characters.findIndex((character) => character.frame === frame)
  return bed.characters.slice(0, index).map((character) => character.id)
}

async function seedSave(page, previousIds) {
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  return page.evaluate(async ({ nextBedId, precedingIds }) => {
    sessionStorage.setItem('memory-garden-welcomed', 'yes')
    const save = await window.hanziGardenCheats.dumpDb('object')
    const futureCard = {
      due: '2999-01-01T00:00:00.000Z',
      stability: 12,
      difficulty: 4,
      elapsed_days: 3,
      scheduled_days: 30,
      learning_steps: 0,
      reps: 2,
      lapses: 0,
      state: 2,
      last_review: '2026-08-19T10:00:00.000Z',
    }
    save.unlockedBedIds = [nextBedId]
    save.masteredBedIds = []
    save.lastActiveBedId = nextBedId
    save.seenCharacterIds = precedingIds
    save.cards = Object.fromEntries(precedingIds.map((id) => [id, futureCard]))
    save.reviewEvents = []
    save.completedWalkthroughIds = []
    await window.hanziGardenCheats.loadDb(save)
    return save.playerProgress.totalXp
  }, { nextBedId: bed.id, precedingIds: previousIds })
}

async function enterBattle(page, frame) {
  const startingXp = await seedSave(page, saveForFrame(frame))
  await page.waitForSelector('.garden-map-content.is-ready')
  await page.locator('[data-bed-id="bed-001"]').click({ force: true })
  await page.waitForSelector('.battle-screen .writing-circle')
  if (frame === 2) {
    const walkthrough = page.locator('.walkthrough-dialog')
    await walkthrough.waitFor()
    await walkthrough.getByRole('button', { name: /Понятно/ }).click()
    await walkthrough.waitFor({ state: 'hidden' })
    await page.waitForSelector('.battle-screen .writing-circle svg')
  }
  return startingXp
}

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  const welcome = page.getByRole('button', { name: /Войти в сад/i })
  await welcome.waitFor()
  if (await welcome.count()) await welcome.click()

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
  const dialog = page.getByRole('dialog', { name: /два/i })
  await dialog.waitFor()
  if (await dialog.getByText('二', { exact: true }).count()) throw new Error('composition reveals the target Hanzi')
  if ((await dialog.locator('#composition-title').innerText()).trim() !== 'два') throw new Error('composition title does not contain only the keyword')
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

  const startingXp = await enterBattle(page, 2)
  await page.getByRole('button', { name: /Показать состав/i }).click()
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    await window.hanziGardenCheats.drawCorrectStroke()
    await window.hanziGardenCheats.drawCorrectStroke()
  })
  await page.waitForFunction(async () => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    return save.reviewEvents.some((event) => event.characterId === 'rsh-0002')
  })
  const completedSave = await page.evaluate(() => window.hanziGardenCheats.dumpDb('object'))
  const review = completedSave.reviewEvents.find((event) => event.characterId === 'rsh-0002')
  if (review?.totalMistakes !== 1) throw new Error(`composition click counted as ${review?.totalMistakes} errors instead of 1`)
  if (review.hintUsed) throw new Error('composition click was recorded as a stroke-order hint')
  if (completedSave.playerProgress.totalXp !== startingXp + 1) {
    throw new Error(`composition click did not deduct 1 XP: ${startingXp} -> ${completedSave.playerProgress.totalXp}`)
  }

  await context.close()
  console.log('OK: battle primitive, hidden target, and composition penalty')
} finally {
  await browser.close()
}
