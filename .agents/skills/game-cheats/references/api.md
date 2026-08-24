# Browser cheat API

The API is available in dev, production, and Android/file builds:

```ts
const cheats = window.hanziGardenCheats
await cheats.drawCorrectStroke()
await cheats.drawWrongStroke()
const json = await cheats.dumpDb()
const save = await cheats.dumpDb('object')
await cheats.loadDb(jsonOrSave)
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
  gardenSeed: string
  gardenGenerationVersion: number
  clearedHexes: string[]
  pendingClearActions: number
  updatedAt: number
}
```

v6 dumps are accepted and migrated onto hex-garden fields without dropping learning data.

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

Mark one bed as unlocked/mastered or clear its visible progress:

```js
const cheats = window.hanziGardenCheats
const save = await cheats.dumpDb('object')
save.unlockedBedIds = [...new Set([...save.unlockedBedIds, 'bed-001'])]
save.masteredBedIds = [...new Set([...save.masteredBedIds, 'bed-001'])]
save.lastActiveBedId = 'bed-001'
await cheats.loadDb(save)
```

To make a bed unstudied, remove its ID from `masteredBedIds`, remove its character IDs from `seenCharacterIds`, and delete those keys from `cards`. To model all characters as studied, derive the complete bed and character ID lists from `src/data/model.ts`, populate the three progress collections, and give every character a structurally valid FSRS card. Copying an existing card and changing its date is less error-prone than inventing FSRS fields.

After loading any dump, expect the app to return to the map. Re-enter a battle before invoking stroke cheats.
