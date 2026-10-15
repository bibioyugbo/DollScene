#!/usr/bin/env bash
# Compress the Blender output into public/models/studio (meshopt geometry, WebP textures).
#   scripts/character/optimize.sh <build_out_dir>
set -euo pipefail
SRC="${1:?build output dir}"
LIVE="$(cd "$(dirname "$0")/../.." && pwd)/public/models/studio"
# built into a staging folder and swapped in at the end: the game never sees a half-written set,
# and a run that's stopped part-way leaves the live assets untouched
DST="$LIVE.next"
GT="npx --yes @gltf-transform/cli@4.5.1"

# morphs built on other morphs (the male chest, the straight back) need their normal deltas redone
python3 "$(dirname "$0")/fix_morph_normals.py" "$SRC"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$DST"' EXIT
rm -rf "$DST"
mkdir -p "$DST"/{hair,outfits,shoes,pieces,masks,eyes}

opt() {
  local in="$1" out="$2" size="$3" nsize="${4:-}"
  # (prune: drops data the post-build fixes replaced)
  $GT prune "$in" "$TMP/0.glb" >/dev/null
  $GT resize "$TMP/0.glb" "$TMP/1.glb" --width "$size" --height "$size" >/dev/null
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
for f in "$SRC"/outfits/*.glb; do opt "$f" "$DST/outfits/$(basename "$f")" 1024; done
# wardrobe pieces: graphics and prints painted in the body's UV layout keep 2048 colour maps (the
# slot masks must stay crisp); plain fabrics 1024; shoes 512
if [ -d "$SRC/pieces" ]; then
  for f in "$SRC"/pieces/*.glb; do
    case "$(basename "$f" .glb)" in
      shoes_*) opt "$f" "$DST/pieces/$(basename "$f")" 512 ;;
      top_crop_tank|top_baby_tee|top_oversized_tee|top_crop_tee|top_flame_tee|top_buba|top_peplum|dress_velvet_mini|dress_sequin_mini|dress_lace_bodysuit|top_lace_bralette|bottom_lace_briefs|top_mesh) opt "$f" "$DST/pieces/$(basename "$f")" 2048 512 ;;
      *) opt "$f" "$DST/pieces/$(basename "$f")" 1024 256 ;;
    esac
  done
fi
for f in "$SRC"/shoes/*.glb; do opt "$f" "$DST/shoes/$(basename "$f")" 512; done

cp "$SRC"/masks/*.png "$DST/masks/"
cp "$SRC"/eyes/*.png "$DST/eyes/"
cp "$SRC/character.json" "$DST/character.json"
rm -rf "$LIVE.old"
[ -d "$LIVE" ] && mv "$LIVE" "$LIVE.old"
mv "$DST" "$LIVE"
rm -rf "$LIVE.old"
du -sh "$LIVE"
