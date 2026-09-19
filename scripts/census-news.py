#!/usr/bin/env python3
"""
census-news.py — the automated wire behind https://1001.vantis.sh/news

Discovers Indonesian startup news (Exa, credible-outlet allowlist), matches it
against the census, clusters same-story coverage, and writes a 2-sentence brief
PER STORY in our own words (fleet LLM, DEEP lane) with census context injected.
Publishes to public/data/census-news.json (single-writer: ONLY this script may
write it — same discipline as census-sprites.json).

Legal architecture (the whole point — see the Aug 30 2026 session):
  - UU 28/2014 Pasal 43(c): reuse of *berita aktual* is non-infringing WITH full
    source attribution → every item names and links every outlet it drew from.
  - Briefs are our own expression: an 8-word shingle guard rejects any brief
    that shares a verbatim run with a source text.
  - PAYWALLED outlets (Bloomberg, DealStreetAsia, Nikkei, TIA) are never
    summarized from their body text — headline+link only, or corroboration.
  - og:image URLs are STORED (news_img) but never displayed: press photos are
    separate copyrighted works outside the Pasal 43(c) news carve-out. Art on
    the page = census sprites/logos (ours). Flipping og images on = Luca's call.

usage:
  python3 scripts/census-news.py run [--days 7] [--top 60] [--all] [--dry]
  python3 scripts/census-news.py rebuild        # re-publish from state, no fetch

State: data/census-news-state.json (seen URLs, clusters, briefs, headcount
snapshots). Idempotent: re-runs skip seen URLs and already-briefed clusters.
Cost: lanes ~$0.06 + ~$0.007/company probed + ~$0.001/summary; a --top 60 run
is ~$0.60 of Exa and pennies of LLM.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timedelta, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CENSUS = os.path.join(ROOT, 'public', 'data', 'census.json')
STATE = os.path.join(ROOT, 'data', 'census-news-state.json')
OUT = os.path.join(ROOT, 'public', 'data', 'census-news.json')
SPRITES = os.path.join(ROOT, 'data', 'census-sprites.json')

WIB = timezone(timedelta(hours=7))

# ---------------------------------------------------------------- outlets ----
ID_OUTLETS = [
    'katadata.co.id', 'dailysocial.id', 'kontan.co.id', 'bisnis.com',
    'cnbcindonesia.com', 'kompas.com', 'kompas.id', 'tempo.co',
    'thejakartapost.com', 'jakartaglobe.id', 'antaranews.com', 'kumparan.com',
    'detik.com', 'liputan6.com', 'idntimes.com', 'teknologi.id',
    'investor.id', 'marketeers.com',
]
INTL_OUTLETS = [
    'techinasia.com', 'e27.co', 'dealstreetasia.com', 'kr-asia.com',
    'techcrunch.com', 'bloomberg.com', 'reuters.com', 'asia.nikkei.com',
    'nikkei.com', 'forbes.com', 'theinformation.com', 'crunchbase.com',
]
OUTLETS = ID_OUTLETS + INTL_OUTLETS
# Never summarize from these outlets' body text (paywalled / metered): their
# items may corroborate a cluster and be linked, but a cluster whose ONLY
# sources are paywalled publishes as headline+link with no brief.
PAYWALLED = {'bloomberg.com', 'dealstreetasia.com', 'asia.nikkei.com',
             'nikkei.com', 'theinformation.com', 'techinasia.com'}

LANES = [
    ('funding', 'Indonesian startup funding round investment announcement'),
    ('funding', 'startup Indonesia pendanaan investasi putaran'),
    ('people', 'Indonesia startup appoints new CEO CTO chief executive resigns'),
    ('people', 'startup Indonesia PHK layoff karyawan'),
    ('ma', 'Indonesia startup acquisition merger acquires akuisisi'),
    ('ipo', 'Indonesia technology company IPO IDX stock exchange listing'),
    ('regulatory', 'Indonesia fintech startup OJK Bank Indonesia license regulation'),
    ('product', 'Indonesia startup launches new product expansion service'),
    ('market', 'Indonesia startup ecosystem venture capital fund report'),
]

TYPE_WORDS = {
    'funding': r'\b(raise[sd]?|raising|funding|investment|invest(?:s|ed)?|series [a-e]|seed|pre-seed|pendanaan|investasi|suntikan|modal ventura|round|valuation)\b',
    'people': r'\b(appoint(?:s|ed)?|joins?|named|resign(?:s|ed)?|steps? down|layoff[s]?|lay off|PHK|karyawan|CEO|CTO|CFO|chief|president director|direktur utama|hires?|headcount)\b',
    'ma': r'\b(acquir(?:es?|ed|ing)|acquisition|merger|merges?|akuisisi|caplok|buyout|takes? over|stake)\b',
    'ipo': r'\b(IPO|initial public offering|listing|lists on|IDX|bursa|saham perdana|go(?:es)? public)\b',
    'regulatory': r'\b(OJK|Bank Indonesia|Komdigi|Kominfo|regulat(?:or|ion|ory)|licen[cs]e|izin|sanksi|fine[sd]?|banned|blokir)\b',
    'product': r'\b(launch(?:es|ed)?|luncurkan|rilis|unveil(?:s|ed)?|rolls? out|expands?|ekspansi|partnership|kemitraan|integrat(?:es|ion))\b',
}
TYPE_ORDER = ['funding', 'ma', 'ipo', 'regulatory', 'people', 'product', 'market']

# Names that are common words / too short — require an exact-case token hit.
# 'dana' is Indonesian for "funds": every funding story contains it.
CASE_STRICT = {'DANA', 'OVO', 'Astro', 'Fore', 'Jack', 'Amar', 'Blitz', 'BANYU',
               'Halo AI', 'Aruna', 'Sirka', 'Privy', 'VIDA', 'Brick', 'Stockbit',
               'Grab', 'Gently', 'Surplus', 'Duitin', 'Whiz', 'PINA', 'Finku'}

UA = 'Mozilla/5.0 (X11; Linux x86_64) census-news/1.0 (+https://1001.vantis.sh)'


def now_iso():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def jload(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def jdump(path, obj):
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def host_of(url):
    h = re.sub(r'^https?://', '', url).split('/')[0].lower()
    return re.sub(r'^(www|m|amp)\.', '', h)


def outlet_of(url):
    h = host_of(url)
    for o in OUTLETS:
        if h == o or h.endswith('.' + o):
            return o
    return h


# ------------------------------------------------------------------- exa -----
def exa_key():
    env = os.path.expanduser('~/.openclaw/secrets/exa.env')
    with open(env) as f:
        for line in f:
            if line.startswith('EXA_API_KEY='):
                return line.split('=', 1)[1].strip()
    raise SystemExit('EXA_API_KEY not found')


def exa_search(key, query, days, n=10, domains=None):
    body = {
        'query': query, 'category': 'news', 'numResults': n,
        'startPublishedDate': (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%dT00:00:00.000Z'),
        'contents': {'text': {'maxCharacters': 2600}},
    }
    if domains:
        body['includeDomains'] = domains
    r = requests.post('https://api.exa.ai/search', timeout=60,
                      headers={'x-api-key': key, 'Content-Type': 'application/json'},
                      json=body)
    r.raise_for_status()
    d = r.json()
    return d.get('results', []), (d.get('costDollars', {}) or {}).get('total', 0)


# ------------------------------------------------------------------- llm -----
def llm_cfg():
    cfg = {}
    with open(os.path.expanduser('~/.openclaw/secrets/llm.env')) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                cfg[k] = v
    return cfg


def llm_json(cfg, system, user, retries=2):
    for attempt in range(retries + 1):
        try:
            r = requests.post(cfg['LLM_BASE_URL'].rstrip('/') + '/chat/completions', timeout=120,
                              headers={'Authorization': 'Bearer ' + cfg['LLM_API_KEY'],
                                       'Content-Type': 'application/json'},
                              json={'model': cfg['LLM_MODEL_DEEP'],
                                    'messages': [{'role': 'system', 'content': system},
                                                 {'role': 'user', 'content': user}],
                                    'temperature': 0.3, 'max_tokens': 700})
            r.raise_for_status()
            txt = r.json()['choices'][0]['message']['content'].strip()
            txt = re.sub(r'^```(?:json)?\s*|\s*```$', '', txt, flags=re.S)
            m = re.search(r'\{.*\}', txt, re.S)
            return json.loads(m.group(0) if m else txt)
        except Exception as e:
            if attempt == retries:
                print(f'    LLM failed after {retries+1} tries: {e}', file=sys.stderr)
                return None
            time.sleep(3)


# ------------------------------------------------------- entity matching -----
def norm(s):
    return unicodedata.normalize('NFKD', s or '').lower()


def name_variants(c):
    """Matchable name tokens for a census row. 'Kecilin (AssistX Enterprise)'
    matches on either part; ' Indonesia' suffixes are NOT stripped (Grab
    Indonesia must not fire on global-Grab stories)."""
    out = []
    name = c.get('name') or ''
    parts = [name]
    m = re.match(r'^(.*?)\s*\((.*?)\)\s*$', name)
    if m:
        parts = [m.group(1).strip(), m.group(2).strip()]
    for p in parts:
        if len(p) >= 3:
            out.append(p)
    return out


def find_companies(companies, title, text, outlet=''):
    """Census ids mentioned. Title hit = strong; body needs 2+ hits.
    A census company that OWNS the outlet (Kumparan on kumparan.com, Katadata,
    IDN Media on idntimes.com) never matches its own boilerplate — the test run
    filed an IFT fiber story under 'kumparan' that way. If such a company makes
    real news, another outlet will carry it."""
    hits = []
    tl, xl = norm(title), norm(text)
    odom = re.sub(r'[^a-z0-9]', '', outlet or '')
    for c in companies:
        if odom and any(re.sub(r'[^a-z0-9]', '', norm(v)) in odom
                        for v in name_variants(c) if len(v) >= 3):
            continue
        matched = strong = False
        for v in name_variants(c):
            strict = v in CASE_STRICT or len(v) <= 4
            pat = re.compile(r'(?<![\w.])' + re.escape(v) + r'(?![\w])',
                             0 if strict else re.I)
            in_title = bool(pat.search(title)) if strict else bool(pat.search(tl))
            body_n = len(pat.findall(text)) if strict else len(pat.findall(xl))
            if in_title:
                matched = strong = True
                break
            if body_n >= 2:
                matched = True
        if matched:
            hits.append((c['id'], strong))
    hits.sort(key=lambda h: (not h[1]))
    return [h[0] for h in hits], [h[0] for h in hits if h[1]]


def classify(title, text, lane_hint):
    t = (title or '') + ' ' + (text or '')[:1200]
    for ty in TYPE_ORDER:
        if ty in TYPE_WORDS and re.search(TYPE_WORDS[ty], t, re.I):
            return ty
    return lane_hint or 'market'


# -------------------------------------------------------------- clustering ---
def slugify(s):
    s = re.sub(r'[^a-z0-9]+', '-', norm(s)).strip('-')
    return s[:48] or 'story'


def topic_slug(title):
    words = [w for w in re.findall(r'[A-Za-z]{4,}', title or '')
             if w.lower() not in ('indonesia', 'indonesian', 'startup', 'startups',
                                  'jakarta', 'company', 'tech', 'technology', 'juta',
                                  'triliun', 'miliar', 'billion', 'million', 'funding',
                                  'raises', 'raised', 'this', 'that', 'with', 'from',
                                  'after', 'says', 'said')]
    return '-'.join(sorted(set(w.lower() for w in words[:6]))[:4]) or slugify(title)


def cluster_hits(state, hits):
    """Assign each hit to a cluster keyed on (entity|topic, type); a cluster
    accepts a hit within 5 days of its latest date. Primary-source hits (from
    a company's own site) cluster under a pr- prefix so they never pollute an
    outlet cluster — the LLM dedup pass folds them together when both exist."""
    clusters = state.setdefault('clusters', {})
    for h in hits:
        if h.get('primary'):
            ent = 'pr-' + h['companies'][0]
        else:
            ent = h['companies'][0] if h['companies'] else 'eco-' + topic_slug(h['title'])
        base = f"{ent}|{h['type']}"
        hsig = title_sig({'articles': [{'title': h['title']}]})
        chosen = None
        for k, cl in clusters.items():
            if not k.startswith(base + '|'):
                continue
            try:
                latest = max(a['date'] for a in cl['articles'])
            except ValueError:
                continue
            if abs((datetime.fromisoformat(h['date'][:10]) -
                    datetime.fromisoformat(latest[:10])).days) > 5:
                continue
            # SAME STORY, not just same company+type+week: two different
            # Stockbit product stories fused once, and the item's brief was
            # written from one article while the other outlets' links hung off
            # it — attribution pointing at the wrong reporting (Luca: "fatal").
            # Require shared title tokens; the brief model re-checks later.
            if len(hsig & title_sig(cl)) >= 2:
                chosen = cl
                break
        if chosen is None:
            k = f"{base}|{h['date'][:10]}"
            n = 2
            while k in clusters:  # same day, DIFFERENT story: sibling cluster
                k = f"{base}|{h['date'][:10]}~{n}"
                n += 1
            chosen = clusters[k] = {'key': k, 'articles': [], 'companies': [],
                                    'type': h['type'], 'primary': bool(h.get('primary'))}
        if all(a['url'] != h['url'] for a in chosen['articles']):
            chosen['articles'].append({k2: h[k2] for k2 in
                                       ('url', 'title', 'date', 'outlet', 'text', 'image', 'author')})
        for cid in h['companies']:
            if cid not in chosen['companies']:
                chosen['companies'].append(cid)


ID_STOP = set(('dari hingga untuk dengan yang dan ini itu di ke pada akan telah bisa jadi kini resmi baru '
               'tahun juta miliar triliun rupiah indonesia indonesian startup startups jakarta company tech '
               'technology digital bisnis usaha perusahaan aplikasi layanan launches launch luncurkan '
               'raises raised funding says said').split())


def title_sig(cl):
    toks = set()
    for a in cl['articles']:
        for w in re.findall(r'[a-z0-9]{3,}', norm(a['title'])):
            if w not in ID_STOP and not w.isdigit():
                toks.add(w)
    return toks


def merge_clusters(state):
    """The test run split one story (IFT's RAIA Grid) into three clusters with
    three briefs — different outlets, different headline wording, different
    type guesses. Merge clusters that share >=3 rare title tokens within a
    5-day window; the LLM dedup pass later catches cross-language leftovers."""
    clusters = state.get('clusters', {})
    keys = sorted(clusters.keys())
    sigs = {k: title_sig(clusters[k]) for k in keys}
    latest = {k: max((a['date'] for a in clusters[k]['articles']), default='') for k in keys}
    parent = {k: k for k in keys}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    # Merge is deliberately NARROW: same primary entity (one company's story
    # under two type guesses), or two eco- clusters. The first version allowed
    # any company overlap — roundup articles that mention ten census companies
    # bridged unrelated stories, and union-find chained 57 articles across 22
    # companies into one cluster whose brief was about none of them.
    def primary(k):
        return k.split('|', 1)[0]

    MAX_ARTICLES = 12
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            if find(a) == find(b):
                continue
            pa, pb = primary(a), primary(b)
            same_entity = pa == pb
            both_eco = pa.startswith('eco-') and pb.startswith('eco-')
            if not (same_entity or both_eco):
                continue
            if len(clusters[find(a)]['articles']) + len(clusters[b]['articles']) > MAX_ARTICLES:
                continue
            if not latest[a] or not latest[b]:
                continue
            if abs((datetime.fromisoformat(latest[a][:10]) -
                    datetime.fromisoformat(latest[b][:10])).days) > 5:
                continue
            if len(sigs[a] & sigs[b]) >= 3:
                parent[find(b)] = find(a)

    merged = 0
    for k in keys:
        r = find(k)
        if r == k:
            continue
        win, cl = clusters[r], clusters[k]
        for art in cl['articles']:
            if all(x['url'] != art['url'] for x in win['articles']):
                win['articles'].append(art)
        for cid in cl['companies']:
            if cid not in win['companies']:
                win['companies'].append(cid)
        titles = ' '.join(a['title'] for a in win['articles'])
        win['type'] = classify(titles, '', win['type'])
        state.get('briefs', {}).pop(k, None)
        del clusters[k]
        merged += 1
    if merged:
        print(f"  merged {merged} duplicate clusters")


def llm_dedup(cfg, state):
    """One cheap call over publishable headlines to catch same-story pairs the
    token merge cannot see (English + Indonesian coverage of one event). The
    result is stored, and publish() folds absorbed items' sources into the
    winner so attribution is never lost."""
    briefs = state.get('briefs', {})
    cands = []
    for k, cl in state.get('clusters', {}).items():
        b = briefs.get(k)
        if b and not b.get('headline_only') and not b.get('flag_verbatim') and b.get('confidence') != 'low':
            cands.append({'key': k, 'headline': b['headline'],
                          'date': max((a['date'] for a in cl['articles']), default='')[:10]})
    state['dup'] = {}
    if len(cands) < 2:
        return
    out = llm_json(cfg,
                   'You deduplicate a news wire. Group items that report the SAME underlying event '
                   '(one announcement, possibly covered in different languages). Different events about '
                   'the same company are NOT duplicates. Output strict JSON only: '
                   '{"groups": [["key1","key2"], ...]} — only groups of 2 or more true duplicates; '
                   'output {"groups": []} if there are none.',
                   json.dumps(cands, ensure_ascii=False))
    for g in (out or {}).get('groups', []):
        valid = [k for k in g if isinstance(k, str) and k in state.get('clusters', {})]
        if len(valid) >= 2:
            valid.sort(key=lambda k: -len(state['clusters'][k]['articles']))
            for a in valid[1:]:
                state['dup'][a] = valid[0]
    if state['dup']:
        print(f"  llm dedup folded {len(state['dup'])} duplicate items")


# ------------------------------------------------------------------ briefs ---
STYLE = """You write news briefs for 1001startup.id, the census of Indonesian startups. House style: Bloomberg-terse, factual, zero hype, bullet points.

Rules — all mandatory:
- HEADLINE: <=78 chars, active voice, own words, present tense, includes the number if there is one (US$270M style). Never copy a source headline.
- POINTS: 2 or 3 bullet points. Each is ONE standalone fact, <=20 words, no lead-in phrase. Point 1 = what happened: who, what, how much, from whom. Point 2 = what it is for, or the most consequential detail. Point 3 (only if it earns its place) = one more hard fact. Numbers with currency. No adjectives of praise. Nothing not stated in the sources.
- If only one outlet reports a contested/unconfirmed figure, attribute it ("according to <outlet>"). If sources disagree on a number, give both with outlets.
- CONTEXT: one sentence (<=30 words) connecting the story to the census record provided (rank, prior funding, headcount, sector, cohort tags). Use ONLY provided fields. Empty string if nothing adds value.
- NEVER reuse any run of 8+ consecutive words from any source text.
- THE ARTICLES MAY MIX DIFFERENT STORIES. Decide the MAIN story (the one most articles, or the most recent article, reports). Write the headline and points about the main story ONLY. Output "same_story": the "i" values of every article (title-only ones included) that reports the main story — judge titles across English and Indonesian. An article about a different event, even about the same company, is NOT in same_story.
- Output STRICT JSON only: {"headline": "...", "points": ["...", "..."], "context": "...", "type": "funding|people|ma|ipo|regulatory|product|market", "companies": [...], "same_story": [0, ...], "confidence": "high|low"}
- "companies": subset of the candidate census ids actually central to the story. "confidence": "low" if sources are thin, contradictory, or the story is only tangentially about Indonesia.
- If primary_source is true, the material is the company's OWN announcement: attribute every claim to the company ("X says", "according to X"), never present it as independently confirmed, and set confidence "low" if it is marketing fluff with no concrete fact (no number, date, name, or product)."""


# ------------------------------------------------------- bahasa indonesia ---
# The wire is bilingual (EN at /news, Bahasa Indonesia at /id/news). The
# Indonesian text of every brief lives IN STATE (hl_id / pts_id / cx_id on the
# brief dict) so `rebuild` republishes it without an LLM; the view falls back
# to English wherever a field is missing. `link` items are never translated —
# their headline is the outlet's own, quoted verbatim by design.
STYLE_ID = """You are the Indonesian copy editor of 1001startup.id, the census of Indonesian startups. Translate a news brief from English into natural Bahasa Indonesia in the register of Indonesian tech/business media (Katadata, Kontan, DailySocial): terse, factual, active voice, zero hype.

Rules — all mandatory:
- Translate the MEANING, never word-for-word; reorder sentences freely so they read as written-in-Indonesian.
- hl: <=78 chars, present tense, active. Keep any number exactly as written (US$270M, Rp105.14T styles unchanged — do not reformat digits). Where a unit is a WORD, write it in Indonesian: miliar not billion, juta not million, triliun not trillion.
- pts: same number of bullets as given, each ONE standalone fact, <=22 words.
- Keep as-is: company/product/person names, currency amounts, dates, ticker/batch codes, terms Indonesian tech media keeps in English (startup, marketplace, fintech, e-commerce, seed, Series A/B).
- Attributed claims stay attributed ("kata X", "menurut X").
- cx: one sentence connecting to the census record; translate it too (rank -> peringkat, headcount -> jumlah pekerja, sector -> sektor). Empty stays empty.
- Output STRICT JSON only: {"hl": "...", "pts": ["...", "..."], "cx": "..."}"""


def translate_brief(cfg, hl, pts, cx):
    out = llm_json(cfg, STYLE_ID, json.dumps(
        {'headline': hl, 'points': pts, 'context': cx or ''}, ensure_ascii=False))
    if not out or not out.get('hl') or not isinstance(out.get('pts'), list):
        return None
    if len(out['pts']) != len(pts):  # a dropped bullet is a dropped fact
        return None
    return {'hl_id': out['hl'].strip(),
            'pts_id': [str(p).strip() for p in out['pts']],
            'cx_id': (out.get('cx') or '').strip()}


_SIG_HL = re.compile(r'^(?P<name>.+) headcount (?P<verb>grows|shrinks) to (?P<n>[\d,]+) \((?P<d>[+\-−][\d,]+) since (?P<since>.+)\)$')
_SIG_P1 = re.compile(r'^Tracked headcount moved from (?P<a>[\d,]+) \(read (?P<d1>[\d-]+)\) to (?P<b>[\d,]+) \(read (?P<d2>[\d-]+)\) — (?P<pct>\d+)% (?P<dir>up|down)\.$')
SIG_P2_ID = 'Angka mengikuti tangga sumber jumlah pekerja sensus; sumber dan tanggal pembacaannya ada di halaman perusahaan.'


def signal_id(s):
    """Headcount signals are template-written, so their Indonesian is template-
    written too — no LLM near a derived number."""
    m = _SIG_HL.match(s.get('headline') or '')
    if not m:
        return None
    hl = (f"Jumlah pekerja {m.group('name')} {'naik' if m.group('verb') == 'grows' else 'turun'} "
          f"menjadi {m.group('n')} ({m.group('d')} sejak {m.group('since')})")
    pts = []
    for p in s.get('points') or []:
        m1 = _SIG_P1.match(p)
        if m1:
            pts.append(f"Jumlah pekerja terpantau bergerak dari {m1.group('a')} (dibaca {m1.group('d1')}) "
                       f"ke {m1.group('b')} (dibaca {m1.group('d2')}) — "
                       f"{'naik' if m1.group('dir') == 'up' else 'turun'} {m1.group('pct')}%.")
        elif p.startswith('Counts follow the census headcount ladder'):
            pts.append(SIG_P2_ID)
        else:
            return None  # an unrecognized template line means the format moved — fail loud, keep EN
    return {'hl_id': hl, 'pts_id': pts}


def translate_state(cfg, state, verbose=True):
    """Fill hl_id/pts_id/cx_id on every publishable brief and signal that lacks
    them. Idempotent; safe to re-run; skips held/link-only briefs."""
    done = fail = 0
    for k, b in (state.get('briefs') or {}).items():
        if b.get('headline_only') or b.get('flag_verbatim') or b.get('confidence') == 'low':
            continue
        if not b.get('headline') or b.get('hl_id'):
            continue
        tr = translate_brief(cfg, b['headline'], b.get('points') or [], b.get('context') or '')
        if tr:
            b.update(tr)
            done += 1
            if verbose:
                print(f"  [id] {tr['hl_id'][:80]}")
        else:
            fail += 1
            if verbose:
                print(f"  [id-FAILED] {b['headline'][:70]}", file=sys.stderr)
        time.sleep(0.4)
    for s in state.get('signals') or []:
        if s.get('hl_id'):
            continue
        tr = signal_id(s)
        if tr:
            s.update(tr)
            done += 1
    if verbose:
        print(f"translate: {done} items gained Indonesian, {fail} failed (kept English)")
    return done


def shingle_overlap(brief, texts, n=8):
    words = re.findall(r'\w+', norm(brief))
    if len(words) < n:
        return False
    shingles = {' '.join(words[i:i + n]) for i in range(len(words) - n + 1)}
    for t in texts:
        tw = re.findall(r'\w+', norm(t))
        ts = {' '.join(tw[i:i + n]) for i in range(max(0, len(tw) - n + 1))}
        if shingles & ts:
            return True
    return False


def census_context(c):
    if not c:
        return None
    return {k: c.get(k) for k in ('id', 'name', 'rank', 'sector_label', 'funding_total_usd_m',
                                  'last_round', 'last_round_year', 'employees_est', 'employees_asof',
                                  'val_usd_m', 'valuation_usd_m', 'yc_batch', 'endeavor', 'kota')
            if c.get(k) is not None}


def brief_cluster(cfg, cl, by_id):
    arts = sorted(cl['articles'], key=lambda a: a['date'], reverse=True)[:6]
    usable = [a for a in arts if a['outlet'] not in PAYWALLED and (a.get('text') or '').strip()]
    if not usable:
        return {'headline_only': True}
    # ONE indexed list — the model judges, per article, whether it reports the
    # same story, and only confirmed articles may appear as the item's sources.
    entries = []
    with_text = 0
    for i, a in enumerate(arts):
        e = {'i': i, 'outlet': a['outlet'], 'date': a['date'][:10], 'title': a['title']}
        if a in usable and with_text < 4:
            e['text'] = (a.get('text') or '')[:1800]
            with_text += 1
        else:
            e['title_only'] = True
        entries.append(e)
    payload = {
        'articles': entries,
        'candidate_census_ids': cl['companies'],
        'census_records': [census_context(by_id.get(cid)) for cid in cl['companies'][:3]],
        'suggested_type': cl['type'],
        # The company's own announcement, not independent reporting — the model
        # must attribute ("the company said"), never write it as confirmed.
        'primary_source': bool(cl.get('primary')),
    }
    def normalize(o):
        if not o:
            return None
        ss = o.get('same_story')
        try:
            ss = sorted({int(x) for x in (ss or []) if 0 <= int(x) < len(arts)})
        except (TypeError, ValueError):
            ss = []
        o['use_urls'] = [arts[i]['url'] for i in ss] if ss else [a['url'] for a in arts]
        o['evict_urls'] = [a['url'] for a in arts if a['url'] not in set(o['use_urls'])] if ss else []
        pts = o.get('points')
        if isinstance(pts, str):
            pts = [pts]
        if not pts and o.get('brief'):  # model regressed to prose — split it
            # \s+ after sentence punctuation splits "Oct. 1." into a bullet
            # reading "1." — require the next char to open a real sentence.
            pts = [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z(“"])', o['brief'])
                   if len(s.split()) >= 3]
        o['points'] = [str(p).strip().rstrip() for p in (pts or []) if str(p).strip()][:3]
        return o if o.get('headline') and o['points'] else None

    out = normalize(llm_json(cfg, STYLE, json.dumps(payload, ensure_ascii=False)))
    if not out:
        return None
    texts = [a.get('text') or '' for a in usable] + [a['title'] for a in arts]
    joined = lambda o: o['headline'] + ' ' + ' '.join(o['points'])  # noqa: E731
    if shingle_overlap(joined(out), texts):
        out2 = normalize(llm_json(cfg, STYLE, json.dumps(payload, ensure_ascii=False) +
                                  '\n\nYour previous draft reused wording from a source. Rewrite fully in different words.'))
        if out2 and not shingle_overlap(joined(out2), texts):
            out = out2
        else:
            out['flag_verbatim'] = True
    return out


def evict_split(state, key, b):
    """Articles the brief model judged to be a DIFFERENT story leave the
    cluster and become their own cluster — never a silent source on an item
    they don't report, never thrown away either."""
    ev = set(b.get('evict_urls') or [])
    if not ev:
        return None
    cl = state['clusters'][key]
    moved = [a for a in cl['articles'] if a['url'] in ev]
    if not moved or len(moved) == len(cl['articles']):
        return None
    cl['articles'] = [a for a in cl['articles'] if a['url'] not in ev]
    n = 2
    nk = f"{key}~e{n}"
    while nk in state['clusters']:
        n += 1
        nk = f"{key}~e{n}"
    state['clusters'][nk] = {'key': nk, 'articles': moved, 'companies': list(cl['companies']),
                             'type': cl['type'], 'primary': cl.get('primary', False)}
    print(f"    evicted {len(moved)} article(s) from {key} -> {nk}")
    return nk


def used_arts(state, key):
    """A cluster's articles filtered to the ones its brief confirmed as the
    same story — the ONLY articles allowed to appear as the item's sources."""
    cl = state.get('clusters', {}).get(key, {})
    b = state.get('briefs', {}).get(key) or {}
    arts = cl.get('articles', [])
    uu = set(b.get('use_urls') or [])
    return [a for a in arts if a['url'] in uu] if uu else arts


# --------------------------------------------------------------- signals -----
# The only census-native items that reach the wire are headcount moves: a real
# fact about a company, read and dated, with the method on its profile. Facts
# about the DATABASE (rows added) are not news and are not published here.
def headcount_signals(state, companies):
    """Our own data journalism: aggregate LinkedIn-read headcount moves between
    runs. First run only seeds the snapshot."""
    snap = state.setdefault('hc_snap', {})
    items = []
    for c in companies:
        n, asof = c.get('employees_est'), c.get('employees_asof')
        if not n or not asof:
            continue
        prev = snap.get(c['id'])
        if prev and prev.get('asof') and prev['asof'] < asof and prev.get('n'):
            d = n - prev['n']
            if abs(d) >= max(15, round(prev['n'] * 0.10)):
                verb = 'grows' if d > 0 else 'shrinks'
                items.append({
                    'kind': 'signal', 'type': 'people', 'date': asof,
                    'companies': [c['id']],
                    'headline': f"{c['name']} headcount {verb} to {n:,} ({d:+,} since {prev['asof']})",
                    'points': [
                        f"Tracked headcount moved from {prev['n']:,} (read {prev['asof']}) to {n:,} (read {asof}) — "
                        f"{abs(d) / prev['n'] * 100:.0f}% {'up' if d > 0 else 'down'}.",
                        "Counts follow the census headcount ladder; the source and read date are on the company page.",
                    ],
                    # Bahasa Indonesia lane, same templates (see signal_id)
                    'hl_id': f"Jumlah pekerja {c['name']} {'naik' if d > 0 else 'turun'} menjadi {n:,} ({d:+,} sejak {prev['asof']})",
                    'pts_id': [
                        f"Jumlah pekerja terpantau bergerak dari {prev['n']:,} (dibaca {prev['asof']}) ke {n:,} (dibaca {asof}) — "
                        f"{'naik' if d > 0 else 'turun'} {abs(d) / prev['n'] * 100:.0f}%.",
                        SIG_P2_ID,
                    ],
                    'context': '',
                    'sources': [{'outlet': '1001startup.id census', 'url': f"/company/{c['id']}",
                                 'title': f"{c['name']} — census profile", 'date': asof}],
                })
        snap[c['id']] = {'n': n, 'asof': asof}
    return items


def track_new_companies(state, companies):
    """Roll the known-id snapshot forward. Emits NOTHING to the wire.

    Until Aug 30 2026 every census addition published a "New in the census: X"
    item, typed market → they rendered as ECOSYSTEM and, at 51 of 158 items,
    were the largest bucket on the page and most of the top-of-the-wire rail.
    Luca: "adding ecosystem wont help in the /news, the news is news only."
    A row appearing in our own database is a changelog entry, not a story —
    it is already visible on the company profile and in the census counts.
    The snapshot itself stays: the pipeline still needs to know what is new."""
    state['known_ids'] = [c['id'] for c in companies]
    return []


# ----------------------------------------------------------------- publish ---
def art_for(cl_companies, by_id, sprites):
    # Real logos only — Luca, Aug 30: the 3D map sprites read as toys in a news
    # feed ("it is bad idea here using 3d image/asset lol").
    for cid in cl_companies:
        c = by_id.get(cid)
        if not c:
            continue
        if c.get('logo'):
            return {'kind': 'logo', 'src': c['logo'], 'company': cid}
    if cl_companies and by_id.get(cl_companies[0]):
        return {'kind': 'tile', 'sector': by_id[cl_companies[0]].get('sector_key') or 'misc',
                'company': cl_companies[0]}
    return {'kind': 'tile', 'sector': 'misc', 'company': None}


def publish(state, by_id, sprites, keep_days=90):
    items = []
    dup = state.get('dup', {})
    absorbed_by = {}
    for a, w in dup.items():
        absorbed_by.setdefault(w, []).append(a)
    for k, cl in state.get('clusters', {}).items():
        if k in dup:
            continue  # folded into its winner below
        b = state.get('briefs', {}).get(k)
        if not b:
            continue
        arts = list(used_arts(state, k))
        for ak in absorbed_by.get(k, []):
            for art in used_arts(state, ak):
                if all(x['url'] != art['url'] for x in arts):
                    arts.append(art)
        if not arts:
            continue
        arts = sorted(arts, key=lambda a: a['date'], reverse=True)
        date = arts[0]['date'][:10]
        srcs = [{'outlet': a['outlet'], 'url': a['url'], 'title': a['title'],
                 'date': a['date'][:10]} for a in arts]
        if b.get('headline_only'):
            item = {'id': hashlib.sha1(k.encode()).hexdigest()[:12], 'kind': 'link',
                    'type': cl['type'], 'date': date,
                    'companies': cl['companies'][:3],
                    'headline': arts[0]['title'][:140],
                    'points': [], 'context': '', 'sources': srcs,
                    'note': 'paywalled reporting — headline and link only',
                    'note_id': 'pemberitaan berbayar — hanya judul dan tautan'}
        else:
            if b.get('flag_verbatim') or b.get('confidence') == 'low':
                continue  # held back, visible in state for review
            comp = [c for c in (b.get('companies') or cl['companies']) if c in by_id][:3]
            pts = b.get('points') or ([s.strip() for s in
                                       re.split(r'(?<=[.!?])\s+(?=[A-Z(“"])', b.get('brief') or '')
                                       if len(s.split()) >= 3][:3])
            item = {'id': hashlib.sha1(k.encode()).hexdigest()[:12],
                    'kind': 'original' if cl.get('primary') else 'wire',
                    'type': b.get('type') or cl['type'], 'date': date,
                    'companies': comp, 'headline': b['headline'].strip(),
                    'points': pts, 'context': (b.get('context') or '').strip(),
                    'sources': srcs}
            if b.get('hl_id'):  # the Bahasa Indonesia lane, where translated
                item['hl_id'] = b['hl_id']
                item['pts_id'] = b.get('pts_id') or []
                item['cx_id'] = b.get('cx_id') or ''
        item['art'] = art_for(item['companies'], by_id, sprites)
        item['news_img'] = next((a.get('image') for a in arts if a.get('image')), None)
        items.append(item)

    for s in state.get('signals', []):
        s2 = dict(s)
        s2['id'] = hashlib.sha1((s['headline'] + s['date']).encode()).hexdigest()[:12]
        s2['art'] = art_for(s['companies'], by_id, sprites)
        items.append(s2)

    cutoff = (datetime.now(WIB) - timedelta(days=keep_days)).strftime('%Y-%m-%d')
    items = [i for i in items if i['date'] >= cutoff]
    seen_ids, dedup = set(), []
    for i in sorted(items, key=lambda i: (i['date'], i.get('kind') != 'signal'), reverse=True):
        if i['id'] not in seen_ids:
            seen_ids.add(i['id'])
            dedup.append(i)
    for i in dedup:
        i['companies'] = [{'id': cid, 'name': by_id[cid]['name']} for cid in i['companies'] if cid in by_id]
    return {'generated': now_iso(), 'items': dedup,
            'note': ('Briefs are written by the census pipeline in its own words from the '
                     'linked reporting (UU 28/2014 Pasal 43(c): berita aktual with full '
                     'attribution). Every item links to every outlet it draws on. '
                     'Artwork is census-owned; press photos are never republished.')}


# -------------------------------------------------------------------- main ---
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run', 'rebuild', 'rebrief', 'translate'])
    ap.add_argument('--days', type=int, default=7)
    ap.add_argument('--top', type=int, default=60, help='per-company probes for top-N by rank')
    ap.add_argument('--all', action='store_true', help='probe every census company')
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    census = jload(CENSUS, {})
    companies = census.get('companies', [])
    by_id = {c['id']: c for c in companies}
    sprites = jload(SPRITES, {})
    state = jload(STATE, {})

    if args.cmd == 'rebuild':
        out = publish(state, by_id, sprites)
        jdump(OUT, out)
        print(f"rebuilt: {len(out['items'])} items -> {OUT}")
        return

    if args.cmd == 'translate':
        # Backfill/refresh the Bahasa Indonesia lane over what is already in
        # state, then republish. Run alone, or rely on `run` doing it inline.
        cfg = llm_cfg()
        translate_state(cfg, state)
        if args.dry:
            print('DRY RUN — state and output not written')
            return
        jdump(STATE, state)
        out = publish(state, by_id, sprites)
        jdump(OUT, out)
        n_id = sum(1 for i in out['items'] if i.get('hl_id'))
        print(f"published {len(out['items'])} items ({n_id} with Indonesian) -> {OUT}")
        return

    if args.cmd == 'rebrief':
        # Regenerate every brief from the clusters already in state — the path
        # for a house-style change (e.g. prose -> bullet points) without paying
        # for discovery again.
        cfg = llm_cfg()
        briefs = state.setdefault('briefs', {})
        todo = [k for k, cl in state.get('clusters', {}).items() if cl.get('articles')]
        print(f"rebrief: {len(todo)} clusters")
        for k in todo:
            if not state['clusters'][k].get('articles'):
                continue
            b = brief_cluster(cfg, state['clusters'][k], by_id)
            if b:
                briefs[k] = b
                nk = evict_split(state, k, b)
                if nk:
                    todo.append(nk)
                tag = 'link-only' if b.get('headline_only') else ('HELD' if b.get('flag_verbatim') or b.get('confidence') == 'low' else 'ok')
                print(f"  [{tag}] {k}: {b.get('headline', '')[:80]}")
            time.sleep(0.4)
        llm_dedup(cfg, state)
        translate_state(cfg, state)  # fresh briefs need their Indonesian back
        jdump(STATE, state)
        out = publish(state, by_id, sprites)
        jdump(OUT, out)
        print(f"published {len(out['items'])} items -> {OUT}")
        return

    key = exa_key()
    cfg = llm_cfg()
    seen = state.setdefault('seen', {})
    cost = 0.0
    hits = []

    # Exa's startPublishedDate is advisory — the test run returned 2019–2022
    # stories inside a 4-day window. A wire that runs old news as new is
    # broken journalism, so the date gate is enforced HERE, hard.
    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days + 1)).strftime('%Y-%m-%d')

    def take(results, lane_hint):
        nonlocal hits
        for r in results:
            url = r.get('url') or ''
            if not url or url in seen:
                continue
            outlet = outlet_of(url)
            if outlet not in OUTLETS:
                continue
            date = (r.get('publishedDate') or '')[:10]
            if not date or date < cutoff:
                continue
            title, text = r.get('title') or '', r.get('text') or ''
            comp, _strong = find_companies(companies, title, text, outlet)
            hits.append({'url': url, 'title': title, 'text': text, 'date': date,
                         'outlet': outlet, 'image': r.get('image'), 'author': r.get('author'),
                         'companies': comp[:3], 'type': classify(title, text, lane_hint)})
            seen[url] = date

    print(f"== discovery ({args.days}d window) ==")
    for lane, q in LANES:
        try:
            res, c = exa_search(key, q, args.days, n=15, domains=OUTLETS)
            cost += c
            take(res, lane)
            print(f"  lane {lane:11s} {len(res):2d} results  (${c:.3f})")
        except Exception as e:
            print(f"  lane {lane} FAILED: {e}", file=sys.stderr)
        time.sleep(0.4)

    probe = companies if args.all else sorted(companies, key=lambda c: c.get('rank') or 9999)[:args.top]
    print(f"== per-company probes ({len(probe)}) ==")
    for i, c in enumerate(probe):
        try:
            res, cc = exa_search(key, f'"{c["name"]}" Indonesia startup news', args.days, n=5, domains=OUTLETS)
            cost += cc
            for r in res:  # probe results must actually mention the company
                comp, _ = find_companies([c], r.get('title') or '', r.get('text') or '',
                                         outlet_of(r.get('url') or ''))
                if comp:
                    take([r], None)
        except Exception as e:
            print(f"  probe {c['id']} FAILED: {e}", file=sys.stderr)
        if i % 20 == 19:
            print(f"  ...{i+1}/{len(probe)} (${cost:.2f})")
        time.sleep(0.3)

    # PRIMARY-SOURCE LANE — the census companies' OWN sites (Luca, Aug 30:
    # "is it possible that we have our own news?"). No outlet in between: what
    # the company itself announced, always attributed as the company's claim.
    dom2cid = {}
    for c in companies:
        h = host_of(c.get('url') or '') if c.get('url') else ''
        if h and h not in OUTLETS:  # kumparan.com etc. are outlets, not sources here
            dom2cid.setdefault(h, c['id'])
    doms = list(dom2cid)
    print(f"== primary-source lane ({len(doms)} company domains) ==")
    for i in range(0, len(doms), 25):
        batch = doms[i:i + 25]
        try:
            res, cc = exa_search(key, 'official company announcement: new product, partnership, funding, expansion, milestone',
                                 args.days, n=20, domains=batch)
            cost += cc
            for r in res:
                url = r.get('url') or ''
                if not url or url in seen:
                    continue
                h = host_of(url)
                cid = next((dom2cid[d] for d in batch if h == d or h.endswith('.' + d)), None)
                date = (r.get('publishedDate') or '')[:10]
                title, text = r.get('title') or '', r.get('text') or ''
                if not cid or not date or date < cutoff or len(title) < 16:
                    continue
                ty = classify(title, text, None)
                if ty == 'market':
                    continue  # undated marketing pages classify as nothing real
                hits.append({'url': url, 'title': title, 'text': text, 'date': date,
                             'outlet': h, 'image': r.get('image'), 'author': r.get('author'),
                             'companies': [cid], 'type': ty, 'primary': True})
                seen[url] = date
        except Exception as e:
            print(f"  primary batch {i // 25} FAILED: {e}", file=sys.stderr)
        time.sleep(0.3)

    print(f"discovered {len(hits)} new articles, Exa ${cost:.2f}")
    cluster_hits(state, hits)
    merge_clusters(state)

    briefs = state.setdefault('briefs', {})
    todo = [k for k, cl in state['clusters'].items()
            if k not in briefs and cl['articles']]
    print(f"== briefs: {len(todo)} clusters to write ==")
    for k in todo:
        cl = state['clusters'][k]
        if not cl['articles']:
            continue
        b = brief_cluster(cfg, cl, by_id)
        if b:
            briefs[k] = b
            nk = evict_split(state, k, b)
            if nk:
                todo.append(nk)  # the evicted story gets its own brief this run
            tag = 'link-only' if b.get('headline_only') else ('HELD' if b.get('flag_verbatim') or b.get('confidence') == 'low' else 'ok')
            print(f"  [{tag}] {k}: {b.get('headline', cl['articles'][0]['title'])[:80]}")
        time.sleep(0.5)

    llm_dedup(cfg, state)

    state.setdefault('signals', [])
    fresh = headcount_signals(state, companies) + track_new_companies(state, companies)
    have = {(s['headline'], s['date']) for s in state['signals']}
    for s in fresh:
        if (s['headline'], s['date']) not in have:
            state['signals'].append(s)
    if fresh:
        print(f"== signals: {len(fresh)} new census-data items ==")

    print('== bahasa indonesia lane ==')
    translate_state(cfg, state)

    if args.dry:
        print('DRY RUN — state and output not written')
        return
    jdump(STATE, state)
    out = publish(state, by_id, sprites)
    jdump(OUT, out)
    held = sum(1 for b in briefs.values() if b.get('flag_verbatim') or b.get('confidence') == 'low')
    print(f"published {len(out['items'])} items -> {OUT}  (held back: {held})")
    # Fresh wire -> IndexNow (Bing/Copilot/DuckDuckGo; ChatGPT's web layer
    # leans on Bing). Best-effort: a ping failure must never touch the wire.
    try:
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'indexnow.py'),
                        'https://1001startup.id/news', 'https://1001startup.id/id/news'],
                       timeout=90, capture_output=True)
        print('indexnow: pinged /news + /id/news')
    except Exception as e:
        print(f'indexnow ping skipped: {e}', file=sys.stderr)


if __name__ == '__main__':
    main()
