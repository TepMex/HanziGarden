# Hanzi Garden

The game is set in a magical garden whose weeds represent Chinese characters that are new or due for review.

## Garden Structure

**Garden**:
The single main map containing all playable territory. Visible geography is a 217-cell hex island; learning work is still organized as 220 beds in Heisig/RTH order.
_Avoid_: World, estate, main map

**Biome**:
One of the garden's 15 official cultures. On the hex map, biomes are seeded coherent regions rather than a fixed 5 × 3 layout.
_Avoid_: Garden, garden region, region, field

**Hex**:
The smallest geographic cell the player can clear. Axial `(q, r)` coordinates; contents come from `gardenSeed`, never from Heisig number.
_Avoid_: Bed, plot, field

**Bed**:
The smallest learning unit. Completing a bed grants one hex-clear and unlocks the next Heisig-ordered bed. Selecting a cleared hex starts the next due bed battle.
_Avoid_: Plot, field, cell, area, section

**Battle**:
The encounter entered by selecting a bed, in which the player clears that bed's due or new Hanzi by writing them.
_Avoid_: Lesson, level
