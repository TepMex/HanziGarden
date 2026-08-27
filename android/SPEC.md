# Hanzi Garden Android — SPEC

## Purpose

Ship **Hanzi Garden** and the additional **Hanzi Garden HSK 1** demo as separately installable sideload Android APKs by wrapping the React/Vite web editions from **this same repository** in one thin native shell. Players get the same meaning→write Hanzi garden game offline on Android 14+, downloadable from this repo’s GitHub Pages `/android/` landing.

Audience: Mandarin learners who already use the web game and want a home-screen install with local progress.

## Repository layout

This is a **single-product** repository (not a multi-project monorepo):

| Path | Role |
| ---- | ---- |
| Repo root | Web game (`package.json`, `src/`, `public/`, …) |
| `android/` | Kotlin WebView shell, Gradle project, APK landing (`site/`) |

There is no sibling game or Android checkout. Asset sync builds the web app from the parent of `android/` (the repo root).

## Requirements

1. Package the production build of the root web game into the APK under `assets/www/` and load it in a full-screen WebView (`file:///android_asset/www/index.html`).
2. Preserve game behavior: JavaScript, IndexedDB (Dexie), DOM storage, canvas/Hanzi Writer pointer input, and Web Audio must work inside the WebView.
3. Lock the activity to **portrait** orientation. Do not follow the device sensor or the system auto-rotate setting: the game is designed for a single upright screen position.
4. Use immersive system UI (hide status/nav bars) so the game fills the screen.
5. Keep the legacy application id `com.tepmex.rthagriculture` for primary-edition in-place upgrades; display name **Hanzi Garden**. The HSK 1 flavor uses `com.tepmex.rthagriculture.hsk1` and display name **Hanzi Garden HSK 1** so both editions install side by side.
6. minSdk 34, compile/targetSdk 35; Kotlin + ViewBinding shell.
7. Sign release (and debug when keystore present) with the committed **sideload** keystore in `android/` so Pages APKs upgrade in place.
8. Publish a GitHub Pages landing at `/android/` (from `android/site/`) with `hanzi-garden.apk` and `hanzi-garden-hsk1.apk` downloads.
9. CI rebuilds the APK when `android/**` or the web game sources/assets at the repo root change (bundled assets must stay in sync).
10. Provide a local/CI script to build both web editions with relative `base: ./` and sync output into `app/src/main/assets/www/` and `app/src/hsk1/assets/www/`.
11. Ship map/battle art as **WebP** (including a distinct backdrop set for each of the 15 gardens) so the release APK stays under GitHub’s 100 MB push limit without remote asset downloads or shared-placeholder dedupe.

## Interfaces

| Interface | Detail |
| --------- | ------ |
| Launcher activity | `com.tepmex.rthagriculture.MainActivity` — single WebView host |
| Bundled URI | `file:///android_asset/www/index.html` |
| Asset sync CLI | `./scripts/sync-web-assets.sh` (from `android/`) |
| Gradle | `./gradlew assembleFullRelease assembleHsk1Release` |
| Pages downloads | `https://<host>/<repo>/android/hanzi-garden.apk` and `hanzi-garden-hsk1.apk` |
| Upstream game | Same-repo web app at repository root (React + Vite + TypeScript) |

No deep links, no native plugins, no Play Store listing in v1.

## Data model

- **No native persistence.** Cards, FSRS state, and bed unlocks remain in the WebView’s IndexedDB (Dexie) under the same schema as the matching web edition. Android application sandboxing isolates the two editions.
- Clearing app storage / uninstall wipes progress (same as clearing browser site data).
- Bundled `www/` is a build artifact of the root web game (not edited by hand).

## UI / UX

1. Cold start → splash theme → WebView loads bundled `index.html` → main menu. Its **Выход** action closes and removes the Android activity task through the internal `hanzi-garden://exit` command.
2. Orientation stays portrait for the lifetime of the activity, including when system auto-rotate is off and when the phone is tilted.
3. System back: if the WebView history stack has an entry, go back; otherwise finish the activity.
4. Landing page (`android/site/`): brand **Hanzi Garden**, short tagline, APK download link, update note.
5. WebView must honor the game’s `width=device-width` viewport at 100% scale (no overview zoom) so mobile battle layout matches Chrome on phones — writer canvas clipped, no stroke SVG bleed over chrome.

## Out of scope

- Native rewrite of map, battle, or FSRS logic
- Online multiplayer / cloud sync of progress
- Play Store / App Bundle distribution
- Loading the live GitHub Pages URL instead of bundled assets
- Remote download of map/battle art after install
- Push notifications, accounts, ads

## Acceptance criteria

1. `./scripts/sync-web-assets.sh` (from `android/`) produces non-empty full and HSK 1 `index.html` files with relative asset URLs and bundled WebP garden/battle art for all 15 biomes.
2. `./gradlew assembleFullRelease assembleHsk1Release` produces two sideload-signed APKs under 100 MB (signed with the committed `android/sideload.keystore`).
3. Installing the APK on API 34+ opens the welcome screen without a network connection.
4. Completing a battle persists card/bed state across process death (WebView IndexedDB).
5. Deploy workflow for this repository rebuilds the APK when the Android wrapper or the root web game changes.
6. Root `README.md` documents the web and Android Pages paths for this repo.
7. On a phone-sized WebView, battle chrome does not overlap a clipped circular writer; layout matches mobile web (no overview-scaled desktop CSS).
8. The garden map (including its negative layer) and all 60 biome battle backdrops load under bundled `file:///android_asset/` (`base: './'`) — the writing area stays visibly rendered through dirty, half-clean, quarter-clean, and clean states rather than becoming a blank dark void.
9. Battle quiz works offline: Hanzi stroke JSON loads via XHR (Fetch is blocked on `file://`), so drawing and «Показать следующий штрих» animate.
10. `scripts/sync-web-assets.sh` fails if the bundled `www/` tree exceeds 95 MB.
11. The launcher activity declares `android:screenOrientation="portrait"` so the APK stays upright regardless of phone tilt or the system auto-rotate toggle.
