# Hanzi Garden — Game & Technical Specification

> This document is the current source of truth. The XP/level/Combo and achievement requirements below supersede any older implementation notes that omit those systems.

## 1. Product Summary

**Product name:** Hanzi Garden / Сад иероглифов

**Repository:** single-product repo — web game at the repository root, Android WebView sideload APK under `android/`. Not a multi-project monorepo.

Hanzi Garden is a single-player educational game for learning to **produce Chinese characters from meaning**.

The public web and Android surfaces use the **Hanzi Garden** name. The downloadable Android artifact is `hanzi-garden.apk`. Legacy storage and Android package identifiers remain unchanged so existing players can update the app without losing access to their progress.

The core tested skill is:

> **keyword / meaning → write the correct Hanzi from memory**

The player inherits a large magical Chinese garden. Forgotten or not-yet-learned characters manifest as hostile weeds. To remove a weed, the player must correctly write the corresponding Chinese character. Each correct stroke damages the weed; completing the full character destroys it.

The central metaphor is:

> **Memory is a garden that becomes overgrown when it is not maintained.**

Learning progress, spaced repetition, garden state, and visual restoration are therefore one system rather than separate game and study modes.

## Garden Domain Model

The garden replaces the original 110-field presentation. The 110 stable RTH/RSH source lists remain the learning source, but each is split in original frame order into two contiguous halves, creating **220 beds** while retaining the same character IDs and FSRS cards.

The garden has 15 visually distinct `Biome`s in a 5 × 3 layout: bamboo, rice, lotus, tea, blossom, peony, chrysanthemum, pine, persimmon, orchid, berries, rapeseed, wheat, wisteria, and medicinal herbs. The first biome contains 10 beds in a 2 × 5 layout; each of the other 14 biomes contains 15 beds in a 3 × 5 layout.

There is no intermediate garden-selection screen. The player pans and zooms the continuous clean/overgrown map, then enters a close, unlocked bed directly into the existing handwriting battle. Bed unlocking is permanent and propagates through base-cell adjacency; infection remains a live, stroke-weighted projection of due/new FSRS cards.

The welcome screen is the main menu. It offers **Войти в сад**, **Об игре**, **Поддержать**, and **Выход**. It is centered within the available viewport and must not scroll or reveal a strip of the garden map beneath it. Its garden backdrop covers the screen without tiling, including during mobile overscroll. The About and Support items open dedicated placeholder text screens with a route back to the main menu. Entering the garden preserves the player's save and current map camera. Exit closes the Android host; browser builds request that the current tab be closed.

`public/assets/audio/sound/theme.mp3` is the looping background theme for the main menu and the garden map. One shared player keeps the track continuous when moving between those two screens. The theme is paused everywhere else, including About, Support, Statistics, and the handwriting battle; drawing characters currently has no background music. Browser autoplay restrictions or playback failures must never block navigation or gameplay, and playback is retried after the first user gesture when necessary.

The product icon is shared across browser favicons, touch icons, the Android download page, and the Android launcher. It depicts a warm ivory calligraphic sprout and garden mound with the simplified character **忆** (memory / to remember) inside a cinnabar-red circular seal on a deep jade background. The Android adaptive-icon foreground must remain inside the platform safe zone so round, squircle, and rounded-square launcher masks preserve the complete mark.

The main map header also links to the statistics screen and has an icon-only exit-to-main-menu control as the rightmost header action, immediately to the right of Statistics. The exit control uses the same `LogOut` icon as the main-menu Exit action and has an accessible text label even though no text is shown visually.

Statistics renders every Hanzi in original frame order as a dense colored tile wall. The colors are a human-readable SRS-stage projection derived from each card's scheduled interval; they never alter FSRS scheduling or due dates. Its summary shows **Изучено** and **Закреплено**; it does not show a **На повторение сейчас** total.

## 2. Core Design Principles

1. **Production recall is primary.** The player is shown a meaning/keyword and must independently write the Hanzi.
2. **Writing is the combat mechanic.** There is no separate “flashcard UI” during play.
3. **The garden is persistent.** It is one continuous territory, not a sequence of runs.
4. **Garden progression and memory state are separate.** Unlocking territory is permanent; visual bed health changes according to FSRS.
5. **The map is a visual memory dashboard.** The player can look at the garden and intuitively see what needs attention.
6. **The game should remain readable without numbers.** Bed state is communicated primarily through visuals.

## 3. Source Learning Structure

The game uses the RTH/RSH knowledge base as a structural source.

```ts
type RawRthEntry = {
  frame: number;
  hanzi: string;
  keyword: string;
  rth_list: string;
  lesson: number;
  strokes: number;
  primitives?: string[];
  mnemo_story?: string;
  rth_list_name?: string;
};
```

Use:

- RTH/RSH ordering;
- grouping into lists;
- frame number;
- keyword;
- Hanzi;
- stroke count;
- lesson/list structure.

Do not use the book mnemonic stories as part of the core learning mechanic. Long mnemonic prose should not be included in the production bundle.

## 4. Garden Structure

### 4.1 Garden

The **Garden** is the single main map and contains all playable territory. It is divided into a fixed 5 × 3 grid of 15 biomes.

### 4.2 Biomes

A **Biome** is one of the 15 large, visually distinct areas of the garden. The first biome has a 2 × 5 layout of 10 beds. Every other biome has a 3 × 5 layout of 15 beds.

```ts
type Biome = {
  id: string;
  index: number;
  culture: BiomeCulture;
  mapQuad: NormalizedQuad;
  mapRect: NormalizedRect;
};
```

### 4.3 Beds

A **Bed** is the smallest territory unit that the player clears of weeds. The full garden contains **220 beds**. Selecting an unlocked bed starts a battle for that bed.

Each of the 110 unique RTH/RSH lists is split at its midpoint into two ordered bed workloads. The first five beds occupy two logical cells each so the first biome still presents exactly 10 beds; every later bed occupies one logical cell.

### 4.4 Bed Data

```ts
type BedDefinition = {
  id: string;
  sourceRthListId: string;
  sourceHalf: 0 | 1;
  biomeId: string;
  characterIds: string[];
  cells: GridCell[];
  seed: number;
  neighbors: string[];
};
```

`sourceRthListId` must be globally unique. Do not identify beds only by numeric lesson number if books 1 and 2 can overlap.

### 4.5 Map Camera

The player may zoom out only to the viewport's **cover** scale: the rendered garden must never become smaller than the viewport along either axis. Outside green space may appear along only the orientation's permitted axis—at the left/right sides on a landscape viewport, or at the top/bottom on a portrait viewport—never along both axes at once. Camera overscroll applies only to that permitted axis; panning must not expose a side edge in portrait orientation or a top/bottom edge in landscape orientation at any zoom level.

When the map automatically focuses the last active (or initial unlocked) bed on a viewport where auto-focus is enabled, it frames the bed's containing biome rather than the individual bed. This keeps the opening view oriented around the relevant biome without an excessively close zoom.

At camera zoom 5 and above, each non-empty unlocked bed and each non-empty bed directly adjacent to an unlocked bed shows the first character with the greatest `strokeCount` in that bed (source-list order breaks ties). More distant locked beds do not reveal a character. The character is rendered as a small, semi-transparent calligraphic Chinese label whose screen size stays stable as the map zoom changes. Labels have no background panel, do not capture pointer input, and must not materially obscure the garden artwork.

## 5. Character Data

```ts
type CharacterDefinition = {
  id: string;
  hanzi: string;

  keyword: {
    ru: string;
    en?: string;
  };

  frame: number;
  bedId: string;
  strokeCount: number;
  writingDataId: string;
  structure: CharacterStructure;
  pronunciation: {
    pinyin: string;
    audioFile: string | null;
  };
};

type CharacterStructure = {
  hanzi: string;
  keyword: string;
  primitive: string | null;
  components: readonly { hanzi: string; keyword: string }[];
};
```

The displayed Russian keyword is `structure.keyword` from
`src/data/rsh_structure_ru.json`. That catalog also stores the additional
primitive meaning and the direct composition shown in battle. Editing the
catalog and replacing the asset updates those three fields.

Example:

```json
{
  "id": "rth1-0142",
  "hanzi": "猫",
  "keyword": {
    "ru": "кошка",
    "en": "cat"
  },
  "frame": 142,
  "bedId": "rsh-book1-list-08",
  "strokeCount": 11,
  "writingDataId": "猫",
  "pronunciation": {
    "pinyin": "māo",
    "audioFile": "cmn-mao1.mp3"
  }
}
```

### 5.1 Pinyin Pronunciation Audio

Completing the final accepted stroke of a character immediately plays that
character's Mandarin pinyin syllable. Pronunciation is optional feedback: a
blocked, unavailable, or failed audio playback must never delay or alter review
grading, XP, combo, achievements, save persistence, or progression to the next
character.

The source of truth is `rsh_audio_cmn_syllables.xlsx`. For characters with more
than one dictionary reading, the game uses the row whose `reading_rank` is `1`.
The workbook's selected 64 kbit/s recordings come from the CC BY-SA
`hugolpz/audio-cmn/64k/syllabs` set and are committed under
`public/assets/audio/pinyin/`. They remain public assets rather than JavaScript
imports, so only the active character's MP3 is preloaded and audio works with
both hosted URLs and the Android `file://` bundle.

The current upstream tree does not contain every logical filename emitted by
the workbook. Neutral-tone filenames absent upstream resolve to the matching
tone-1 recording, consistent with the upstream note that removed tone-5 files
were duplicates. The workbook's `ju4` resolves to upstream `jv4`. `yo1`/`yo5`
have no correct upstream MP3, so `哟` retains its pinyin metadata but playback is
silently skipped rather than substituting an incorrect syllable.

### 5.2 Stroke Feedback Audio

Every stroke accepted by Hanzi Writer plays
`public/assets/audio/sound/sfx/correct.wav`. Every rejected stroke plays
`public/assets/audio/sound/sfx/mistake.wav`. Both effects are preloaded when the
handwriting battle opens and replay from the beginning on each corresponding
callback. Missing assets, blocked playback, or audio-device failures must never
delay or alter stroke grading or any other gameplay state.

## 6. Persistent Progress Model

Two kinds of progress must remain independent.

### 6.1 Garden Progress

`unlockedBedIds` and `masteredBedIds` record permanent progression. A bed becomes mastered when every character in it has been successfully produced from memory at least once.

Once unlocked, a bed never becomes locked again.

### 6.2 Memory State

Memory state is dynamic and driven by FSRS. A previously mastered bed may later become partially or heavily overgrown because characters become due again.

```text
garden progression != current visual health
```

This distinction is fundamental.

## 7. Bed Infection / Garden Health

The bed visually represents unfinished memory work.

Simple MVP formula:

```text
totalWeight = Σ strokeCount(character)

weedWeight = Σ strokeCount(character)
             for characters currently new or due

infection = weedWeight / totalWeight
```

Stroke count serves as a rough workload proxy.

For rendering:

```ts
weedLevel = Math.ceil(infection * 10);
```

Possible states:

```text
0  pristine
1  nearly pristine
...
5  visibly mixed
...
10 almost completely overgrown
```

The authoritative state is FSRS. `weedLevel` is only a rendering projection.

Bed accessibility never changes infection. A locked bed contains new
characters and is therefore rendered as overgrown; the lock only prevents the
player from entering it. The garden map must keep those weeds visible rather
than replacing the bed with fog or an empty disabled state.

## 8. Map Presentation

The map should look like **one continuous magical garden divided into neighboring beds**, not a UI grid of cards.

Desired properties:

- top-down or lightly isometric view;
- beds share borders;
- stone walls, paths, irrigation channels, hedges, or terrain seams show boundaries;
- plant life fills beds up to those boundaries;
- several beds are visible at once;
- bed health is determined visually;
- no percentages are required;
- no labels are required during normal play;
- clicking/tapping a bed enters it.

The clean-bed layer and weed layer should remain technically separable.

### 8.1 Authoritative Map Mask and Exterior Edge Reveal

`garden-map.webp` and `garden-map_negative.webp` are two full-map states of the
same artwork. They must be scaled once to the same garden coordinate system and
composited through one global `1600 × 1200` mask. The negative artwork must
never be cropped and enlarged independently per bed: doing so breaks the 1:1
registration and exposes bed boundaries as a tile grid.

Bed interiors use the due/new coverage formula from section 7 and stable
organic masks derived from `bed.seed`. Completely overgrown adjacent beds
must be added to the global mask as one compound shape so antialiasing cannot
create clean seams between them.

The territory outside the 5 × 3 biome contour is part of progression;
it is **not an always-clean background**. Its reveal rules are:

1. Initially every exterior side and corner remains in the negative state.
2. A `Biome` is complete only while every bed in that biome has zero
   weed coverage. Locked beds and beds with any due/new characters prevent
   completion.
3. Completing a border biome reveals only the exterior side component directly
   adjacent to that biome. Completing an interior biome reveals no exterior
   component.
4. An exterior corner reveals only when both of its adjacent exterior sides are
   revealed.
5. Other sides and corners remain negative; revealing one component must not
   leak into another.
6. When a biome, side, or corner reveals, the painted boundary pixels touching
   that component also reveal (using the rasterized `garden-grid.svg` connected
   components, with an 18-garden-pixel neighborhood). This prevents a dark line
   from remaining around an otherwise clean component.

These states are a live projection of current FSRS health, like bed infection:
if reviews become due again and a biome stops being complete, its exterior
side and dependent corner return to the negative state. Raster labels from the
painted grid are authoritative for exterior connectivity; rectangular or
polygon-only approximations are insufficient. Raster-interior perimeter pixels
that fall outside the straight bed-quad union must inherit the mask alpha of
the nearest connected bed pixel in the same `Biome`; no clean sliver may
remain between the painted contour and the gameplay geometry.

## 9. Bed Art Architecture

Avoid authoring 220 × 11 fully unique bed scenes. Battle backdrops are grouped into 15 independently replaceable artwork sets, one for each biome.

Use composited layers:

```text
ground
↓
cultivated plant layer
↓
weed coverage mask
↓
weed sprites / vines / roots
↓
decay / desaturation / fog effects
↓
decorative props
```

Each bed can be defined by a recipe:

```ts
type BedVisualPreset = {
  id: string;
  ground: string;
  primaryPlant: string;
  secondaryPlants?: string[];
  decorations?: string[];
  palette?: string;
  weedFamily: string;
  seed: number;
};
```

The bed `seed` should produce deterministic placement so a bed always looks the same.

## 10. Core Gameplay Loop

```text
Garden Map
    ↓
Player notices an overgrown bed
    ↓
Player selects the bed
    ↓
Battle opens for that bed
    ↓
A weed corresponds to one due/new Hanzi
    ↓
Prompt shows meaning, e.g. "КОШКА"
    ↓
Player writes 猫 from memory
    ↓
Each accepted stroke damages the weed
    ↓
Full character destroys the weed
    ↓
FSRS is updated
    ↓
Next weed / character
    ↓
Bed becomes progressively healthier
    ↓
Return to map
```

The player may choose between restoring old beds, finishing partially cleaned beds, and advancing into newly unlocked territory.

## 11. Battle

The battle should contain almost no conventional UI.

Required elements:

- exit/back control;
- target keyword/meaning;
- central garden/weed target;
- invisible or nearly invisible writing input area.

For characters with known direct components, a composition control opens a
modal that shows each component's Hanzi form and keyword. The modal must never
show the target Hanzi itself. Every activation of the composition control
counts as one handwriting error, reducing the character's XP reward by 1 under
the same minimum-reward rule as other handwriting errors.

The battle keyword plaque must keep each word intact at supported viewport
sizes, including when Android uses its maximum system font size. Multi-word
meanings may wrap only at word boundaries. The text may shrink as needed, but
must remain legible and must not be clipped, leave the plaque, overlap the
writing target, or cover battle controls.

Initially do **not** display:

- the target Hanzi;
- stroke order;
- an outline;
- answer choices;
- a visible handwriting grid.

The scene should preserve the established subdued ink-on-fabric Chinese fantasy aesthetic.

## 12. Writing Is Combat

For a character with `N` strokes:

```ts
weed.healthSegments = N;
```

Each accepted stroke:

```ts
weed.damage(1);
```

Possible feedback:

- a branch breaks;
- roots retract;
- part of the weed dissolves into ink;
- dry leaves fall;
- the weed recoils;
- nearby cultivated plants become more visible.

The weed geometry does not need to match the Hanzi geometry. The mapping is conceptual:

```text
correct stroke → attack
```

## 13. Handwriting Recognition Strategy

### 13.1 Do Not Use General OCR for MVP

The game does not need to recognize arbitrary unknown handwriting.

General OCR solves:

```text
unknown drawing
    ↓
classifier
    ↓
which Chinese character is this?
```

The game already knows the expected answer:

```ts
expectedCharacter = "猫";
expectedStrokeIndex = 6;
```

The actual problem is:

> Does the user's current gesture sufficiently match the expected canonical stroke?

This is a constrained stroke-validation problem, not general handwriting recognition.

## 14. Recommended MVP Handwriting Stack

Use:

- **Hanzi Writer**
- **hanzi-writer-data**
- stroke geometry derived from **Make Me a Hanzi**

Hanzi Writer already provides:

- stroke-order quiz logic;
- input capture;
- current expected stroke tracking;
- stroke validation;
- correct-stroke callbacks;
- mistake callbacks;
- completion callbacks;
- backward-stroke checking;
- configurable leniency.

For MVP, use Hanzi Writer as an invisible handwriting-validation layer while the game engine renders the actual battle scene.

## 15. Canonical Stroke Data

Conceptually:

```json
{
  "character": "猫",
  "strokes": [
    "M ...",
    "M ...",
    "M ..."
  ],
  "medians": [
    [[0, 0], [1, 1]],
    [[0, 0], [1, 1]]
  ]
}
```

### `strokes`

SVG outlines for canonical strokes. Useful for rendering references, hints, debugging, and masks.

### `medians`

Center-line polylines describing stroke trajectories. Useful for spatial, direction, and shape matching.

## 16. What a Stroke Matcher Should Check

Validation should combine multiple signals.

### 16.1 Spatial Position

Measure the average distance between the player's stroke and the expected canonical stroke.

### 16.2 Start and End Position

Compare:

```text
user.start ↔ expected.start
user.end   ↔ expected.end
```

### 16.3 Direction

Compare user and reference direction vectors using cosine similarity. This distinguishes left-to-right from right-to-left gestures even when geometry overlaps.

### 16.4 Length

Reject gestures that are much too short or inconsistent with the expected stroke.

### 16.5 Shape

Normalize both paths and compare their curve shapes. A Fréchet-distance-style comparison is appropriate because it respects point order along curves. Allow small rotation tolerance.

### 16.6 Stroke Order

When stroke `N` is expected, optionally compare the gesture against later strokes. If it strongly matches stroke `N+1` or `N+2`, classify it as a probable stroke-order error.

### 16.7 Reverse Direction

Reject geometrically correct strokes performed backwards when correct direction is part of the learning goal.

Recommended:

```ts
acceptBackwardsStrokes = false;
```

## 17. MVP Integration with Hanzi Writer

```ts
const writer = HanziWriter.create(element, "猫", {
  showCharacter: false,
  showOutline: false,

  acceptBackwardsStrokes: false,
  showHintAfterMisses: false,

  leniency: 1.0,
  highlightOnComplete: false
});

writer.quiz({
  onCorrectStroke(data) {
    battleSystem.damageWeed({
      strokeIndex: data.strokeNum
    });
  },

  onMistake(data) {
    battleSystem.rejectStroke({
      strokeIndex: data.strokeNum
    });
  },

  onComplete() {
    battleSystem.destroyWeed();
    learningSystem.finishReview();
  }
});
```

Hanzi Writer should not render the game's weed, particles, camera, or environment.

## 18. Rendering Architecture

```text
┌───────────────────────────────────────┐
│ Game Renderer                         │
│                                       │
│ bed                                 │
│ cultivated plants                     │
│ weed                                  │
│ particles                             │
│ animations                            │
│ camera                                │
│                                       │
├───────────────────────────────────────┤
│ Transparent handwriting input layer   │
│ Hanzi Writer / Stroke Engine          │
│                                       │
│ pointer input                         │
│ expected stroke                       │
│ validation                            │
└───────────────────────────────────────┘
```

## 19. Stroke Input Capture

If matching is later moved in-house, use Pointer Events:

```text
pointerdown → start stroke
pointermove → append points
pointerup   → finish stroke → validate
```

```ts
type InputPoint = {
  x: number;
  y: number;
  t: number;
  pressure?: number;
};
```

Pressure should not affect correctness. It may be used for ink width only.

## 20. Input Preprocessing

Before matching:

```text
raw pointer samples
↓
remove duplicates
↓
remove microscopic jitter
↓
resample along curve length
↓
transform to canonical coordinate system
↓
match
```

A practical approach is to resample to roughly `32–48` points. Do not over-smooth because hooks and corners carry information.

## 21. Stroke Completion Timing

Do not validate continuously while the pointer is down. Capture freely and validate only on `pointerup`.

## 22. Correctness Philosophy

The game validates structural correctness, not calligraphic beauty.

Generally accept:

- slightly imperfect handwriting;
- mild rotation;
- small placement errors;
- finger jitter;
- modest length variation.

Generally reject:

- wrong stroke;
- wrong stroke order;
- backwards stroke;
- clearly wrong location;
- missing stroke;
- multiple strokes merged into one gesture;
- meaningless tiny gesture.

Initial recommendation:

```ts
leniency = 1.0;
```

Tune only after collecting real handwriting samples.

## 23. Custom Stroke Matcher — Post-MVP

Once the core loop is proven, vendor/fork or replace the matcher with a custom engine.

```ts
type StrokeMatch = {
  accepted: boolean;
  expectedStrokeIndex: number;

  score: number;
  positionScore: number;
  directionScore: number;
  shapeScore: number;
  lengthScore: number;

  backwards: boolean;
  probableWrongStroke?: number;
};
```

This enables richer feedback and telemetry.

## 24. Hints and Error Handling

Do not reveal the answer after one mistake.

Suggested progression:

- first mistake: ink fades, no weed damage;
- second mistake: same;
- after ~3 failed attempts on the same stroke: briefly show only the next expected stroke as a faint ink ghost for ~500–700 ms.

Do not reveal the full character unless the player explicitly asks for a stronger hint or reaches a failure state.

## 25. Review Grading

Combat completion and FSRS grading must remain separate.

Bad rule:

```text
weed destroyed → FSRS Good
```

Recommended MVP grading:

```ts
function gradeReview(result: ReviewAttempt): Rating {
  if (
    result.hintUsed ||
    result.revealedStroke ||
    result.totalMistakes >= 3
  ) {
    return Rating.Again;
  }

  return Rating.Good;
}
```

For MVP, primarily use `Again` and `Good`.

Do not infer `Easy` from writing speed because mouse, touch, stylus, screen size, and motor ability vary substantially.

## 26. Review Event Storage

```ts
type ReviewEvent = {
  id: string;
  characterId: string;
  timestamp: number;

  rating: "again" | "hard" | "good" | "easy";

  totalMistakes: number;
  strokeMistakes: number[];

  hintUsed: boolean;
  durationMs: number;

  inputDevice: "mouse" | "touch" | "pen";
};
```

This data is useful for matcher tuning and future personalization.

## 27. FSRS

Use an existing FSRS implementation rather than writing FSRS from scratch.

Recommended TypeScript library:

```text
ts-fsrs
```

FSRS owns:

- stability;
- difficulty;
- due dates;
- scheduling state;
- review history.

The game layer projects these states into weeds and garden health.

## 28. State Separation

```text
                GameApp
                   │
       ┌───────────┴───────────┐
       │                       │
   GameGarden               LearningCore
       │                       │
       │                 ┌─────┴─────┐
       │                 │           │
   Renderer          StrokeEngine   FSRS
       │                 │           │
 ┌─────┴─────┐       HanziData   ReviewStore
 │           │
GardenScene  BattleScene
```

Rules:

```text
GameGarden must not implement spaced repetition.
FSRS must not know anything about weeds.
StrokeEngine must not decide bed unlocks.
Renderer must not own learning state.
```

Use explicit adapters between systems.

## 29. Suggested Technology Stack

| Area | Recommended Technology |
|---|---|
| Language | TypeScript |
| Build | Vite |
| UI / map / battle | React + DOM/CSS (current implementation) |
| Handwriting MVP | Hanzi Writer |
| Stroke data | hanzi-writer-data / Make Me a Hanzi |
| Spaced repetition | ts-fsrs |
| Local database | IndexedDB |
| IndexedDB wrapper | Dexie |
| Android packaging | Thin Kotlin WebView shell in `android/` (bundled `assets/www/`) |

Web and Android ship from the same repository: sync the production Vite build into the APK; do not treat the Android app as a separate product checkout.

## 30. Offline-First Design

Bundle character stroke data locally:

```text
/assets
  /characters
    猫.json
    水.json
    我.json
    ...
```

Recommended rule:

> No CDN dependency is required to start or complete a review session.

## 31. Stroke-Order Variants

Canonical stroke order can vary by region or educational standard. Define one default standard, likely the PRC simplified-character convention used by the selected dataset.

Provide an override mechanism:

```ts
type CharacterWritingOverride = {
  character: string;
  acceptedVariants?: StrokeVariant[];
};
```

Do not manually curate thousands of variants before launch. Add targeted overrides when QA or user reports identify a real problem.

## 32. Anti-Cheese Rules

Recommended:

- only one active pointer contributes to handwriting;
- multi-touch does not draw;
- require minimum meaningful path length;
- require a minimum number of useful samples;
- `pointerup` always ends a stroke;
- accepted strokes cannot be undone during the current answer;
- do not use speed as a correctness signal;
- rely on position, shape, direction, length, and order.

## 33. Handwriting Telemetry

Basic prototype event:

```json
{
  "character": "猫",
  "stroke": 4,
  "accepted": false,
  "inputDevice": "touch",
  "pointCount": 34,
  "durationMs": 428
}
```

After adopting a custom matcher:

```json
{
  "position": 0.91,
  "shape": 0.82,
  "direction": 0.97,
  "length": 0.93
}
```

This enables objective threshold tuning rather than subjective tweaking.

## 34. Handwriting Technical Prototype

Before producing a large amount of content, build a standalone handwriting validation prototype.

Test approximately 100 characters spanning:

- 1–5 strokes;
- 6–12 strokes;
- 13–20 strokes;
- 20+ strokes;
- dots;
- hooks;
- long sweeps;
- dense characters;
- similar neighboring strokes;
- complex spatial layouts.

For each character test:

```text
correct handwriting
slightly sloppy handwriting
wrong stroke
wrong order
reverse direction
neighboring stroke
merged strokes
very short gesture
```

Suggested MVP target:

```text
obviously correct writing: ≥95% accepted
clearly incorrect strokes: ≤2–3% false accepts
```

If handwriting does not feel reliable, do not build deeper game systems first. The game's core fantasy depends on trusting stroke validation.

## 35. Weed Rendering

Each weed corresponds to one character.

```ts
type WeedInstance = {
  characterId: string;
  totalSegments: number;
  remainingSegments: number;
};
```

Initialization:

```ts
weed.totalSegments = character.strokeCount;
weed.remainingSegments = character.strokeCount;
```

On correct stroke:

```ts
weed.remainingSegments -= 1;
```

On final stroke:

```text
remainingSegments = 0
→ destruction animation
→ review completion
```

Visual segment mapping can be artistic rather than literal.

## 36. Visual Damage Progression

Example:

```text
stroke 1 → thin branch snaps
stroke 2 → thorn cluster falls
stroke 3 → root mass retracts
...
final stroke → core collapses → weed dissolves like ink
```

Feedback should be satisfying but restrained.

Established visual direction:

- muted;
- pastel;
- ink-like;
- textile/paper texture;
- subdued Chinese fantasy painting;
- low saturation;
- limited glowing effects.

## 37. Map Weed Rendering

Weed growth should be composited over the clean cultivated bed.

Avoid treating infection as only a transparent dark filter.

Better:

```text
clean vegetation
      ↓
coverage mask expands
      ↓
healthy vegetation is suppressed in covered areas
      ↓
weed material replaces it
```

## 38. Weed Coverage Levels

Maintain approximately ten visual degradation levels. They can share deterministic organic masks.

Example:

```text
level 1  → highest-value 10% of mask
level 2  → highest-value 20%
...
level 10 → nearly all of mask
```

This ensures weeds expand from existing patches instead of teleporting randomly between updates.

## 39. Save Data

```ts
type SaveGame = {
  version: 4;
  unlockedBedIds: string[];
  masteredBedIds: string[];
  lastActiveBedId: string | null;
  seenCharacterIds: string[];
  cards: Record<string, CardState>;
  reviewEvents: ReviewEvent[];
  updatedAt: number;
};
```

Use IndexedDB via Dexie.

Do not persist visual state that can be derived from learning state, such as bed darkness or weed percentage.

## 40. Versioning and Migration

Every save includes:

```ts
version: number;
```

Implement migrations early:

```ts
type SaveMigration = {
  from: number;
  to: number;
  migrate(data: unknown): unknown;
};
```

Learning applications accumulate valuable long-term history, so save compatibility matters.

## 41. Debug Tools

Every build, including production and Android `file://`, exposes an invisible browser testing API at `window.hanziGardenCheats`. It has no in-game UI and provides:

```ts
drawCorrectStroke(): Promise<void>;
drawWrongStroke(): Promise<void>;
dumpDb(format?: "json" | "object"): Promise<string | SaveGame>;
loadDb(dump: string | SaveGame): Promise<void>;
```

Stroke cheats must pass canonical Hanzi medians through the same Hanzi Writer quiz input path as real mouse input. A wrong stroke uses the current median in reverse, so ordinary mistake counts, hints, animations, and review grading remain authoritative. The promises resolve only after the corresponding quiz callback.

`dumpDb()` waits for pending Dexie writes and defaults to formatted JSON suitable for a backup; object mode returns a deep clone. `loadDb()` accepts either form, validates the v4 save structure, restores FSRS dates, persists the exact snapshot, synchronizes live application state, and returns to the garden. It intentionally does not enforce domain consistency between IDs or progression properties so tests can load impossible states.

Additional debug tooling may support:

```text
select any bed
set all cards due
set all cards clean
jump weed level 0–10
force unlock
force lock
inspect character
show expected stroke geometry
show user path
show stroke match score
show FSRS card state
simulate review date
```

Development builds expose `/debug/animations`, a standalone reward-animation
workbench rendered over the real battle field. One control opens a random
achievement through the production achievement popup; three separate controls
replay the production XP drop for `+1`, `+3`, or `+5 XP`. Repeated presses must
restart the animation without reloading the page. The workbench must not load,
mutate, or persist player progress and is not exposed in production builds.

Development builds also expose the throwaway `/prototype/biome-badges`
workbench. It renders the player-facing achievement popup for every biome badge
and lets developers adjust the sprite's CSS dimensions, background size and
border radius together with the JavaScript grid, position divisors, and offsets.
The current formulas and per-index coordinates remain visible while editing.
The workbench keeps its state in memory, never loads or changes player progress,
and is not exposed in production builds.

Development builds also expose the throwaway `/prototype/keyword-prompts`
workbench. It renders the battle keyword plaque for every character in the
production catalogue, including the additional primitive value where present.
The page provides searchable gallery, longest-first, and detailed audit views,
shows the effective plaque CSS, and lets developers tune its dimensions and
typography in memory across every visible plaque. It never loads or changes
player progress and is not exposed in production builds.

Development builds also expose `/prototype/content-editor`, a service utility
for editing game content files. The user opens a JSON asset (or a bundled
catalog shortcut), edits the document in the browser, and downloads the result
to replace the original file. The first supported documents are:

- the character structure catalog (`rsh_structure_ru.json`): keyword, additional
  primitive meaning, and composition components;
- the achievement catalog (`achievements.json`): the award formula (`on` events
  and `when` expression).

The editor does not load or change player progress, is not exposed in production
builds, and is intended to grow with additional content kinds later.

## 42. Accessibility / Input Devices

Target:

```text
mouse
touch
pen/stylus
```

Do not assume a stylus.

Correctness thresholds should be validated primarily on touch, because finger input is likely the noisiest common case.

Possible visual behavior:

```text
pen   → pressure affects ink width
touch → fixed or velocity-smoothed ink width
mouse → fixed width
```

Correctness remains device-independent.

## 43. Performance Targets

Map:

- zoomable garden with 220 gameplay beds (V2) on a continuous map;
- avoid independent full-resolution animated scenes per bed;
- use atlases, layered map art, and batching where practical;
- animate only visible/near-visible work during battle.

Battle:

- target 60 FPS on typical modern mobile hardware;
- handwriting input remains responsive under effects;
- matcher runs after `pointerup`, not continuously every frame;
- same battle path must remain viable inside the Android WebView APK (`file://` assets).

## 44. Licensing Checklist

Before distribution, verify and include licenses for:

- Hanzi Writer;
- hanzi-writer-data;
- Make Me a Hanzi derived assets;
- fonts;
- generated or third-party art;
- any RTH-derived grouping/keyword data whose distribution requires permission.

Suggested structure:

```text
/third-party-licenses
  HANZI_WRITER.txt
  HANZI_DATA.txt
  ...
```

Licensing review should happen before commercial release.

## 45. MVP Scope

Required:

- one garden divided into 15 biomes in a 5 × 3 grid;
- 10 beds in the first biome (2 × 5) and 15 in every other biome (3 × 5);
- 220 beds, with every RTH list split into two ordered bed workloads;
- bed unlock graph;
- permanent unlock state;
- FSRS card for each Hanzi;
- new/due characters represented as weeds;
- meaning → write Hanzi prompt;
- stroke-by-stroke validation;
- correct stroke damages weed;
- full character destroys weed;
- bed health derived from due/new workload;
- clean bed art plus weed overlay;
- local save data;
- selecting an unlocked bed starts its battle;
- return to the garden after cleaning.

Explicitly out of MVP:

- XP;
- currencies;
- crafting;
- equipment;
- base building;
- character classes;
- quests;
- roguelike runs;
- combat statistics;
- large RPG progression;
- large resource economy.

## 46. Development Order

### Phase 0 — Data Validation

- normalize all RTH/RSH records;
- verify 110 unique lists;
- assign stable `bed-*` IDs;
- verify every required Hanzi has stroke data;
- report missing or problematic characters.

### Phase 1 — Handwriting Prototype

Build only:

```text
keyword
+
blank writing area
+
stroke matching
+
debug overlay
```

Success criterion:

> writing feels trustworthy and pleasant.

### Phase 2 — Battle Prototype

Add:

```text
weed
stroke → damage
mistake feedback
completion animation
```

### Phase 3 — FSRS

Add:

```text
review state
Again / Good mapping
due dates
review persistence
```

### Phase 4 — Single Bed

Implement one complete bed with multiple weeds and visible restoration.

### Phase 5 — Garden

Implement:

```text
15 biomes
220 beds
2 × 5 / 3 × 5 biome layouts
unlock graph
visual infection state
navigation
```

### Phase 6 — Content and Polish

Add:

```text
15 biome plant identities
weed families
map transitions
sound
ink effects
performance optimization
```

## 47. Primary Technical Risk

The largest risk is not the map, FSRS, or art. It is:

> **Can stroke validation feel accurate enough that the player believes a correct handwritten stroke reliably causes a successful attack?**

A false rejection breaks both the learning contract and the combat fantasy.

Therefore handwriting validation should be prototyped and measured before major content production.

## 48. Core Technical Decision

> **The game does not recognize arbitrary handwritten Chinese characters. It validates a known target character stroke-by-stroke against canonical vector stroke data.**

This provides:

- reliable stroke order;
- immediate per-stroke feedback;
- lightweight local computation;
- offline operation;
- no OCR service dependency;
- direct mapping from correct writing to combat.

Recommended evolution:

```text
MVP
↓
Hanzi Writer
+
hanzi-writer-data
+
existing quiz callbacks

Validation of core gameplay
↓
vendor/fork matcher logic

V2
↓
custom StrokeEngine
+
custom ink renderer
+
custom scoring
+
telemetry-driven thresholds
```

## 49. Product Thesis

The complete product loop should feel like:

> I do not study flashcards to earn resources that improve a garden. Remembering the characters **is** how I restore the garden.

The game succeeds when these become the same action:

```text
remember
=
write
=
fight
=
clean
=
restore garden
=
maintain memory
```

## 50. XP, Levels, and Combo

Every completed Hanzi awards permanent XP. XP is not spendable, never resets,
has no hard cap, and does not gate reviews or other learning actions.

```text
kanjiXp = max(1, correctStrokeCount - errorCount)
earnedXp = kanjiXp + comboMilestoneBonus
```

`Combo` is session state and counts consecutive fully completed Hanzi with zero
stroke errors. Any error in a Hanzi resets Combo when that Hanzi completes.
Milestones award a small one-time bonus:

```text
3  → +1 XP
5  → +2 XP
10 → +3 XP
20 → +5 XP
50 → +8 XP
100 → +12 XP
150 and every further multiple of 50 → +10 XP
```

Combo bonuses use short jade/gold glow, particle, pulse, and synthesized sound
cues. Gameplay shows only a transient XP/Combo toast. The map permanently
shows a compact level medallion, thin progress bar, and in-level XP count.
When the operating system requests reduced motion, the XP/Combo toast remains
completely static and visible for approximately one second, then disappears
immediately; reduced motion must never make the reward feedback invisible.

The XP cost from level `L` to `L + 1` is linear:

```text
xpForNextLevel(L) = 100 + 20 × (L - 1)
totalXpForLevel(L) = 10n² + 90n, where n = L - 1
```

`totalXp` is the persistent source of truth; level and in-level progress are
derived. A single reward may cross multiple level thresholds, and every crossed
level is presented as its own reward beat. The cleared-bed screen shows correct
strokes, errors, Combo bonus, total XP, in-level progress, and sequential
level-up beats.

Persistence also retains lifetime correct strokes, errors, completed Hanzi,
completed bed runs, best Combo, perfect complex Hanzi, and permanently completed
biome IDs. Save version 5 introduced progression and reconstructs provable
historical progress from retained review events.

## 51. Achievements

Achievements are permanent offline unlocks and never award XP. The centralized
achievement engine consumes domain events (`kanji.completed`,
`gardenBed.completed`, `session.activeTime`, and migration events); React UI
components do not contain eligibility rules. Unlock is idempotent and stores an
ISO `unlockedAt` timestamp.

The collection and its award formulas live in `src/data/achievements.json`.
Each achievement names the events it listens to and a `when` expression over
`event`, `player`, `session`, `persistence`, and `daysSinceLastActive`. The
engine still owns streak and perfect-bed counters; it then evaluates the
catalog formulas. Replacing that JSON asset changes which achievements unlock.

The collection contains 61 deduplicated achievements across daily practice,
Combo, the 15 real biomes, session duration, writing, lifetime statistics,
recovery, and secrets. It includes:

- daily streak milestones at 3, 7, 14, 30, 90, 180, and 365 local calendar days;
- return after at least 30 absent days;
- shared Combo milestones at 5, 10, 20, 50, 100, and secret 250;
- one achievement for each biome plus 1/5/10/15-biome milestones;
- active-session milestones at 15/30/60/90/120 minutes;
- perfect complex writing, correct-stroke, and completed-Hanzi milestones;
- perfect bed, three perfect beds in one local day, and ten beds in one session;
- error/recovery stories, exact 100 XP for a bed, and a one-XP Hanzi.

A calendar day becomes active only after a completed Hanzi. Active session time
pauses while the document is hidden or after 150 seconds without pointer,
keyboard, wheel, or touch interaction. Secret cards hide both title and exact
condition until unlock. Counter cards expose progress only when doing so does
not reveal a secret.

Simultaneous unlocks enter a queue and appear one at a time as short, skippable
parchment cards over a dimmed game. The collection is a tab of Statistics, so
the garden map receives no additional navigation control. Badge art uses two
generated, internally consistent sprite atlases: one eight-category family and
one 15-biome family. Both use aged gold, dark jade, parchment, cinnabar accents,
and the garden's botanical motifs.

Save version 6 adds achievement persistence. Migration grants only achievements
that existing review history or durable counters can prove; event-specific
secrets such as a final-stroke error or exact bed XP are never guessed.
