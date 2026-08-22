#!/usr/bin/env bash
# Build the Hanzi Garden web app (repo root) with relative base and copy into
# Android assets/www. Garden/battle art is shipped as WebP so all 15 biome
# backdrop sets fit under GitHub’s 100 MB APK push limit without remote
# downloads or art dedupe.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$(cd "$ROOT/.." && pwd)"
OUT="$ROOT/app/src/main/assets/www"

if [[ ! -f "$WEB/package.json" ]]; then
  echo "web game not found at $WEB (expected repo root next to android/)" >&2
  exit 1
fi

mkdir -p "$OUT"

cd "$WEB"
if [[ ! -d node_modules ]]; then
  echo "Installing web game dependencies…"
  bun install --frozen-lockfile
fi

echo "Building web game → $OUT"
# Unset Pages base so Vite emits relative URLs suitable for file:///android_asset/
env -u GH_PAGES_PUBLIC_PATH bunx tsc -b
env -u GH_PAGES_PUBLIC_PATH bunx vite build --outDir "$OUT" --emptyOutDir

required_assets=(
  "$OUT/index.html"
  "$OUT/assets/garden-map.webp"
  "$OUT/assets/garden-map_negative.webp"
)

# Four cleaning backdrops are bundled per biome.
for biome in {1..15}; do
  for stage in full_dirty half_dirty quorter_dirty clean; do
    required_assets+=("$OUT/assets/battle-biomes/biome${biome}/${stage}.webp")
  done
done

for asset in "${required_assets[@]}"; do
  if [[ ! -s "$asset" ]]; then
    echo "sync failed: missing or empty bundled asset $asset" >&2
    exit 1
  fi
done

# GitHub rejects single blobs over 100MB on push; fail fast before assembleRelease.
max_bytes=$((95 * 1024 * 1024))
www_bytes=0
while IFS= read -r -d '' asset; do
  asset_bytes="$(wc -c < "$asset")"
  www_bytes=$((www_bytes + asset_bytes))
done < <(find "$OUT" -type f -print0)
if (( www_bytes > max_bytes )); then
  echo "sync failed: bundled www is ${www_bytes} bytes (limit ${max_bytes}) — compress art further" >&2
  exit 1
fi

# Keep the assets directory trackable without committing the web build.
cat > "$OUT/.gitignore" <<'EOF'
# Bundled web build is produced by scripts/sync-web-assets.sh — do not commit.
*
!.gitkeep
!.gitignore
EOF
touch "$OUT/.gitkeep"

echo "Synced web assets ($(du -sh "$OUT" | awk '{print $1}'))"
