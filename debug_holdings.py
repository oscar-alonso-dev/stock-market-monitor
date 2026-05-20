"""
debug_holdings.py - Ver qué devuelve el endpoint de posiciones
"""
import json, re, time
from pathlib import Path

# Leer token guardado
token_path = Path("app/data/ms_token.txt")
if not token_path.exists():
    print("No hay token. Ejecuta el scraper primero.")
    exit()

token = token_path.read_text().strip()
fi = "F00000YN5R"  # Cobas Internacional C

import requests
API = "https://api-global.morningstar.com/sal-service/v1"
HDRS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://global.morningstar.com",
    "Referer": "https://global.morningstar.com/",
}
params = {
    "locale": "es", "clientId": "INTLCOM",
    "benchmarkId": "mstarorcat", "version": "4.86.0",
    "access_token": token, "secId": fi,
    "premiumNum": "10", "freeNum": "10",
}

r = requests.get(f"{API}/fund/portfolio/holding/v2/{fi}/data", params=params, headers=HDRS, timeout=15)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"Tipo respuesta: {type(data)}")
    if isinstance(data, dict):
        print(f"Keys: {list(data.keys())}")
        for k in data.keys():
            v = data[k]
            print(f"  {k}: {str(v)[:200]}")
    elif isinstance(data, list):
        print(f"Lista de {len(data)} elementos")
        if data:
            print(f"Primer elemento: {data[0]}")
    # Guardar respuesta completa
    with open("holdings_debug.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("\nGuardado en holdings_debug.json")
else:
    print(r.text[:300])
