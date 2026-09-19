#!/bin/bash
# THE WIRE refresh — twice daily via crontab (06:40 & 16:40 WIB).
# flock prevents overlap with a still-running previous sweep; the server
# mtime-caches public/data/census-news.json so a publish needs NO restart.
set -u
cd /home/ubuntu/projects/pasar-vantis
exec 9>/tmp/census-news.lock
flock -n 9 || { echo "$(date -Is) already running, skipped"; exit 0; }
echo "== $(date -Is) wire refresh =="
python3 -u scripts/census-news.py run --days 3 --top 80
