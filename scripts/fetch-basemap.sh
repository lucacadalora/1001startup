#!/usr/bin/env bash
# 1001startup.id /map — the basemap under the logos.
#
# An Indonesia extract of the Protomaps daily OpenStreetMap build (vector
# tiles in one PMTiles v3 archive), served by lib/map1001-routes.js at
# /tiles/<build>/{z}/{x}/{y}.mvt. Nothing is fetched from a map vendor at
# view time: the archive sits on this box like the rest of the site's data.
#
# ~450 MB at maxzoom 13 for the whole country (z13 is street level; the map
# overzooms past it, which is all a basemap under logos needs), so it lives in
# data/basemap/ and is gitignored. This script is how a checkout gets it.
#
#   scripts/fetch-basemap.sh             # newest daily build
#   scripts/fetch-basemap.sh 20261011    # one specific build
#
# Needs the pmtiles CLI (github.com/protomaps/go-pmtiles); PMTILES=/path
# overrides. Re-running for a build that is already on disk only re-verifies
# it and re-points data/basemap/current.json, which the server re-reads by
# mtime, so switching builds needs no restart.
set -euo pipefail
cd "$(dirname "$0")/.."

PMTILES=${PMTILES:-$(command -v pmtiles || echo "$HOME/tools/go-pmtiles/pmtiles")}
if [ ! -x "$PMTILES" ]; then
  echo "pmtiles CLI not found. Install it, e.g.:" >&2
  echo "  mkdir -p ~/tools/go-pmtiles && curl -sL https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz | tar xz -C ~/tools/go-pmtiles" >&2
  exit 1
fi

BUILD=${1:-$(curl -fsS https://build-metadata.protomaps.dev/builds.json \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)[-1]["key"].split(".")[0])')}
case "$BUILD" in (*[!0-9]*|'') echo "bad build id: $BUILD" >&2; exit 1;; esac
MAXZOOM=${MAXZOOM:-13}
BBOX=94.7,-11.2,141.2,6.3   # Sabang to Merauke, Miangas to Rote
DIR=data/basemap
OUT=$DIR/indonesia-$BUILD.pmtiles
mkdir -p "$DIR"

if [ ! -s "$OUT" ]; then
  "$PMTILES" extract "https://build.protomaps.com/$BUILD.pmtiles" "$OUT.part" \
    --bbox="$BBOX" --maxzoom="$MAXZOOM"
  mv "$OUT.part" "$OUT"
fi
"$PMTILES" verify "$OUT"

printf '{"build":"%s","file":"%s","maxzoom":%s}\n' "$BUILD" "$(basename "$OUT")" "$MAXZOOM" > "$DIR/current.json.tmp"
mv "$DIR/current.json.tmp" "$DIR/current.json"
echo "basemap: $OUT ($(du -h "$OUT" | cut -f1)), current.json -> build $BUILD"
ls "$DIR"/indonesia-*.pmtiles | grep -v "$BUILD" | sed 's/^/older build, safe to delete: /' || true
