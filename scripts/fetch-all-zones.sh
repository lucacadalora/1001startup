#!/bin/bash
# Fetch every generated zone's OSM data sequentially (politeness to Overpass),
# then publish the ones that landed. Run: bash scripts/fetch-all-zones.sh
cd "$(dirname "$0")/.."
node -e '
const defs = require("./data/zones-def.json");
for (const z of defs) console.log([z.id, z.bb.s, z.bb.w, z.bb.n, z.bb.e].join(" "));
' | while read -r id s w n e; do
  if [ -s "public/data/zone-$id.json" ]; then echo "skip $id (exists)"; continue; fi
  echo "== $id"
  node scripts/fetch-zone.js "$id" "$s" "$w" "$n" "$e" || echo "FAILED $id"
  sleep 3
done
node scripts/publish-zones.js
