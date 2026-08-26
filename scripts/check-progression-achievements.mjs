#!/usr/bin/env bun
import { chromium } from 'playwright'
import path from 'path'
import { existsSync } from 'fs'

const www = path.resolve(process.argv[2] ?? 'dist')
const indexPath = path.join(www, 'index.html')
if (!existsSync(indexPath)) throw new Error(`Missing ${indexPath}; run bun run build first`)

const browser = await chromium.launch({
  headless: true,
  args: ['--allow-file-access-from-files', '--disable-web-security'],
})
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()

try {
  await page.goto(`file://${indexPath}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  const welcome = page.getByRole('button', { name: /Войти в сад/i })
  if (await welcome.count()) await welcome.click()
  await page.waitForSelector('.garden-map-content.is-ready')

  await page.evaluate(async () => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    const futureCard = {
      due: new Date('2099-01-01T00:00:00.000Z'),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 30,
      learning_steps: 0,
      reps: 1,
      lapses: 0,
      state: 2,
      last_review: new Date(),
    }
    const alreadyStudied = ['rsh-0002', 'rsh-0003', 'rsh-0004', 'rsh-0005', 'rsh-0006', 'rsh-0007', 'rsh-0008']
    save.unlockedBedIds = ['bed-001']
    save.masteredBedIds = []
    save.lastActiveBedId = null
    save.seenCharacterIds = [...alreadyStudied]
    save.pendingInitialRecallIds = []
    save.cards = Object.fromEntries(alreadyStudied.map((id) => [id, structuredClone(futureCard)]))
    save.reviewEvents = []
    save.playerProgress = {
      totalXp: 99,
      lifetimeCorrectStrokes: 0,
      lifetimeErrors: 0,
      lifetimeCompletedKanji: 0,
      lifetimeCompletedBeds: 0,
      bestComboEver: 0,
      perfectComplexKanjiCount: 0,
      completedBiomeIds: [],
    }
    save.achievements = {
      unlockedAchievements: [],
      currentDailyStreak: 0,
      bestDailyStreak: 0,
      perfectBedsToday: { count: 0 },
    }
    await window.hanziGardenCheats.loadDb(save)
  })

  const firstBed = page.locator('[data-bed-id="bed-001"]')
  await firstBed.click()
  await page.waitForTimeout(450)
  if (!await page.locator('.battle-screen').count()) await firstBed.click()
  await page.waitForSelector('.battle-screen .writing-circle svg')
  await page.evaluate(() => window.hanziGardenCheats.drawCorrectStroke())
  await page.waitForFunction(() => document.querySelector('.writing-target')?.dataset.traceOutline === 'false')
  await page.evaluate(() => window.hanziGardenCheats.drawCorrectStroke())

  await page.getByRole('heading', { name: 'Один XP' }).waitFor()
  if (process.env.SNAPSHOT_PATH) {
    await page.waitForTimeout(900)
    await page.screenshot({ path: process.env.SNAPSHOT_PATH })
  }
  await page.getByRole('button', { name: /Продолжить/i }).click()
  await page.getByRole('heading', { name: 'С чистого листа' }).waitFor()
  await page.getByRole('button', { name: /Продолжить/i }).click()
  await page.getByRole('heading', { name: 'Сад снова дышит' }).waitFor()
  await page.getByText('Итого').waitFor()

  const summary = await page.locator('.xp-summary').innerText()
  const save = await page.evaluate(() => window.hanziGardenCheats.dumpDb('object'))
  const unlockIds = save.achievements.unlockedAchievements.map((item) => item.id)
  if (!summary.includes('+2 XP') || !summary.includes('Новый уровень 2')) {
    throw new Error(`Unexpected completion summary: ${summary}`)
  }
  if (save.playerProgress.totalXp !== 101 || !unlockIds.includes('one_xp_kanji') || !unlockIds.includes('perfect_bed')) {
    throw new Error(`Unexpected persisted progression: ${JSON.stringify({ xp: save.playerProgress.totalXp, unlockIds })}`)
  }
  console.log('OK: level-up summary + achievement popup queue + persistence')
} finally {
  await browser.close()
}
