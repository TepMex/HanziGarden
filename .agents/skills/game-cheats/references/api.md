# Browser cheat API

The API is available in dev, production, and Android/file builds:

```ts
const cheats = window.hanziGardenCheats
await cheats.drawCorrectStroke()
await cheats.drawWrongStroke()
const json = await cheats.dumpDb()
const save = await cheats.dumpDb('object')
await cheats.loadDb(jsonOrSave)
await cheats.grantClearActions(1)
await cheats.clearHex('1,0')
await cheats.setGardenSeed('reproducible-seed')
await cheats.revealEntireGarden()
const seed = await cheats.newRandomGardenSeed()
```

`drawCorrectStroke()` submits the current canonical median. `drawWrongStroke()` submits it backwards. Both use Hanzi Writer's real input path, so use them one at a time and wait for each promise. They reject outside an active, loaded battle.

## Save shape

`loadDb` accepts formatted JSON or an object with the current v7 shape:

```ts
type SaveGame = {
  id: 'main'
  version: 7
  unlockedBedIds: string[]
  masteredBedIds: string[]
  lastActiveBedId: string | null
  gardenSeed: string
  gardenGenerationVersion: 1
  clearedHexes: string[]
  pendingClearActions: number
  lastActiveHexId: string | null
  seenCharacterIds: string[]
  cards: Record<string, CardState>
  reviewEvents: ReviewEvent[]
  playerProgress: {
    totalXp: number
    lifetimeCorrectStrokes: number
    lifetimeErrors: number
    lifetimeCompletedKanji: number
    lifetimeCompletedBeds: number
    bestComboEver: number
    perfectComplexKanjiCount: number
    completedBiomeIds: string[]
  }
  achievements: {
    unlockedAchievements: { id: string; unlockedAt: string }[]
    currentDailyStreak: number
    bestDailyStreak: number
    lastActiveDate?: string
    perfectBedsToday: { date?: string; count: number }
  }
  updatedAt: number
}
```

The loader validates field types and FSRS card/event shapes but deliberately permits unknown IDs and inconsistent progression. ISO date strings in `cards.*.due` and `cards.*.last_review` are restored as `Date` objects.

## Common scenarios

Back up and restore a profile:

```js
const backup = await window.hanziGardenCheats.dumpDb()
try {
  // load temporary states and run checks
} finally {
  await window.hanziGardenCheats.loadDb(backup)
}
```

Give a player one action and clear an available hex:

```js
const cheats = window.hanziGardenCheats
await cheats.grantClearActions(1)
await cheats.clearHex('1,0')
```

`setGardenSeed` is a destructive development helper for geography only: it
resets the map to the cleared center with no pending actions while preserving
all learning, SRS, XP, and achievement data. `revealEntireGarden` reveals all
217 deterministic cells without changing the seed.

After loading any dump, expect the app to return to the map. Re-enter a battle before invoking stroke cheats.
