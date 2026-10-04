#!/usr/bin/env python3
"""Build data/px-netlists.json: the address lists lib/px.js uses to tell people from machines.

  python3 scripts/px-netlists.py            # download what is older than a day, rebuild the file
  python3 scripts/px-netlists.py --offline  # rebuild from the cached downloads only

Two kinds of list, both merged into sorted, non-overlapping [start, end] ranges:

  dc        networks that belong to hosting and cloud companies (Amazon, Alibaba, Google Cloud, DigitalOcean, OVH...),
            from the public IP-to-ASN table at iptoasn.com, chosen by the network owner's name. A browser that comes
            from one of these is a server posing as a browser, not a reader. Cloudflare, Akamai and Fastly are left
            out on purpose: iCloud Private Relay and Cloudflare WARP send real people through them. Cloudflare
            Workers' own range (2a06:98c0::/29) is added back: that is code, not people.
  crawlers  the address lists AI and search operators publish for their crawlers (OpenAI, Google, Bing, Apple,
            Perplexity, Common Crawl). A request that names one of these crawlers from outside its list is an
            impostor. Operators that publish no list (Anthropic, Amazon, Meta...) stay "claimed".

v4 ranges are integers; v6 ranges are 32-digit hex strings (lib/px.js compares them as BigInt).
Downloads are cached in data/netlists/ and refreshed when older than a day; a failed download keeps the last copy.
"""
import gzip, ipaddress, json, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'data', 'netlists')
OUT = os.path.join(ROOT, 'data', 'px-netlists.json')
UA = 'Mozilla/5.0 (compatible; 1001startup-netlists/1.0; +https://1001startup.id/stats)'

SOURCES = {
    'ip2asn': 'https://iptoasn.com/data/ip2asn-combined.tsv.gz',
    'openai_search': 'https://openai.com/searchbot.json',
    'openai_user': 'https://openai.com/chatgpt-user.json',
    'openai_train': 'https://openai.com/gptbot.json',
    'google_bot': 'https://developers.google.com/static/search/apis/ipranges/googlebot.json',
    'google_special': 'https://developers.google.com/static/search/apis/ipranges/special-crawlers.json',
    'google_user': 'https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json',
    'google_user2': 'https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json',
    'bing': 'https://www.bing.com/toolbox/bingbot.json',
    'apple': 'https://search.developer.apple.com/applebot.json',
    'perplexity_bot': 'https://www.perplexity.com/perplexitybot.json',
    'perplexity_user': 'https://www.perplexity.com/perplexity-user.json',
    'ccbot': 'https://index.commoncrawl.org/ccbot.json',
}
# list name in the output -> the downloads it is made of
CRAWLER_LISTS = {
    'openai_search': ['openai_search'], 'openai_user': ['openai_user'], 'openai_train': ['openai_train'],
    'google': ['google_bot', 'google_special', 'google_user', 'google_user2'], 'bing': ['bing'], 'apple': ['apple'],
    'perplexity': ['perplexity_bot', 'perplexity_user'], 'ccbot': ['ccbot'],
}
HOSTING = re.compile(
    r'AMAZON|\bAWS\b|GOOGLE(?!.*FIBER)|MICROSOFT|ALIBABA|ALIYUN|TENCENT|HUAWEI|ORACLE|DIGITALOCEAN|\bOVH|HETZNER|LINODE|'
    r'VULTR|CHOOPA|CONTABO|LEASEWEB|\bM247|DATACAMP|CDN77|ZENLAYER|IONOS|SCALEWAY|ONLINE S\.A\.S|HOSTINGER|NETCUP|'
    r'PSYCHZ|QUADRANET|COLOCROSSING|COLOCATION|HIVELOCITY|BYTEDANCE|BAIDU|KINGSOFT|UCLOUD|G-?CORE|STARK INDUSTRIES|'
    r'PQ HOSTING|FRANTECH|PONYNET|ACCELERATED|TERASWITCH|WORLDSTREAM|SERVERS\.?COM|SERVERIUS|IPXO|HOSTROYALE|IP VOLUME|'
    r'EGIHOSTING|CLOUD ?INNOVATION|HOSTING|\bHOST\b|[A-Z]HOST\b|DATA ?CENT|DATACENTER|SERVERS?\b|\bVPS\b|DEDICATED|'
    r'CLOUD(?!FLARE)', re.I)
RELAY = re.compile(r'CLOUDFLARE|AKAMAI-AS|AKAMAI-ASN|FASTLY', re.I)   # iCloud Private Relay / WARP: people
WORKERS = ['2a06:98c0::/29']                                         # Cloudflare Workers: code


def fetch(name, url, offline):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, os.path.basename(url) if name == 'ip2asn' else name + '.json')
    fresh = os.path.exists(path) and time.time() - os.path.getmtime(path) < 86400
    if not offline and not fresh:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            tmp = path + '.tmp'
            with open(tmp, 'wb') as f:
                f.write(data)
            os.replace(tmp, path)
        except Exception as e:
            print(f'  ! {name}: download failed ({e}); keeping the cached copy', file=sys.stderr)
    return path if os.path.exists(path) else None


def merge(ranges):
    out = []
    for a, b in sorted(ranges):
        if out and a <= out[-1][1] + 1:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def pack(nets):
    v4, v6 = [], []
    for n in nets:
        (v4 if n.version == 4 else v6).append((int(n.network_address), int(n.broadcast_address)))
    return {'v4': merge(v4), 'v6': [[f'{a:032x}', f'{b:032x}'] for a, b in merge(v6)]}


def main():
    offline = '--offline' in sys.argv
    paths = {k: fetch(k, u, offline) for k, u in SOURCES.items()}
    if not paths['ip2asn']:
        sys.exit('no ip2asn table: cannot build the hosting list')
    dc4, dc6, owners = [], [], {}
    with gzip.open(paths['ip2asn'], 'rt', errors='replace') as fh:
        for line in fh:
            parts = line.rstrip('\n').split('\t', 4)
            if len(parts) < 5 or parts[2] == '0':
                continue
            desc = parts[4]
            if not HOSTING.search(desc) or RELAY.search(desc):
                continue
            try:
                a, b = ipaddress.ip_address(parts[0]), ipaddress.ip_address(parts[1])
            except ValueError:
                continue
            (dc4 if a.version == 4 else dc6).append((int(a), int(b)))
            owners[desc.split(' ')[0]] = owners.get(desc.split(' ')[0], 0) + 1
    for w in WORKERS:
        n = ipaddress.ip_network(w)
        dc6.append((int(n.network_address), int(n.broadcast_address)))
    dc = {'v4': merge(dc4), 'v6': [[f'{a:032x}', f'{b:032x}'] for a, b in merge(dc6)]}
    crawlers = {}
    for name, parts in CRAWLER_LISTS.items():
        nets = []
        for p in parts:
            if not paths.get(p):
                continue
            try:
                d = json.load(open(paths[p]))
            except Exception:
                continue
            for pr in d.get('prefixes', []):
                v = pr.get('ipv4Prefix') or pr.get('ipv6Prefix')
                if v:
                    try:
                        nets.append(ipaddress.ip_network(v, strict=False))
                    except ValueError:
                        pass
        if nets:
            crawlers[name] = pack(nets)
    out = {'built': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'dc': dc, 'crawlers': crawlers}
    tmp = OUT + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    os.replace(tmp, OUT)
    print(f"px-netlists: dc v4 {len(dc['v4'])} ranges, v6 {len(dc['v6'])}; crawler lists "
          + ', '.join(f"{k} {len(v['v4'])}+{len(v['v6'])}" for k, v in crawlers.items())
          + f"; {os.path.getsize(OUT) // 1024} KB")


if __name__ == '__main__':
    main()
