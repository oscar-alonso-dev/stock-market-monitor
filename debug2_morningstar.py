"""
debug2_morningstar.py
"""
import requests, re, json

headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*',
    'Accept-Language': 'es-ES,es;q=0.9',
}

# ── 1. Buscar el token en páginas actuales de Morningstar ─────────────────────
print("=== BUSCANDO TOKEN ===")
token_pages = [
    "https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id=F0GBR04S23",
    "https://www.morningstar.es/es/etf/snapshot/snapshot.aspx?id=0P0001B3YZ",
    "https://www.morningstar.co.uk/uk/funds/snapshot/snapshot.aspx?id=F00000NOM7",
    "https://www.morningstar.com/funds/xmad/0P0000C5UZ/quote",
]
for url in token_pages:
    try:
        r = requests.get(url, headers=headers, timeout=15)
        print(f"\n{url[:70]}")
        print(f"Status: {r.status_code} | Len: {len(r.text)}")
        # Buscar cualquier token/jwt en el HTML
        for pat in ['tokenMaaS', 'tokenMaas', 'bearer', 'Bearer', 'jwt', 'clientId', 'MDC_intl', 'sal-service', 'us-api']:
            found = re.findall(rf'.{{0,30}}{pat}.{{0,80}}', r.text, re.IGNORECASE)
            for f in found[:2]:
                print(f"  [{pat}] {f.strip()}")
    except Exception as e:
        print(f"  ERROR: {e}")

# ── 2. Ver respuesta completa del buscador ────────────────────────────────────
print("\n\n=== BUSCADOR MORNINGSTAR (respuesta completa) ===")
search_urls = [
    "https://www.morningstar.es/es/util/SecuritySearch.ashx?q=Cobas&limit=3&universeIds=FOESP$$ALL",
    "https://www.morningstar.es/es/util/SecuritySearch.ashx?q=ES0169107098&limit=3",
    "https://www.morningstar.es/es/util/SecuritySearch.ashx?q=cobas%20internacional&limit=3",
]
for url in search_urls:
    try:
        r = requests.get(url, headers={**headers, 'Referer': 'https://www.morningstar.es/'}, timeout=10)
        print(f"\n{url[-60:]}")
        print(f"Status: {r.status_code}")
        print(f"Respuesta: [{r.text[:300]}]")
    except Exception as e:
        print(f"  ERROR: {e}")

# ── 3. Probar APIs REST de Morningstar con distintos endpoints ────────────────
print("\n\n=== APIS REST MORNINGSTAR ===")
api_urls = [
    "https://www.morningstar.es/api/rest.svc/klr5zyak8x/fund/snapshot?id=F0GBR04S23",
    "https://www.morningstar.es/api/rest.svc/timeseries_capi/ti?region=esp&culture=es-ES&persistViewMode=1&currentView=1&id=F0GBR04S23&idtype=morningstarid",
    "https://api.morningstar.com/ecint/v1/securities/ES0169107098?viewid=snapshot&idtype=isin",
    "https://www.morningstar.es/api/rest.svc/klr5zyak8x/security/screener?page=1&pageSize=5&sortOrder=LegalName asc&outputType=json&version=1&languageId=es-ES&currencyId=EUR&universeIds=FOESP$$ALL&securityDataPoints=SecId,LegalName,Nav,ReturnM1,ReturnM12",
]
for url in api_urls:
    try:
        r = requests.get(url, headers={**headers, 'Referer': 'https://www.morningstar.es/'}, timeout=10)
        print(f"\n{url[:80]}")
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print(f"✅ RESPUESTA: {r.text[:400]}")
    except Exception as e:
        print(f"  ERROR: {e}")

# ── 4. Screener sin autenticación ─────────────────────────────────────────────
print("\n\n=== SCREENER SIN AUTH ===")
screener = "https://www.morningstar.es/api/rest.svc/klr5zyak8x/security/screener"
params = {
    "page": 1, "pageSize": 3, "sortOrder": "LegalName asc",
    "outputType": "json", "version": 1,
    "languageId": "es-ES", "currencyId": "EUR",
    "universeIds": "FOESP$$ALL",
    "securityDataPoints": "SecId,LegalName,Nav,ReturnM1,ReturnM12,ReturnM36",
}
try:
    r = requests.get(screener, headers={**headers, 'Referer': 'https://www.morningstar.es/'}, params=params, timeout=10)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        print(f"✅ DATOS: {r.text[:600]}")
    else:
        print(f"Respuesta: {r.text[:200]}")
except Exception as e:
    print(f"ERROR: {e}")
