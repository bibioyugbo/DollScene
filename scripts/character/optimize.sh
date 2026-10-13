#!/usr/bin/env bash
# Compress the Blender output into public/models/studio (meshopt geometry, WebP textures).
#   scripts/character/optimize.sh <build_out_dir>
set -euo pipefail
SRC="${1:?build output dir}"
DST="$(cd "$(dirname "$0")/../.." && pwd)/public/models/studio"
GT="npx --yes @gltf-transform/cli@4.5.1"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
rm -rf "$DST"
mkdir -p "$DST"/{hair,outfits,shoes,masks,eyes}

opt() {
  local in="$1" out="$2" size="$3" nsize="${4:-}"
  $GT resize "$in" "$TMP/1.glb" --width "$size" --height "$size" >/dev/null
  if [ -n "$nsize" ]; then
    # normal maps carry weave detail only: they don't need the colour map's resolution
    $GT resize "$TMP/1.glb" "$TMP/1n.glb" --width "$nsize" --height "$nsize" --pattern '*_n*' >/dev/null
    mv "$TMP/1n.glb" "$TMP/1.glb"
  fi
  $GT webp "$TMP/1.glb" "$TMP/2.glb" --quality 88 >/dev/null
  $GT meshopt "$TMP/2.glb" "$out" --level medium >/dev/null
  printf '%-48s %6.2f MB\n' "$(basename "$out")" "$(echo "$(stat -f%z "$out") / 1000000" | bc -l)"
}

opt "$SRC/body.glb" "$DST/body.glb" 2048
opt "$SRC/silhouette.glb" "$DST/silhouette.glb" 256
for f in "$SRC"/hair/*.glb; do opt "$f" "$DST/hair/$(basename "$f")" 1024; done
# store outfits carry prints painted in the body's UV layout: they keep 2048 textures
for f in "$SRC"/outfits/*.glb; do
  case "$(basename "$f")" in kai_*|mc_*|dbf_*|deeji_*|bola_*) opt "$f" "$DST/outfits/$(basename "$f")" 2048 512 ;; *) opt "$f" "$DST/outfits/$(basename "$f")" 1024 ;; esac
done
for f in "$SRC"/shoes/*.glb; do opt "$f" "$DST/shoes/$(basename "$f")" 512; done

cp "$SRC"/masks/*.png "$DST/masks/"
cp "$SRC"/eyes/*.png "$DST/eyes/"
cp "$SRC/character.json" "$DST/character.json"
du -sh "$DST"
