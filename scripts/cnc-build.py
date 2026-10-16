#!/usr/bin/env python3
"""CNC + 3D Indonesia — build public/data/cnc.json from the research sweep.

Inputs: the 20-agent research sweep of 16 Oct 2026 (UTC), one folder of JSON
files written by the research agents:
    firms_*.json    named firms that machine or 3D-print (census rows)
    places_*.json   one focus product per province / Java regency cluster
    markets_*.json  market size + share potential per product line (slice 2)
    clusters_world.json  China / comparator cluster cases (slice 2)
Each input is copied verbatim into data/cnc-source/ first, so a build can be
re-run without the research folder.

Rules, in the census family's spirit (1001startup.id, 1001umkm.id):
  - every firm row links to the page it was compiled from; a row without an
    http(s) source is dropped and counted in the build report;
  - blanks stay blank, nothing is imputed;
  - one evidence tier per firm, derived from what the source IS, not guessed;
  - pins are city-level (photon.komoot.io; Nominatim 429-bans this VM), and
    a pin that could only be placed at its province's anchor city says so.

Writes public/data/cnc.json (read by server.js, gated as a download like
umkm.json), data/cnc-geo.json (geocode cache, single writer) and
data/cnc-build-report.json (what was merged, dropped and placed).

Usage: python3 scripts/cnc-build.py [research-folder] [--no-geocode] [--out=<scratch-dir>]
"""
import datetime
import json
import pathlib
import re
import shutil
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_SRC = pathlib.Path('/home/ubuntu/projects/java-cnc-research/research_notes/CNC and 3D printing province focus')
SNAP = ROOT / 'data' / 'cnc-source'
GEO = ROOT / 'data' / 'cnc-geo.json'
OUT = ROOT / 'public' / 'data' / 'cnc.json'
REPORT = ROOT / 'data' / 'cnc-build-report.json'
UA = {'User-Agent': 'cnc-map-geocoder/1.0 (cnc.vantis.sh; city-level pins)'}
BBOX = (94.0, -12.0, 142.0, 7.5)

# ── provinces ────────────────────────────────────────────────────────────────
ISLANDS = [
    ('Sumatra', ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi',
                 'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung']),
    ('Java', ['DKI Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur']),
    ('Bali & Nusa Tenggara', ['Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur']),
    ('Kalimantan', ['Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara']),
    ('Sulawesi', ['Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara']),
    ('Maluku & Papua', ['Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah',
                        'Papua Pegunungan', 'Papua Selatan']),
]
ISLAND_OF = {p: isl for isl, ps in ISLANDS for p in ps}
ISLAND_ORDER = {isl: i for i, (isl, _) in enumerate(ISLANDS)}
CANON = {p.lower(): p for _, ps in ISLANDS for p in ps}
ALIAS = {
    'nanggroe aceh darussalam': 'Aceh', 'nad': 'Aceh',
    'sumatra utara': 'Sumatera Utara', 'north sumatra': 'Sumatera Utara', 'north sumatera': 'Sumatera Utara', 'sumut': 'Sumatera Utara',
    'sumatra barat': 'Sumatera Barat', 'west sumatra': 'Sumatera Barat', 'west sumatera': 'Sumatera Barat', 'sumbar': 'Sumatera Barat',
    'riau islands': 'Kepulauan Riau', 'kepri': 'Kepulauan Riau',
    'sumatra selatan': 'Sumatera Selatan', 'south sumatra': 'Sumatera Selatan', 'south sumatera': 'Sumatera Selatan', 'sumsel': 'Sumatera Selatan',
    'bangka belitung': 'Kepulauan Bangka Belitung', 'babel': 'Kepulauan Bangka Belitung', 'bangka belitung islands': 'Kepulauan Bangka Belitung',
    'jakarta': 'DKI Jakarta', 'dki': 'DKI Jakarta', 'dk jakarta': 'DKI Jakarta', 'daerah khusus jakarta': 'DKI Jakarta',
    'special capital region of jakarta': 'DKI Jakarta', 'daerah khusus ibukota jakarta': 'DKI Jakarta',
    'west java': 'Jawa Barat', 'jabar': 'Jawa Barat',
    'central java': 'Jawa Tengah', 'jateng': 'Jawa Tengah',
    'diy': 'DI Yogyakarta', 'yogyakarta': 'DI Yogyakarta', 'daerah istimewa yogyakarta': 'DI Yogyakarta',
    'special region of yogyakarta': 'DI Yogyakarta', 'di yogyakarta': 'DI Yogyakarta', 'jogja': 'DI Yogyakarta',
    'east java': 'Jawa Timur', 'jatim': 'Jawa Timur',
    'west nusa tenggara': 'Nusa Tenggara Barat', 'ntb': 'Nusa Tenggara Barat',
    'east nusa tenggara': 'Nusa Tenggara Timur', 'ntt': 'Nusa Tenggara Timur',
    'west kalimantan': 'Kalimantan Barat', 'kalbar': 'Kalimantan Barat',
    'central kalimantan': 'Kalimantan Tengah', 'kalteng': 'Kalimantan Tengah',
    'south kalimantan': 'Kalimantan Selatan', 'kalsel': 'Kalimantan Selatan',
    'east kalimantan': 'Kalimantan Timur', 'kaltim': 'Kalimantan Timur',
    'north kalimantan': 'Kalimantan Utara', 'kaltara': 'Kalimantan Utara',
    'north sulawesi': 'Sulawesi Utara', 'sulut': 'Sulawesi Utara',
    'central sulawesi': 'Sulawesi Tengah', 'sulteng': 'Sulawesi Tengah',
    'west sulawesi': 'Sulawesi Barat', 'sulbar': 'Sulawesi Barat',
    'south sulawesi': 'Sulawesi Selatan', 'sulsel': 'Sulawesi Selatan',
    'southeast sulawesi': 'Sulawesi Tenggara', 'south east sulawesi': 'Sulawesi Tenggara', 'sultra': 'Sulawesi Tenggara',
    'north maluku': 'Maluku Utara', 'malut': 'Maluku Utara',
    'west papua': 'Papua Barat', 'southwest papua': 'Papua Barat Daya', 'south west papua': 'Papua Barat Daya',
    'central papua': 'Papua Tengah', 'highland papua': 'Papua Pegunungan', 'papua highlands': 'Papua Pegunungan',
    'south papua': 'Papua Selatan',
}


def canon_prov(s):
    if not s:
        return None
    k = unicodedata.normalize('NFKD', str(s)).lower()
    k = re.sub(r'[.’\']', '', k)
    k = re.sub(r'^(provinsi|province of|prov)\s+', '', k)
    k = re.sub(r'\s+province$', '', k)
    k = re.sub(r'\s+', ' ', k).strip()
    return CANON.get(k) or ALIAS.get(k)


# Where a province's or cluster's marker stands: the place the focus is about
# (an industrial centre where it differs from the capital). Cluster names fall
# back to their first named town.
ANCHOR = {
    'Aceh': 'Banda Aceh', 'Sumatera Utara': 'Medan', 'Sumatera Barat': 'Padang', 'Riau': 'Pekanbaru',
    'Kepulauan Riau': 'Batam', 'Jambi': 'Jambi', 'Sumatera Selatan': 'Palembang',
    'Kepulauan Bangka Belitung': 'Pangkalpinang', 'Bengkulu': 'Bengkulu', 'Lampung': 'Bandar Lampung',
    'DKI Jakarta': 'Jakarta', 'DI Yogyakarta': 'Yogyakarta', 'Bali': 'Denpasar', 'Nusa Tenggara Barat': 'Mataram',
    'Nusa Tenggara Timur': 'Kupang', 'Kalimantan Barat': 'Pontianak', 'Kalimantan Tengah': 'Palangka Raya',
    'Kalimantan Selatan': 'Banjarmasin', 'Kalimantan Timur': 'Balikpapan', 'Kalimantan Utara': 'Tanjung Selor',
    'Sulawesi Utara': 'Bitung', 'Gorontalo': 'Gorontalo', 'Sulawesi Tengah': 'Morowali', 'Sulawesi Barat': 'Mamuju',
    'Sulawesi Selatan': 'Makassar', 'Sulawesi Tenggara': 'Kendari', 'Maluku': 'Ambon', 'Maluku Utara': 'Ternate',
    'Papua': 'Jayapura', 'Papua Barat': 'Manokwari', 'Papua Barat Daya': 'Sorong', 'Papua Tengah': 'Timika',
    'Papua Pegunungan': 'Wamena', 'Papua Selatan': 'Merauke',
    # Java clusters (by the cluster names the research used)
    'tangerang raya': 'Tangerang', 'serang–cilegon': 'Cilegon', 'bekasi': 'Cikarang', 'karawang–purwakarta': 'Karawang',
    'bogor–depok': 'Bogor', 'sukabumi–cianjur': 'Sukabumi', 'bandung raya': 'Bandung', 'subang–patimban': 'Subang',
    'cirebon–indramayu–majalengka': 'Cirebon', 'priangan timur': 'Tasikmalaya',
    'tegal–brebes–pemalang': 'Tegal', 'pekalongan–batang–kendal': 'Batang', 'semarang–demak': 'Semarang',
    'kudus–jepara–pati–rembang': 'Kudus', 'klaten–solo raya': 'Klaten', 'salatiga–magelang': 'Salatiga',
    'banyumas raya': 'Purbalingga', 'surabaya–sidoarjo': 'Surabaya', 'gresik–lamongan–tuban': 'Gresik',
    'mojokerto–pasuruan': 'Pasuruan', 'malang raya': 'Malang', 'kediri–blitar–tulungagung': 'Kediri',
    'madiun raya': 'Madiun', 'tapal kuda': 'Jember', 'madura': 'Pamekasan',
}

# A firm whose source names no town is pinned at its province's capital or
# main city (geo_kind 'province'), not at the focus anchor above.
FALLBACK = dict(ANCHOR)
FALLBACK.update({'Sulawesi Tengah': 'Palu', 'Kalimantan Timur': 'Samarinda', 'Sulawesi Utara': 'Manado',
                 'Papua Tengah': 'Nabire', 'Kepulauan Riau': 'Batam'})

# Corrections found after a research pass, applied at build time so the agent
# files stay verbatim. Each: (where, old text, new text, why).
TEXT_FIXES = [
    ('place:Salatiga–Magelang',
     "It is linked to the ARM CNC aluminium motorcycle-parts brand (shown on DTECH's site; detikJateng in Apr 2024 called it a spare-parts company DTECH invested in), which",
     "Its own CNC aluminium motorcycle-parts brand, ARM ARUMI Motoparts (the trademarks are registered to PT DTECH Inovasi Indonesia), which",
     '16 Oct 2026 company-web check: ARM is DTECH\'s own brand; the detikJateng "invested in" passage is about a different firm, "XYZ"'),
    ('firm:PT DTECH Inovasi Indonesia (DTECH-ENGINEERING)',
     'linked to the ARM (Arumi Motoparts) CNC motorcycle-parts brand',
     'its own ARM ARUMI Motoparts CNC motorcycle-parts brand',
     'same check'),
    ('firm:PT Yogya Presisi Tehnikatama Industri (YPTI)',
     '; aircraft components;', ';',
     '16 Oct 2026 YPTI company-web check: component supply to PTDI is a hope, not a contract; the Mar 2025 framework is about PTDI\'s machines'),
    ('firm:PT Yogya Presisi Teknikatama Industri (YPTI)',
     "YPTI hosted a field visit for 30 metal IKM during Kemenperin's July 2026 partnership facilitation.",
     "YPTI joined Kemenperin's July 2026 field visits to 30 metal IKM in Karawang and Bekasi.",
     'same check: YPTI did not host the visit'),
]
# The same firm under two spellings in different research files.
KEY_ALIASES = {'yogyapresisiteknikatamaindustriypti': 'yogyapresisitehnikatamaindustriypti'}

# ── product families (map colour + legend) ───────────────────────────────────
FAMILIES = [
    ('health', 'Medical & dental', '#BE185D', r'dental|medic|implant|orthop|prosthe|orthos|hearing|surgical|hospital|aligner'),
    ('craft', 'Jewelry, furniture & craft', '#7C3AED', r'jewel|silver|gold|furniture|carv|wood|rattan|guitar|instrument|signage|handicraft|craft|brass|marble|stone|surfboard|souvenir|batik'),
    ('tooling', 'Tools, moulds & dies', '#C2410C', r'mou?lds?\b|\bdies\b|\bdie\b|press tool|tooling|\bjigs?\b|fixture|gauges?\b|cetakan|cutting tool|stamping|pattern'),
    ('marine', 'Marine & fishing', '#0E7490', r'propel|boat|\bship|marine|fish|outboard|vessel|seaweed|perahu|kapal'),
    ('precision', 'Rail, aero & defence', '#4338CA', r'\brail|\btrains?\b|aircraft|aero|defen[cs]e|weapon|ammunition|\bdrones?\b|\buav|military'),
    ('vehicle', 'Vehicle & EV parts', '#B91C1C', r'motorcycle|motorbike|automotive|\bcars?\b|vehicle|\bev\b|electric|e-motor|bicycle|exhaust|knalpot|auto parts|aftermarket|billet|powertrain|drivetrain|engine'),
    ('farm', 'Farm & food machinery', '#4D7C0F', r'tractor|farm|agricult|agro|rice|harvest|thresh|food|coffee|cocoa|tapioca|cassava|alsintan|irrigation|water pump'),
    ('mining', 'Mining & smelter parts', '#78350F', r'smelter|nickel|mining|\bmines?\b|crusher|excavator|heavy equipment|earth-?moving|bucket|ground engaging|\bcoal\b|\btin\b|bauxite|alumina|component rebuild|mineral'),
    ('energy', 'Oil, gas & power parts', '#A16207', r'(?<!palm-)(?<!palm )\boil\b|\bgas\b|refiner|power plant|power|turbine|transmission line|substation|electrical|\blng\b|geothermal|petro|fertili'),
    ('plant', 'Plant & mill spare parts', '#4E7A96', r'palm|mill|sugar|cement|pulp|paper|spare|gear|shaft|pump|valve|bearing|conveyor|boiler|process|plant|machin|wear'),
]
FAM_OTHER = ('other', 'Other', '#71717A')

# Our condensed wording of each pick for the map and the table (the research's
# full wording stays on the card), with the product family where the keyword
# match would mislead. Keyed by the place name the research used.
LABELS = {
    'Aceh': ('Essential-oil distillers and agro machines', 'farm'),
    'Riau': ('Oilfield wellhead and downhole parts', 'energy'),
    'Kepulauan Riau': ('Oil-pipe threading and couplings (OCTG)', 'energy'),
    'Sumatera Selatan': ('Hydraulic cylinders and mining wear parts', 'mining'),
    'Lampung': ('Sugarcane and cassava field implements', 'farm'),
    'Serang–Cilegon': ('Steel and petrochemical plant spares', 'plant'),
    'Tangerang Raya': ('Rubber and plastic moulds (tyres, soles)', 'tooling'),
    'Sukabumi–Cianjur': ('Tea, coffee and rice machine wear parts', 'farm'),
    'DKI Jakarta': ('Press dies, jigs and fixtures for car lines', 'tooling'),
    'Subang–Patimban': ('Stamping dies and jigs for the EV plants', 'tooling'),
    'Priangan Timur': ('Blades and hand tools (golok, hoes)', 'tooling'),
    'Cirebon–Indramayu–Majalengka': ('Metal frames and parts for furniture', 'craft'),
    'Tegal–Brebes–Pemalang': ('Motorcycle and car parts (tier-2)', 'vehicle'),
    'Banyumas Raya': ('Motorcycle exhausts (knalpot)', 'vehicle'),
    'Pekalongan–Batang–Kendal': ('Tyre, sole and injection moulds', 'tooling'),
    'DI Yogyakarta': ('Farm machinery and its parts', 'farm'),
    'Semarang–Demak': ('Food-service and food-processing equipment', 'farm'),
    'Salatiga–Magelang': ('CNC aluminium motorcycle parts', 'vehicle'),
    'Klaten–Solo Raya': ('Machined castings: valves, pump housings', 'plant'),
    'Kudus–Jepara–Pati–Rembang': ('CNC-routed furniture parts and carving', 'craft'),
    'Madiun Raya': ('Rail rolling-stock parts for INKA', 'precision'),
    'Kediri–Blitar–Tulungagung': ('Kretek-machine wear parts', 'plant'),
    'Malang Raya': ('Light CNC machine tools', 'tooling'),
    'Gresik–Lamongan–Tuban': ('Cement, crusher and smelter wear parts', 'mining'),
    'Surabaya–Sidoarjo': ('Ship deck machinery and marine parts', 'marine'),
    'Mojokerto–Pasuruan': ('Orthopaedic implants and instruments', 'health'),
    'Madura': ('Boat propellers and stern gear', 'marine'),
    'Tapal Kuda': ('Coffee and cocoa machines and parts', 'farm'),
    'Bali': ('Silver and gold jewelry (3D wax casting)', 'craft'),
    'Nusa Tenggara Barat': ('Mine and smelter spare parts (Amman)', 'mining'),
    'Nusa Tenggara Timur': ('Seaweed, salt and fish machine parts', 'farm'),
    'Kalimantan Barat': ('Alumina-refinery maintenance parts', 'mining'),
    'Kalimantan Tengah': ('Palm-oil mill spare parts', 'plant'),
    'Kalimantan Timur': ('Heavy-equipment component rebuild', 'mining'),
    'Kalimantan Utara': ('Process-plant and oilfield spares', 'plant'),
    'Sulawesi Selatan': ('Gears, sprockets and mill spares', 'plant'),
    'Sulawesi Tenggara': ('Conveyor and ore-handling parts', 'mining'),
    'Sulawesi Utara': ('Coconut-processing machines and spares', 'farm'),
    'Maluku Utara': ('Smelter and port maintenance spares', 'mining'),
    'Maluku': ('Fishing-boat propulsion spares', 'marine'),
    'Papua Barat Daya': ('Ship-repair machining (Sorong)', 'marine'),
    'Papua Barat': ('Cement and LNG plant spares', 'plant'),
    'Papua Tengah': ('Mining wear parts and rebuild (Grasberg)', 'mining'),
    'Papua Pegunungan': ('On-demand CNC and 3D-printed spares', 'plant'),
    'Papua': ('Vehicle and boat-engine spare parts', 'plant'),
}


def family_of(text):
    t = (text or '').lower()
    for key, _label, _color, rx in FAMILIES:
        if re.search(rx, t):
            return key
    return FAM_OTHER[0]


def short_label(product, cap=44):
    """The head of a long research product string: parentheticals out, the
    part before a colon, cut at the first qualifier ("incl.", "for", "plus"…),
    then at a word boundary."""
    s = re.sub(r'\s*\([^)]*\)', '', product or '').strip()
    s = s.split(':')[0].strip()
    s = re.split(r';\s|\s[—–]\s|\s-\s|,?\s(?:incl\.?|including|for|as|with|to|in|plus|upgrading|using|via)\s', s, maxsplit=1)[0].strip(' ,')
    if len(s) <= cap:
        return s
    cut = s[:cap - 1]
    cut = cut[:cut.rfind(' ')] if ' ' in cut else cut
    return cut.rstrip(' ,;-') + '…'


def classify(product, short):
    k = family_of(short)
    return k if k != FAM_OTHER[0] else family_of(product)


# ── firms ────────────────────────────────────────────────────────────────────
KINDS = {
    'cnc_job_shop': 'CNC job shop', 'mould_die_maker': 'Mould & die', 'precision_parts_supplier': 'Precision parts',
    'foundry_machining': 'Foundry + machining', 'cnc_machine_builder': 'CNC machine builder',
    'laser_plasma_fabricator': 'Laser / plasma cutting', 'cnc_router_wood': 'CNC router (wood)',
    '3d_print_service': '3D-print service', '3d_printer_maker': '3D-printer maker', 'machinery_maker': 'Machinery maker',
    'shipyard': 'Shipyard / boatbuilder',
}
RX_YARD = re.compile(r'shipyard|\bdok\b|\bdock|galangan|kapal|maritim|fiberglass|bahari|boat', re.I)
TIER_META = {
    'cert': {'rank': 4, 'label': 'Certificate on record', 'short': 'CERT', 'color': '#2F7A5C',
             'def': 'The source records a certificate for this firm: a TKDN local-content certificate, ISO 9001, AS9100, '
                    'IATF 16949, BKI class approval or similar. We record what the source states; the certificate '
                    'register itself was not checked.'},
    'named': {'rank': 3, 'label': 'Named by a third party', 'short': 'NAMED', 'color': '#4E7A96',
              'def': 'A ministry, regional government, buyer, association or news report names this firm and what it '
                     'makes. Evidence from outside the firm, but not an audit.'},
    'site': {'rank': 2, 'label': 'Own website', 'short': 'OWN SITE', 'color': '#8A6A45',
             'def': "The firm's own website shows its machines or services. It is the firm's own account of itself."},
    'listing': {'rank': 1, 'label': 'Listing only', 'short': 'LISTING', 'color': '#8E8E93',
                'def': 'A business directory or marketplace listing is the only source. The weakest evidence: the shop '
                       'may be small, renamed or closed.'},
}
RX_ARMS = re.compile(r'ammunition|munition|weapon|\bbomb|explosive|firearm|\bguns?\b|cartridge case', re.I)
RX_3D = re.compile(r'\b(fdm|fff|sla|dlp|lcd|msla|resin|sls|mjf|slm|dmls|3d|additive|binder jet)', re.I)
LEGAL = re.compile(r'\b(pt|cv|ud|tbk|persero|perseroda|pd|koperasi|kopkar|firma|fa|inc|ltd|co|corp|company)\b\.?', re.I)


def slug(s):
    s = re.sub(r'[\u2013\u2014]', '-', s)
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:64] or 'x'


def name_key(name):
    k = unicodedata.normalize('NFKD', name or '').encode('ascii', 'ignore').decode().lower()
    k = LEGAL.sub(' ', k)
    return re.sub(r'[^a-z0-9]+', '', k)


def is_url(u):
    return isinstance(u, str) and re.match(r'^https?://[^\s/$.?#].[^\s]*$', u.strip()) is not None


def as_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if x is not None and str(x).strip()]
    s = str(v).strip()
    return [s] if s else []


def as_text(v):
    if v is None:
        return None
    if isinstance(v, list):
        v = '; '.join(str(x) for x in v if x)
    s = str(v).strip()
    return s or None


def tier_of(f):
    if f['certs']:
        return 'cert'
    st = (f.get('source_type') or '').lower()
    if st in ('government', 'news', 'association'):
        return 'named'
    if st == 'company_site':
        return 'site'
    return 'listing'


# ── geocoding (photon, cached) ───────────────────────────────────────────────
def photon(q):
    url = 'https://photon.komoot.io/api?' + urllib.parse.urlencode({'q': q, 'limit': 5, 'lang': 'en'})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=15) as r:
        return json.load(r)['features']


def pick(feats):
    ranked = []
    for f in feats:
        p = f.get('properties', {})
        if p.get('countrycode') != 'ID':
            continue
        lon, lat = f['geometry']['coordinates'][:2]
        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            continue
        kind = (p.get('osm_value') or '') + ' ' + (p.get('type') or '')
        score = 2 if re.search(r'city|town|village|suburb|municipality|county|district', kind) else \
            1 if re.search(r'state|region', kind) else 0
        ranked.append((score, f))
    if not ranked:
        return None
    ranked.sort(key=lambda t: -t[0])
    return ranked[0][1]


def clean_city(city):
    base = re.sub(r'\s*\(.*?\)\s*', ' ', city or '').strip()
    base = re.sub(r'^(kab\.?|kabupaten|kota|city of|regency of)\s+', '', base, flags=re.I).strip()
    base = re.sub(r'\s+(regency|city)$', '', base, flags=re.I).strip()
    return base.split('/')[0].split(',')[0].strip()


class Geo:
    def __init__(self, enabled):
        self.enabled = enabled
        try:
            self.doc = json.loads(GEO.read_text())
        except Exception:
            self.doc = {'places': {}, 'unmatched': []}
        self.places = self.doc.setdefault('places', {})
        self.unmatched = set(self.doc.get('unmatched') or [])
        self.calls = 0

    def find(self, town, prov):
        key = f'{town}|{prov or ""}'
        if key in self.places:
            return self.places[key]
        if key in self.unmatched or not self.enabled or not town:
            return None
        tries = [f'{town}, {prov}, Indonesia'] if prov else []
        tries.append(f'{town}, Indonesia')
        for q in tries:
            try:
                self.calls += 1
                f = pick(photon(q))
            except Exception:
                time.sleep(2)
                continue
            finally:
                time.sleep(1.1)
            if f:
                lon, lat = f['geometry']['coordinates'][:2]
                hit = {'lat': round(lat, 5), 'lon': round(lon, 5), 'matched': f['properties'].get('name')}
                self.places[key] = hit
                return hit
        self.unmatched.add(key)
        return None

    def save(self):
        self.doc['generated'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        self.doc['unmatched'] = sorted(self.unmatched)
        GEO.write_text(json.dumps(self.doc, ensure_ascii=False, indent=1))


# ── build ────────────────────────────────────────────────────────────────────
def load(path, report):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        report['bad_files'].append({'file': path.name, 'error': str(e)[:200]})
        return []
    if isinstance(data, dict):
        for k in ('firms', 'places', 'markets', 'clusters', 'items', 'rows', 'data'):
            if isinstance(data.get(k), list):
                return data[k]
        report['bad_files'].append({'file': path.name, 'error': 'object without a list'})
        return []
    return data if isinstance(data, list) else []


def main():
    global SNAP, GEO, OUT, REPORT
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src = pathlib.Path(args[0]) if args else DEFAULT_SRC
    geocode = '--no-geocode' not in sys.argv
    for a in sys.argv[1:]:
        if a.startswith('--out='):          # dry run into a scratch folder: the repo stays untouched
            d = pathlib.Path(a[6:])
            d.mkdir(parents=True, exist_ok=True)
            SNAP, GEO, OUT, REPORT = d / 'cnc-source', d / 'cnc-geo.json', d / 'cnc.json', d / 'cnc-build-report.json'
    report = {'bad_files': [], 'dropped_no_source': [], 'dropped_no_name': [], 'unknown_province': [],
              'merged_duplicates': [], 'unknown_kind': [], 'places_unplaced': [], 'firms_unplaced': 0,
              'civilian_swaps': []}

    SNAP.mkdir(parents=True, exist_ok=True)
    files = sorted(src.glob('*.json')) if src.exists() else []
    for f in files:
        shutil.copy2(f, SNAP / f.name)
    files = sorted(SNAP.glob('*.json'))
    geo = Geo(geocode)

    # firms
    raw = []
    for f in files:
        if f.name.startswith('firms_'):
            for r in load(f, report):
                if isinstance(r, dict):
                    r['_file'] = f.name
                    raw.append(r)
    firms, seen = [], {}
    for r in raw:
        name = as_text(r.get('name'))
        if not name:
            report['dropped_no_name'].append(r.get('_file'))
            continue
        src_url = as_text(r.get('source_url'))
        if not is_url(src_url):
            report['dropped_no_source'].append({'name': name, 'file': r['_file']})
            continue
        prov = canon_prov(r.get('province'))
        if r.get('province') and not prov:
            report['unknown_province'].append({'name': name, 'province': r.get('province')})
        kind = (as_text(r.get('kind')) or '').strip().lower()
        if kind not in KINDS:
            report['unknown_kind'].append({'name': name, 'kind': kind})
            kind = 'machinery_maker' if 'machin' in kind else 'cnc_job_shop'
        if kind == 'machinery_maker' and RX_YARD.search(name):
            kind = 'shipyard'
        site = as_text(r.get('website'))
        f = {
            'name': re.sub(r'\s+', ' ', name).strip(),
            'kind': kind, 'kind_label': KINDS[kind],
            'province': prov, 'city': as_text(r.get('city')),
            'capabilities': as_list(r.get('capabilities')), 'serves': as_list(r.get('serves')),
            'makes': as_text(r.get('makes')), 'size_note': as_text(r.get('size_note')),
            'certs': as_list(r.get('certs')),
            'website': site if is_url(site) else None,
            'source_url': src_url, 'source_type': (as_text(r.get('source_type')) or '').lower() or None,
            'evidence': as_text(r.get('evidence')), 'source_year': r.get('source_year'),
            'from': r['_file'],
        }
        nk = name_key(f['name'])
        key = KEY_ALIASES.get(nk, nk) + '|' + (prov or '')
        if key in seen:
            a = seen[key]
            for k in ('capabilities', 'serves', 'certs'):
                a[k] = list(dict.fromkeys(a[k] + f[k]))
            for k in ('city', 'makes', 'size_note', 'website', 'evidence', 'source_year'):
                if not a.get(k) and f.get(k):
                    a[k] = f[k]
            if f['source_url'] != a['source_url']:
                a.setdefault('more_sources', [])
                if f['source_url'] not in a['more_sources']:
                    a['more_sources'].append(f['source_url'])
                # the stronger source type leads
                if TIER_META[tier_of(f)]['rank'] > TIER_META[tier_of(a)]['rank']:
                    a['more_sources'].append(a['source_url'])
                    a['source_url'], a['source_type'] = f['source_url'], f['source_type']
            report['merged_duplicates'].append(f['name'] + ' (' + f['from'] + ')')
            continue
        seen[key] = f
        firms.append(f)

    for where, old, new, _why in TEXT_FIXES:
        if where.startswith('firm:'):
            for f in firms:
                for field in ('makes', 'evidence'):
                    if f['name'] == where[5:] and f.get(field) and old in f[field]:
                        f[field] = f[field].replace(old, new)
                        report.setdefault('text_fixes', []).append(where + ' ' + field)
    for f in firms:
        f['tier'] = tier_of(f)
        f['tier_rank'] = TIER_META[f['tier']]['rank']
        f['has_3d'] = f['kind'] in ('3d_print_service', '3d_printer_maker') or \
            any(RX_3D.search(c) for c in f['capabilities'])
    firms.sort(key=lambda f: (-f['tier_rank'], 0 if f['website'] else 1, f['name'].lower()))
    used = set()
    for i, f in enumerate(firms, 1):
        f['rank'] = i
        base = slug(f['name'] + ('-' + f['city'] if f['city'] else ''))
        fid, n = base, 2
        while fid in used:
            fid, n = f'{base}-{n}', n + 1
        used.add(fid)
        f['id'] = fid

    # places
    places, pseen = [], set()
    for fpath in files:
        if not fpath.name.startswith('places_'):
            continue
        for r in load(fpath, report):
            if not isinstance(r, dict):
                continue
            area = as_text(r.get('area')) or as_text(r.get('province'))
            prov = canon_prov(r.get('province')) or canon_prov(area)
            if not area or not prov:
                report['unknown_province'].append({'place': area, 'province': r.get('province')})
                continue
            area = re.sub(r'\s*-\s*', '–', area) if r.get('level') == 'cluster' else area
            pid = slug(area)
            if pid in pseen:
                continue
            pseen.add(pid)
            focus = r.get('focus') if isinstance(r.get('focus'), dict) else {'product': as_text(r.get('focus'))}
            fobj = {
                'product': as_text(focus.get('product')), 'hs': as_list(focus.get('hs')),
                'why': as_text(focus.get('why')), 'fit': (as_text(focus.get('fit')) or '').lower() or None,
            }
            for where, old, new, _why in TEXT_FIXES:
                if where == 'place:' + area and fobj.get('why') and old in fobj['why']:
                    fobj['why'] = fobj['why'].replace(old, new)
                    report.setdefault('text_fixes', []).append(where)
            fobj['short'] = short_label(fobj['product'])
            fobj['family'] = classify(fobj['product'], fobj['short'])
            also = []
            for a in (r.get('also') or []):
                if isinstance(a, dict) and a.get('product'):
                    also.append({'product': as_text(a.get('product')), 'hs': as_list(a.get('hs')),
                                 'why': as_text(a.get('why')), 'fit': (as_text(a.get('fit')) or '').lower() or None})
                elif isinstance(a, str) and a.strip():
                    also.append({'product': a.strip(), 'hs': [], 'why': None, 'fit': None})
            # The public map stays civilian: a weapons or ammunition pick is swapped
            # for the first civilian runner-up and kept in the report for Luca.
            if re.search(RX_ARMS, fobj['product'] or ''):
                civil = [a for a in also if not re.search(RX_ARMS, a['product'] or '')]
                report['civilian_swaps'].append({'place': area, 'was': fobj['product'],
                                                 'now': civil[0]['product'] if civil else None})
                if civil:
                    swap = civil.pop(0)
                    swap['short'] = short_label(swap['product'])
                    swap['family'] = classify(swap['product'], swap['short'])
                    fobj = swap
                also = civil
            else:
                also = [a for a in also if not re.search(RX_ARMS, a['product'] or '')]
            if area in LABELS:
                fobj['short'], fobj['family'] = LABELS[area]
            level = 'cluster' if (as_text(r.get('level')) or '').lower() == 'cluster' else 'province'
            place = {
                'id': pid, 'area': area, 'province': prov, 'level': level,
                'island': ISLAND_OF.get(prov, 'Other'),
                'focus': fobj, 'also': also[:2],
                'anchor_buyers': as_list(r.get('anchor_buyers')), 'local_inputs': as_list(r.get('local_inputs')),
                'clusters': as_list(r.get('clusters')),
                'official_designation': as_text(r.get('official_designation')),
                'umk_2026': as_text(r.get('umk_2026')), 'skills': as_text(r.get('skills')),
                'confidence': (as_text(r.get('confidence')) or '').lower() or None,
                'sources': [u for u in as_list(r.get('sources')) if is_url(u)],
                'from': fpath.name,
            }
            town = ANCHOR.get(area) or ANCHOR.get(area.lower()) or (ANCHOR.get(prov) if level == 'province' else None) \
                or clean_city(re.split(r'[–\-]', area)[0])
            hit = geo.find(town, prov)
            if hit:
                place.update({'lat': hit['lat'], 'lon': hit['lon'], 'anchor': town})
            else:
                place.update({'lat': None, 'lon': None, 'anchor': town})
                report['places_unplaced'].append(area)
            places.append(place)

    # firm pins: city first, the province's anchor town as an honest fallback
    for f in firms:
        hit, kind = None, None
        if f['city']:
            hit, kind = geo.find(clean_city(f['city']), f['province']), 'city'
        if not hit and f['province']:
            hit, kind = geo.find(FALLBACK.get(f['province'], f['province']), f['province']), 'province'
        if hit:
            f['lat'], f['lon'], f['geo_kind'] = hit['lat'], hit['lon'], kind
        else:
            f['lat'] = f['lon'] = f['geo_kind'] = None
            report['firms_unplaced'] += 1
    geo.save()

    by_prov = {}
    for f in firms:
        if f['province']:
            by_prov[f['province']] = by_prov.get(f['province'], 0) + 1
    for p in places:
        p['firms_n'] = by_prov.get(p['province'], 0)
    places.sort(key=lambda p: (ISLAND_ORDER.get(p['island'], 99), p['lon'] if p['lon'] is not None else 999))

    fam_count = {}
    for p in places:
        fam_count[p['focus']['family']] = fam_count.get(p['focus']['family'], 0) + 1
    families = [{'key': k, 'label': l, 'color': c, 'count': fam_count.get(k, 0)} for k, l, c, _ in FAMILIES]
    families.append({'key': FAM_OTHER[0], 'label': FAM_OTHER[1], 'color': FAM_OTHER[2], 'count': fam_count.get('other', 0)})
    kind_count = {}
    for f in firms:
        kind_count[f['kind']] = kind_count.get(f['kind'], 0) + 1
    kinds = sorted([{'key': k, 'label': v, 'count': kind_count.get(k, 0)} for k, v in KINDS.items()],
                   key=lambda k: -k['count'])
    by_tier = {k: sum(1 for f in firms if f['tier'] == k) for k in TIER_META}

    markets, clusters_world = [], []
    for fpath in files:
        if fpath.name.startswith('markets_'):
            for r in load(fpath, report):
                if isinstance(r, dict):
                    r['from'] = fpath.name
                    markets.append(r)
        elif fpath.name.startswith('clusters_'):
            clusters_world += [r for r in load(fpath, report) if isinstance(r, dict)]

    n = len(firms)
    cov = {
        'city': sum(1 for f in firms if f['city']), 'capabilities': sum(1 for f in firms if f['capabilities']),
        'makes': sum(1 for f in firms if f['makes']), 'serves': sum(1 for f in firms if f['serves']),
        'certs': sum(1 for f in firms if f['certs']), 'website': sum(1 for f in firms if f['website']),
        'source_url': n,
    }
    totals = {
        'firms': n, 'firm_provinces': len(by_prov),
        'firms_mapped': sum(1 for f in firms if f['lat'] is not None),
        'firms_unmapped': sum(1 for f in firms if f['lat'] is None),
        'with_3d': sum(1 for f in firms if f['has_3d']),
        'places': len(places), 'provinces': len({p['province'] for p in places}),
        'clusters': sum(1 for p in places if p['level'] == 'cluster'),
        'focus_products': len({(p['focus']['product'] or '').lower() for p in places if p['focus']['product']}),
        'coverage': cov,
    }
    doc = {
        'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'totals': totals, 'by_tier': by_tier, 'kinds': kinds, 'families': families,
        'places': places, 'firms': firms, 'markets': markets, 'clusters_world': clusters_world,
        'method': {
            'tier_meta': TIER_META,
            'sources_note': 'Twenty research passes on 16 Oct 2026 (UTC), one per region or product family, read public '
                            'sources only: company websites, ministry and regional-government releases, Kemenperin\'s TKDN '
                            'certificate search, industrial-estate tenant lists, association member lists, business '
                            'directories and regional news. Sites whose robots.txt blocks AI agents were not fetched. '
                            'Every firm row links to the page it came from; rows without a source link were dropped at import, '
                            'and duplicates found by more than one pass were merged.',
            'focus_note': 'Each regional pass proposed one focus product per province or Java cluster, plus up to two '
                          'runners-up, from four signals: local buyers that import the part today, firms that can already '
                          'make it, inputs nearby, and any core industry the government designates there (Kemenperin\'s '
                          'KIID, regency "produk unggulan", special economic zones). Confidence is the researcher\'s: high '
                          'where the signals line up, low where capacity is thin. The picks are research judgement, not an '
                          'official plan.',
        },
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
    report['counts'] = {'raw_firm_rows': len(raw), 'firms': n, 'places': len(places), 'markets': len(markets),
                        'clusters_world': len(clusters_world), 'geocode_calls': geo.calls}
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1))
    print(json.dumps(report['counts']), '| dropped (no source):', len(report['dropped_no_source']),
          '| merged:', len(report['merged_duplicates']), '| places unplaced:', report['places_unplaced'],
          '| firms unplaced:', report['firms_unplaced'], '| bad files:', report['bad_files'])


if __name__ == '__main__':
    main()
