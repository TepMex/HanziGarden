#!/usr/bin/env bash
# Build both Hanzi Garden editions with relative URLs and bundle each one into
# its Android product flavor. Shared art remains offline in both APKs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$(cd "$ROOT/.." && pwd)"
FULL_OUT="$ROOT/app/src/main/assets/www"
HSK1_OUT="$ROOT/app/src/hsk1/assets/www"

if [[ ! -f "$WEB/package.json" ]]; then
  echo "web game not found at $WEB (expected repo root next to android/)" >&2
  exit 1
fi

cd "$WEB"
if [[ ! -d node_modules ]]; then
  echo "Installing web game dependencies…"
  bun install --frozen-lockfile
fi

# Compile once; Vite then emits the full and HSK 1 data-selected editions.
env -u GH_PAGES_PUBLIC_PATH bunx tsc -b

sync_variant() {
  local label="$1"
  local mode="$2"
  local out="$3"
  mkdir -p "$out"

  echo "Building $label web game → $out"
  if [[ -n "$mode" ]]; then
    env -u GH_PAGES_PUBLIC_PATH bunx vite build --mode "$mode" --outDir "$out" --emptyOutDir
  else
    env -u GH_PAGES_PUBLIC_PATH bunx vite build --outDir "$out" --emptyOutDir
  fi

  local required_assets=(
    "$out/index.html"
    "$out/assets/garden-map.webp"
    "$out/assets/garden-map_negative.webp"
  )

  for biome in {1..15}; do
    for stage in full_dirty half_dirty quorter_dirty clean; do
      required_assets+=("$out/assets/battle-biomes/biome${biome}/${stage}.webp")
    done
  done

  for asset in "${required_assets[@]}"; do
    if [[ ! -s "$asset" ]]; then
      echo "sync failed: missing or empty bundled asset $asset" >&2
      exit 1
    fi
  done

  # GitHub rejects single blobs over 100MB on push; fail fast before assembleRelease.
  local max_bytes=$((95 * 1024 * 1024))
  local www_bytes=0
  while IFS= read -r -d '' asset; do
    local asset_bytes
    asset_bytes="$(wc -c < "$asset")"
    www_bytes=$((www_bytes + asset_bytes))
  done < <(find "$out" -type f -print0)
  if (( www_bytes > max_bytes )); then
    echo "sync failed: $label bundled www is ${www_bytes} bytes (limit ${max_bytes}) — compress art further" >&2
    exit 1
  fi

  cat > "$out/.gitignore" <<'EOF'
# Bundled web build is produced by scripts/sync-web-assets.sh — do not commit.
*
!.gitkeep
!.gitignore
EOF
  touch "$out/.gitkeep"

  echo "Synced $label web assets ($(du -sh "$out" | awk '{print $1}'))"
}

sync_variant "Hanzi Garden" "" "$FULL_OUT"
sync_variant "Hanzi Garden HSK 1" "hsk1" "$HSK1_OUT"
