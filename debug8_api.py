"""
debug8_api.py - Prueba las APIs de Morningstar directamente sin token
"""
import requests, json

FI = "F00000YN5R"  # Cobas Internacional C FI — sabemos que es correcto del debug7

HDRS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9",
    "Origin": "https://global.morningstar.com",
    "Referer": "https://global.morningstar.com/es/inversiones/fondos/0P00019W2R/cotizacion",
}

API = "https://api-global.morningstar.com/sal-service/v1"
P   = {"locale":"es","clientId":"INTLCOM","benchmarkId":"category","version":"3.42.0"}

apis = [
    ("quote",    f"{API}/fund/quote/v7/{FI}/data",          {**P,"fundServCode":"","showAnalystRatingChinaFund":"false"}),
    ("trailing", f"{API}/fund/trailingReturn/v3/{FI}/data", {**P,"duration":"quarterly","limitAge":""}),
    ("meta",     f"{API}/fund/securityMetaData/{FI}",       {**P}),
    ("chart",    f"{API}/fund/data/performance/chart",      {**P,"shareClassId":FI,"secExchangeList":""}),
]

for name, url, params in apis:
    r = requests.get(url, params=params, headers=HDRS, timeout=12)
    print(f"\n{name}: {r.status_code}")
    if r.status_code == 200:
        print(f"  DATOS: {r.text[:300]}")
    else:
        print(f"  ERROR: {r.text[:200]}")
