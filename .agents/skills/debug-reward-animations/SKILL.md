---
name: debug-reward-animations
description: Use Hanzi Garden's development reward-animation workbench to inspect, reproduce, or tune achievement popups and +1/+3/+5 XP drops. Use when debugging these reward animations; do not enter gameplay or mutate player progress just to trigger them.
---

# Debug Reward Animations

Use the standalone development page at `/debug/animations`. Start the app with
`bun run dev`, then open that path on the port reported by Vite. The route exists
only in development builds.

The workbench renders the real battle backdrop and the same UI components used
by gameplay:

- **Случайное достижение** opens a random production `AchievementPopup`;
- **+1**, **+3**, and **+5** replay the production `XpToast`;
- repeated XP presses create a new keyed toast and restart its animation.

Use this page before constructing a gameplay state merely to observe or tune
these effects. It must remain isolated from save loading, persistence, XP totals,
achievement unlocks, and other player progress.

Relevant implementation seams:

- `src/debug/AnimationDebugPage.tsx` — workbench controls and presentation;
- `src/XpToast.tsx` — shared gameplay/debug XP component;
- `src/achievements/AchievementUi.tsx` — shared achievement popup;
- `src/styles.css` — production animation and workbench layout;
- `src/main.tsx` — development-only route.

When changing an animation, verify the observable effect through the workbench
at desktop and mobile viewport sizes. Check that rapid or repeated presses
restart XP animations, the achievement dialog can be dismissed, and the page
has no runtime errors. Update `GAME_SPEC.md` in the same change whenever the
animation or workbench requirements change.
