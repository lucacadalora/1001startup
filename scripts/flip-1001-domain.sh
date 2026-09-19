#!/usr/bin/env bash
# Flip the census product from 1001.vantis.sh to 1001startup.id.
#
# Run this ONLY after 1001startup.id has a proxied A record -> 43.157.195.23 in
# Cloudflare. It refuses to run otherwise: flipping first would 301 every visitor
# onto a parked domain, i.e. take the site down.
#
# After the flip: 1001.vantis.sh keeps answering and 301s every path to the new
# domain, so old links, QR codes and share cards still land.
set -euo pipefail

APP=/home/ubuntu/projects/pasar-vantis
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
STAMP=$(date +%Y%m%d-%H%M%S)

echo "== preflight: is 1001startup.id serving the census app through Cloudflare? =="
BODY=$(curl -s --max-time 20 -A "$UA" https://1001startup.id/ || true)
if ! grep -q "Indonesia's startup graph" <<<"$BODY"; then
  echo "ABORT: https://1001startup.id/ is not serving the census app yet."
  echo "       Point the Cloudflare A record for 1001startup.id (and www) at"
  echo "       43.157.195.23, proxied, SSL mode Full, then re-run."
  exit 1
fi
echo "ok — new domain is live"

echo "== nginx: 1001.vantis.sh -> forwarder =="
# sites-enabled/1001.vantis.sh is a real FILE, not a symlink — back up the live
# copy, not just the sites-available one, or the rollback restores stale config.
sudo cp -a /etc/nginx/sites-enabled/1001.vantis.sh "/etc/nginx/sites-available/1001.vantis.sh.bak-$STAMP"
sudo cp -a /etc/nginx/sites-enabled/1001.vantis.sh /etc/nginx/sites-available/1001.vantis.sh
# COPY, never symlink: a symlinked sites-enabled means any later "cp backup
# over it" follows the link and clobbers the forwarder file (happened Aug 30).
sudo rm -f /etc/nginx/sites-enabled/1001.vantis.sh
sudo cp -a /etc/nginx/sites-available/1001.vantis.sh.forward /etc/nginx/sites-enabled/1001.vantis.sh
sudo nginx -t
sudo systemctl reload nginx

echo "== app: repoint the cross-links that name the old host =="
cp -a "$APP/server.js" "$APP/server.js.bak-domain-$STAMP"
cp -a "$APP/views/pages.js" "$APP/views/pages.js.bak-domain-$STAMP"
sed -i 's#https://1001\.vantis\.sh/map#https://1001startup.id/map#g' "$APP/server.js" "$APP/views/pages.js"
sudo systemctl restart pasar-vantis
sleep 3

echo "== verify =="
printf 'old / -> %s\n' "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 https://1001.vantis.sh/)"
printf 'old /company/xendit -> %s\n' "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 https://1001.vantis.sh/company/xendit)"
printf 'new / -> %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -A "$UA" https://1001startup.id/)"
printf 'new /map -> %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -A "$UA" https://1001startup.id/map)"
echo "done. Rollback: sudo rm /etc/nginx/sites-enabled/1001.vantis.sh && sudo cp /etc/nginx/sites-available/1001.vantis.sh.bak-$STAMP /etc/nginx/sites-enabled/1001.vantis.sh && sudo systemctl reload nginx"
