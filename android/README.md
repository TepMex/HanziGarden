# Hanzi Garden · Android

Thin Android (Kotlin) WebView wrapper around the **web game in this same repository** (repo root: React + Vite). Two product flavors bundle the full game and the HSK 1 demo so both APKs play offline and can be installed side by side.

- **Requirements:** Android 14 or newer (min SDK 34), compile SDK 35.
- **Orientation:** sensor (portrait and landscape).
- **Upstream:** same garden, 15 biomes, 220 beds, four-stage battles, FSRS, and IndexedDB progress as the web app at the repo root.

See [SPEC.md](./SPEC.md) for requirements and acceptance criteria. Product design lives in the root [`GAME_SPEC.md`](../GAME_SPEC.md) / [`V2_SPEC.md`](../V2_SPEC.md).

## Local build

1. Install Bun and the Android SDK.
2. From `android/`, bundle the web game (repo root) into assets:

```bash
./scripts/sync-web-assets.sh
```

3. Assemble both release APKs:

```bash
./gradlew assembleFullRelease assembleHsk1Release
```

Release builds are signed with the committed **sideload keystore** (`sideload.keystore` + `sideload-signing.properties`) so every CI and local build uses the same key. New APKs install **over** the corresponding previous edition. The HSK 1 flavor uses `com.tepmex.rthagriculture.hsk1`, so it installs alongside the primary `com.tepmex.rthagriculture` app.

APK outputs:

- `app/build/outputs/apk/full/release/app-full-release.apk`;
- `app/build/outputs/apk/hsk1/release/app-hsk1-release.apk`.

Optional: override signing via `rthagricultureandroid.signing*` entries in `local.properties`.

### Updating on your phone

1. Download the latest `hanzi-garden.apk` from the [Hanzi Garden Android page](https://tepmex.github.io/HanziGarden/android/) and install it over the existing app.
2. If Android refuses (e.g. you installed an older build signed with a different key), **uninstall once**, install the latest APK, then future updates install in place.

## CI and download

On push to `master`, `.github/workflows/deploy.yml` builds both web editions from the repo root, syncs them into `android/` assets, builds both release APKs, verifies sideload signing, and publishes:

- web game at `https://tepmex.github.io/HanziGarden/`;
- HSK 1 web game at `https://tepmex.github.io/HanziGarden/hsk1/`;
- APK landing at `https://tepmex.github.io/HanziGarden/android/` with `hanzi-garden.apk` and `hanzi-garden-hsk1.apk`.

The APK is rebuilt when either the Android shell (`android/**`) or the web game (repo root sources / public assets) changes so bundled assets stay current.
