# Memory Garden · Android

Thin Android (Kotlin) WebView wrapper around the **web game in this same repository** (repo root: React + Vite). The production web build (including WebP map/battle art for all 15 gardens) is bundled into `app/src/main/assets/www/` so the APK plays offline.

- **Requirements:** Android 14 or newer (min SDK 34), compile SDK 35.
- **Orientation:** sensor (portrait and landscape).
- **Upstream:** same V2 garden map, four-stage field-cleaning stroke battles, FSRS, and IndexedDB progress as the web app at the repo root.

See [SPEC.md](./SPEC.md) for requirements and acceptance criteria. Product design lives in the root [`GAME_SPEC.md`](../GAME_SPEC.md) / [`V2_SPEC.md`](../V2_SPEC.md).

## Local build

1. Install Bun and the Android SDK.
2. From `android/`, bundle the web game (repo root) into assets:

```bash
./scripts/sync-web-assets.sh
```

3. Assemble a release APK:

```bash
./gradlew assembleRelease
```

Release builds are signed with the committed **sideload keystore** (`sideload.keystore` + `sideload-signing.properties`) so every CI and local build uses the same key. New APKs install **over** the previous version.

APK output: `app/build/outputs/apk/release/app-release.apk`.

Optional: override signing via `rthagricultureandroid.signing*` entries in `local.properties`.

### Updating on your phone

1. Download the latest `rth-agriculture-android.apk` from this repo’s GitHub Pages `/android/` landing and install it over the existing app.
2. If Android refuses (e.g. you installed an older build signed with a different key), **uninstall once**, install the latest APK, then future updates install in place.

## CI and download

On push to `master`, `.github/workflows/deploy.yml` builds the web game from the repo root, syncs it into `android/` assets, builds the release APK, verifies sideload signing, and publishes:

- web game at `/` (Pages root for this repository);
- APK landing from `android/site/` at `/android/` with `rth-agriculture-android.apk`.

The APK is rebuilt when either the Android shell (`android/**`) or the web game (repo root sources / public assets) changes so bundled assets stay current.
