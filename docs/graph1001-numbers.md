# 1001 company graph: the numbers (21 Oct 2026, first build)

Built by `scripts/graph1001-build.js` from the files the site already shows, on branch `1001-company-graph`. **Not live.** Rebuilt at any time, no restart needed.

## What went in

| Dataset | Records |
|---|---|
| Startups (census) | 499 startups, 632 investors named on their rows, 173 outside companies from /chain |
| BUMN | 56 BUMN, 946 subsidiary rows |
| Data centres | 72 projects, 610 people and companies in the 8 company webs |
| Peering | 204 buildings, 80 exchanges, 1,530 networks |
| Exporters | 1,410 exporters (name, place, sector only, never email or phone) |
| Named only in a link | 667 (power suppliers, vendors, tie partners) |

## One ID per company

- **6,879 records become 6,399 IDs** (5,963 companies, 436 places: projects, buildings, exchanges, campuses).
- **Reviewed alias list:** 307 groups merge 787 records into one ID each. Another 52 records were checked and kept apart (for example Telin vs Telin Hong Kong, PDG vs its two holding companies, AWS vs its Indonesian company). 73 near-miss pairs are written down as "not the same" with the reason (SIG on startup rows is Susquehanna, not Semen Indonesia).
- **Open candidates left: 0.** A new name match after a data change shows up in `data/graph1001-report.json` and is never merged until someone reviews it.

## Companies in two or more of the five datasets: 91 (before: 0)

| In | Companies |
|---|---|
| 2 datasets | 76 |
| 3 datasets | 14 |
| all of startups, BUMN, data centres, peering | 1 (Telkom Indonesia) |

Shared companies by pair: data centres + startups 34, BUMN + data centres 23, data centres + peering 19, BUMN + startups 17, peering + startups 17, BUMN + peering 10, exporters + startups 2, BUMN + exporters 2, data centres + exporters 0, exporters + peering 0.

Examples: **LinkAja** (census startup = KAI's Fintek Karya Nusantara), **Elitery** (startup = data-centre operator), **Kaskus, Hostnic, Cashlez, IDCloudHost, Herza Cloud** (startups with their own internet network), **MDI, BRI, BNI, Mandiri Capital, Telkomsel Ventures** (BUMN companies that invest in census startups), **Sinkona, Perindo** (BUMN companies that export).

## Links

- **14,031 links**, each with its source: 3,086 carry the web address of the filing or page they came from; the rest point to the 1001 page they were read from (the census rows, the data-centre map, the peering map).
- By kind: 4,903 peers at an exchange, 4,111 network in a building, 1,273 invests in, 987 owns, 882 works with (/chain), 836 data-centre web links, 356 operates, 225 exchange switch in a building, 204 BUMN ties, 114 supplies, 74 peering building = 1001 data-centre project, 63 supplies power, 3 tenant of.
- **Links that join datasets: 1,723** (before: 259, the BUMN ties and the 74 building = project matches).

## Where it's still thin

- **Exporters connect to almost nothing** (8 of 1,404): the exporter list has no link data, only names and places. Four merges are all there is: Erigo and Aruna (startups), Perindo and Sinkona (BUMN companies).
- **Peering**: 37 of the 1,505 networks reach another dataset directly. Most are small ISPs that appear nowhere else.
- 499 companies are known only from being named in one link (a vendor, a power supplier). They have no page of their own.

## Biggest hubs (links)

PLN 151 · NeutraDC 97 · Pertamina Hulu Energi 77 · SM+ Data Centers 71 · East Ventures 69 · Princeton Digital Group 57 · Blibli 55 · BDx Indonesia 49 · GoTo 47 · Xurya 46.
