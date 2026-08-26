#!/usr/bin/env bun
/**
 * Regression: primitive information, composition, and character notes stay
 * available in the battle UI without allowing clicks through the dialogs.
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

async function seedSave(page, previousIds, characterNotes = {}) {
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  return page.evaluate(async ({ nextBedId, precedingIds, notes }) => {
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
    save.pendingInitialRecallIds = []
    save.cards = Object.fromEntries(precedingIds.map((id) => [id, futureCard]))
    save.reviewEvents = []
    save.completedWalkthroughIds = []
    save.characterNotes = notes
    await window.hanziGardenCheats.loadDb(save)
    return save.playerProgress.totalXp
  }, { nextBedId: bed.id, precedingIds: previousIds, notes: characterNotes })
}

async function enterBattle(page, frame, characterNotes = {}) {
  const startingXp = await seedSave(page, saveForFrame(frame), characterNotes)
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

async function dismissAchievements(page) {
  for (let i = 0; i < 8; i++) {
    const popup = page.locator('.achievement-popup-backdrop')
    if (!await popup.count()) return
    await page.getByRole('button', { name: /Продолжить/i }).click()
    await popup.waitFor({ state: 'hidden' }).catch(() => {})
  }
}

async function waitForReview(page, characterId) {
  await page.waitForFunction(async (id) => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    return save.reviewEvents.some((event) => event.characterId === id)
  }, characterId)
  return page.evaluate((id) => window.hanziGardenCheats.dumpDb('object').then((save) => ({
    save,
    review: save.reviewEvents.find((event) => event.characterId === id),
  })), characterId)
}

async function finishInitialTwoStrokeCharacter(page) {
  await page.evaluate(async () => {
    await window.hanziGardenCheats.drawCorrectStroke()
    await window.hanziGardenCheats.drawCorrectStroke()
  })
  await page.waitForFunction(() => document.querySelector('.writing-target')?.dataset.traceOutline === 'false')
  await page.evaluate(async () => {
    await window.hanziGardenCheats.drawCorrectStroke()
    await window.hanziGardenCheats.drawCorrectStroke()
  })
}

async function finishInitialTrace(page) {
  await page.evaluate(async () => {
    await window.hanziGardenCheats.drawCorrectStroke()
    await window.hanziGardenCheats.drawCorrectStroke()
  })
  await page.waitForFunction(() => document.querySelector('.writing-target')?.dataset.traceOutline === 'false')
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
  if (!await page.getByRole('button', { name: /Открыть заметку/i }).count()) throw new Error('note button missing for 一')
  if ((await page.locator('.primitive-prompt').innerText()).replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru') !== 'пол') {
    throw new Error('primitive for 一 is missing')
  }
  if (await page.getByText('Примитив', { exact: true }).count()) throw new Error('removed primitive label is visible')

  await page.getByRole('button', { name: /Открыть заметку/i }).click()
  const noteDialog = page.getByRole('dialog', { name: /один/i })
  await noteDialog.waitFor()
  await noteDialog.getByLabel('Текст заметки').fill('горизонтальная черта')
  await noteDialog.getByRole('button', { name: /Сохранить/i }).click()
  if (await page.getByRole('dialog').count()) throw new Error('note dialog did not close after save')

  const savedNote = await page.evaluate(async () => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    return save.characterNotes['rsh-0001']
  })
  if (savedNote !== 'горизонтальная черта') throw new Error(`note was not persisted: ${savedNote}`)

  await page.locator('.back-button').click()
  await page.waitForSelector('.map-screen')

  const writingXp = await enterBattle(page, 2)
  await page.getByRole('button', { name: /Открыть заметку/i }).click()
  const writeDialog = page.getByRole('dialog', { name: /два/i })
  await writeDialog.waitFor()
  await writeDialog.getByLabel('Текст заметки').fill('две черты')
  await writeDialog.getByRole('button', { name: /Сохранить/i }).click()
  await finishInitialTwoStrokeCharacter(page)
  const written = await waitForReview(page, 'rsh-0002')
  await dismissAchievements(page)
  if (written.review?.totalMistakes !== 0) {
    throw new Error(`writing a new note counted as ${written.review?.totalMistakes} errors`)
  }
  if (written.save.playerProgress.totalXp !== writingXp + 3) {
    throw new Error(`writing a new note changed XP: ${writingXp} -> ${written.save.playerProgress.totalXp}`)
  }
  if (written.save.characterNotes['rsh-0002'] !== 'две черты') {
    throw new Error('note was lost after completing the character')
  }

  await page.locator('.back-button').click()
  await page.waitForSelector('.map-screen')
  await enterBattle(page, 2)
  const noteBox = await page.getByRole('button', { name: /Открыть заметку/i }).boundingBox()
  const compositionBox = await page.getByRole('button', { name: /Показать состав/i }).boundingBox()
  if (!noteBox || !compositionBox) throw new Error('note or composition button missing for 二')
  if (compositionBox.y >= noteBox.y) throw new Error('composition was displaced from the original top-right slot by the note')
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
  await finishInitialTrace(page)
  await page.getByRole('button', { name: /Показать состав/i }).click()
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    await window.hanziGardenCheats.drawCorrectStroke()
    await window.hanziGardenCheats.drawCorrectStroke()
  })
  const composed = await waitForReview(page, 'rsh-0002')
  await dismissAchievements(page)
  if (composed.review?.totalMistakes !== 1) throw new Error(`composition click counted as ${composed.review?.totalMistakes} errors instead of 1`)
  if (composed.review.hintUsed) throw new Error('composition click was recorded as a stroke-order hint')
  if (composed.save.playerProgress.totalXp !== startingXp + 2) {
    throw new Error(`composition click did not deduct 1 XP: ${startingXp} -> ${composed.save.playerProgress.totalXp}`)
  }

  const noteXp = await enterBattle(page, 2, { 'rsh-0002': 'две горизонтальные черты' })
  await finishInitialTrace(page)
  await page.getByRole('button', { name: /Открыть заметку/i }).click()
  const reviewNote = page.getByRole('dialog', { name: /два/i })
  await reviewNote.waitFor()
  if ((await reviewNote.getByLabel('Текст заметки').inputValue()) !== 'две горизонтальные черты') {
    throw new Error('saved note was not shown on the next writing attempt')
  }
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    await window.hanziGardenCheats.drawCorrectStroke()
    await window.hanziGardenCheats.drawCorrectStroke()
  })
  const viewed = await waitForReview(page, 'rsh-0002')
  await dismissAchievements(page)
  if (viewed.review?.totalMistakes !== 1) throw new Error(`viewing a note counted as ${viewed.review?.totalMistakes} errors instead of 1`)
  if (viewed.review.hintUsed) throw new Error('viewing a note was recorded as a stroke-order hint')
  if (viewed.save.playerProgress.totalXp !== noteXp + 2) {
    throw new Error(`viewing a note did not deduct 1 XP: ${noteXp} -> ${viewed.save.playerProgress.totalXp}`)
  }
  if (viewed.save.characterNotes['rsh-0002'] !== 'две горизонтальные черты') {
    throw new Error('viewing a note did not keep the saved text')
  }

  await context.close()
  console.log('OK: battle primitive, composition penalty, and character notes')
} finally {
  await browser.close()
}
