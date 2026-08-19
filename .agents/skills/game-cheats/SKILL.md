---
name: game-cheats
description: Use Hanzi Garden's browser cheat API for gameplay checks that need accepted or rejected strokes, save-state setup, database dumps, or backup restoration. Use when testing this game through a browser; do not use for unit-only checks.
---

# Hanzi Garden Game Cheats

Use `window.hanziGardenCheats` from browser evaluation instead of drawing guessed coordinates or opening IndexedDB directly.

1. Wait until `window.hanziGardenCheats` exists. For stroke calls, also enter a battle and wait for `.writing-circle svg`.
2. `await` every cheat call. Stroke promises settle only after Hanzi Writer classifies the input; dump operations wait for queued database writes.
3. Take a JSON backup before loading a temporary state when the browser profile contains data worth preserving. Restore it before finishing the check.
4. Assert the resulting UI or exported save, not implementation details of the cheat module.

Read [references/api.md](references/api.md) when constructing or modifying a dump, selecting a dump format, or diagnosing a rejected cheat call.
