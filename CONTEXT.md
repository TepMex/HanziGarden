# Hanzi Garden

The game is set in a magical garden whose weeds represent Chinese characters that are new or due for review.

## Garden Structure

**Garden**:
The single main map containing all playable territory. The garden is divided into a 5 × 3 grid of 15 biomes.
_Avoid_: World, estate, main map

**Biome**:
One of the garden's 15 visually distinct large areas. The first biome contains 10 beds in a 2 × 5 layout; every other biome contains 15 beds in a 3 × 5 layout.
_Avoid_: Garden, garden region, region, field

**Bed**:
The smallest territory unit that the player clears of weeds. Selecting an unlocked bed starts a battle for that bed.
_Avoid_: Plot, field, cell, area, section

**Battle**:
The encounter entered by selecting a bed, in which the player clears that bed's due or new Hanzi by writing them.
_Avoid_: Lesson, level

**Character note**:
A player-written reminder attached to one Hanzi and available during battle.
_Avoid_: Mnemonic, comment, annotation, hint

## Learning Content

**Keyword**:
The primary Russian meaning shown as the writing prompt for one Hanzi.
_Avoid_: RSH keyword, primitive

**Additional meaning**:
An optional secondary Russian meaning shown under the keyword. The current
implementation stores it in the legacy `primitive` field, but it is ordinary
dictionary content rather than a Heisig primitive.
_Avoid_: Primitive meaning, mnemonic

**GF component**:
One graphical Hanzi component catalogued by GF 0014-2009. A component may be a
Unicode glyph or a non-encoded shape represented by an IDS description and a
generated image.
_Avoid_: Primitive, mnemonic element

**Composition**:
The ordered direct decomposition of one Hanzi into GF components. Atomic Hanzi
have no composition.
_Avoid_: RSH decomposition, mnemonic
