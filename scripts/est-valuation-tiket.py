#!/usr/bin/env python3
"""Estimate a standalone valuation for tiket.com, which has none disclosed.

tiket.com has had no independent mark since Blibli (PT Global Digital Niaga)
bought 100% of it on 12 Jun 2017 for an undisclosed sum. Its parent is listed
(IDX: BELI), but BELI does not report travel as its own segment — the OTA sits
inside "3P Retail" together with the third-party marketplace, so the carve-out
has to be reasoned, not read off a line.

Two independent routes are run and reconciled. Every input is a sourced public
figure or an explicitly named assumption; the assumptions are the whole reason
this is published as an estimate and never as a disclosed valuation.

Run: python3 scripts/est-valuation-tiket.py
"""

# ---- sourced inputs --------------------------------------------------------
FX = 17_701                 # IDR/USD, the census method's own parameter
BELI_MCAP_IDR_T = 35.68     # stockanalysis.com, 28 Aug 2026
BELI_EV_IDR_T = 36.51       # idem
# Blibli FY25 earnings release, "Selected Segmental Metrics" (Rp bn)
FY25 = {
    'tpv':  {'1p': 6_413, '3p': 53_187, 'inst': 15_291, 'stores': 8_425, 'total': 83_316},
    'gpbd': {'1p': 1_500, '3p':  2_847, 'inst':    991, 'stores': 1_745, 'total':  7_083},
}
ID_ONLINE_TRAVEL_USD_B = 9.0    # Indonesia online travel gross bookings 2025 (WiT)
SHARE_TIKET = 0.21              # share of Indonesian online booking value (Databoks/Katadata)
SHARE_TRAVELOKA = 0.51          # idem
TRAVELOKA_VAL_USD_M = 2_750     # already in the census (Tracxn current valuation)

# ---- named assumptions -----------------------------------------------------
TRAVELOKA_ID_SHARE_OF_VALUE = 0.65   # Traveloka is regional; only part of its
                                     # value is the Indonesian business
OTA_SHARE_OF_3P_GPBD = 0.60          # OTA's cut of the blended 3P segment profit
TRAVEL_MULTIPLE_PREMIUM = 1.25       # asset-light travel earns more than 3P
                                     # e-commerce, so an equal-multiple carve-out
                                     # of group EV understates it

usd_m = lambda idr_bn: idr_bn * 1e9 / FX / 1e6

print('INPUTS')
print(f'  BELI market cap   Rp {BELI_MCAP_IDR_T:.2f}T  = US${BELI_MCAP_IDR_T*1e12/FX/1e9:.2f}B')
print(f'  BELI EV           Rp {BELI_EV_IDR_T:.2f}T  = US${BELI_EV_IDR_T*1e12/FX/1e9:.2f}B')
gbv_usd_b = ID_ONLINE_TRAVEL_USD_B * SHARE_TIKET
print(f'  tiket.com GBV     US${gbv_usd_b:.2f}B  ({SHARE_TIKET:.0%} of a US${ID_ONLINE_TRAVEL_USD_B:.0f}B market)')
print(f'                    = Rp {gbv_usd_b*1e9*FX/1e12:.1f}T, i.e. '
      f'{gbv_usd_b*1e9*FX/1e9/FY25["tpv"]["3p"]:.0%} of the 3P Retail TPV it is reported inside')

# ---- route 1: anchor on Traveloka, the same-market listed-in-census comp ----
r1 = TRAVELOKA_VAL_USD_M * TRAVELOKA_ID_SHARE_OF_VALUE * (SHARE_TIKET / SHARE_TRAVELOKA)
print('\nROUTE 1 — Traveloka comp, scaled by Indonesian booking-value share')
print(f'  {TRAVELOKA_VAL_USD_M} x {TRAVELOKA_ID_SHARE_OF_VALUE} x ({SHARE_TIKET}/{SHARE_TRAVELOKA})'
      f' = US${r1:,.0f}M')
for s in (0.55, 0.65, 0.75):
    print(f'    if Traveloka is {s:.0%} Indonesian: US${TRAVELOKA_VAL_USD_M*s*(SHARE_TIKET/SHARE_TRAVELOKA):,.0f}M')

# ---- route 2: carve the OTA out of BELI's enterprise value -----------------
ev_bn = BELI_EV_IDR_T * 1000
share_3p = FY25['gpbd']['3p'] / FY25['gpbd']['total']
ev_3p = ev_bn * share_3p
ev_ota = ev_3p * OTA_SHARE_OF_3P_GPBD
r2_flat = usd_m(ev_ota)
r2 = r2_flat * TRAVEL_MULTIPLE_PREMIUM
print('\nROUTE 2 — carve-out of BELI enterprise value by segment gross profit')
print(f'  3P Retail is {share_3p:.1%} of group GPBD -> Rp {ev_3p/1000:.2f}T of EV')
print(f'  OTA at {OTA_SHARE_OF_3P_GPBD:.0%} of that     -> Rp {ev_ota/1000:.2f}T = US${r2_flat:,.0f}M')
print(f'  x{TRAVEL_MULTIPLE_PREMIUM} travel premium      -> US${r2:,.0f}M')

# ---- reconcile -------------------------------------------------------------
lo, hi = min(r1, r2_flat), max(r1, r2)
mid = (r1 + r2) / 2                      # mean of the two preferred routes
point = int(mid // 50 * 50)              # round DOWN: every assumption above
                                         # leans generous, so do not round up
print('\nRECONCILED')
print(f'  range      US${lo:,.0f}M – US${hi:,.0f}M')
print(f'  midpoint   US${mid:,.0f}M -> published as US${point:,.0f}M (rounded down)')
print(f'  implied EV/GBV {point/1000/gbv_usd_b:.2f}x  '
      '(OTA peers: Expedia ~0.23x, Trip.com ~0.30x, Despegar ~0.32x, Booking/MMT ~1.0x)')
print(f'\n  NB double-count: the census Blibli row carries US${BELI_MCAP_IDR_T*1e12/FX/1e6:,.0f}M,'
      ' the market cap of the group that OWNS tiket.com.\n'
      '  The two rows overlap by this estimate — both notes must say so.')
