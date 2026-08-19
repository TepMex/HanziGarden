# Instructions for AI Agents

## Keep the game specification current

Whenever requirements are added, changed, clarified, or removed, update
`GAME_SPEC.md` in the same change so that it remains the current source of truth.
Do not leave requirement changes documented only in chat, issues, plans, code,
tests, or other specification files.

## Browser game checks

When checking gameplay through a browser, use the `$game-cheats` skill and
`window.hanziGardenCheats` for strokes and save-state setup. Do not manually
approximate stroke coordinates or edit IndexedDB directly when the cheat API
can express the check.
