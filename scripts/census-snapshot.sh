#!/usr/bin/env bash
# 1001 My 1001, dashboard slice 3 (Luca, 18 Oct 2026): keep a dated copy of what
# readers can follow, once a day, so a later "what changed on what you follow"
# widget has history to compare against. About 0.4 MB a day gzipped.
# Kept OUTSIDE the repo (~/projects/1001-snapshots/<UTC date>/) so git stays clean.
# Run by the systemd user timer census-snapshot-1001.timer (23:50 UTC daily).
set -euo pipefail
SRC=/home/ubuntu/projects/pasar-vantis
OUT=/home/ubuntu/projects/1001-snapshots/$(date -u +%F)
mkdir -p "$OUT"
for f in public/data/census.json data/bumn-56.json data/datacenter.json; do
  n=$(basename "$f")
  gzip -9 -c "$SRC/$f" > "$OUT/$n.gz.tmp"
  mv "$OUT/$n.gz.tmp" "$OUT/$n.gz"
done
echo "snapshot $(date -u +%FT%TZ) -> $OUT ($(du -sh "$OUT" | cut -f1))"
