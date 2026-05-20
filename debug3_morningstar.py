"""
debug3_morningstar.py
Ya sabemos que el buscador devuelve IDs internos (pi = 0P0001LFVM).
Ahora probamos todos los endpoints posibles con ese ID.
"""
import requests, re, json

SESSION = requests.Session()
SESSION.headers.update({
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Referer': 'https://www.morningstar.es/',
})

# El buscador nos dio:
# Cobas Internacional C FI -> buscar "cobas internacional c"
# pi (performance id) = el que necesitamos para datos

# PASO 1: Buscar el fondo y obtener su ID
print("=== PASO 1: Obtener ID del fondo ===")
r = SESSION.get(
    "https://www.morningstar.es/es/util/SecuritySearch.ashx",
    params={"q": "cobas internacional c", "limit": 5},
    timeout=10
)
print(f"Status: {r.status_code}")
print(f"Respuesta completa:\n{r.text}\n")

# Extraer el primer pi (performance ID)
pi_match = re.findall(r'"pi":"([^"]+)"', r.text)
i_match  = re.findall(r'"i":"([^"]+)"', r.text)
print(f"Performance IDs encontrados: {pi_match}")
print(f"Fund IDs encontrados: {i_match}")

if not pi_match:
    print("No se encontró ID, probando con otro nombre...")
    r2 = SESSION.get(
        "https://www.morningstar.es/es/util/SecuritySearch.ashx",
        params={"q": "cobas", "limit": 10, "universeIds": "FOESP$$ALL"},
        timeout=10
    )
    print(r2.text[:500])
    pi_match = re.findall(r'"pi":"([^"]+)"', r2.text)
    i_match  = re.findall(r'"i":"([^"]+)"', r2.text)

PI = pi_match[0] if pi_match else "0P0001LFVM"
FI = i_match[0] if i_match else "F000016A7T"
print(f"\nUsando PI={PI}, FI={FI}")

# PASO 2: Probar todos los endpoints posibles con ese ID
print(f"\n=== PASO 2: Endpoints con PI={PI} ===")

endpoints = [
    # Snapshot clásico (distintos formatos de URL)
    f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/fund/snapshot?id={PI}",
    f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/fund/snapshot?id={FI}",
    # Timeseries
    f"https://www.morningstar.es/api/rest.svc/timeseries_capi/ti?region=esp&culture=es-ES&id={PI}&idtype=morningstarid&currencyId=EUR&frequency=daily&startDate=2024-01-01&endDate=2025-01-01",
    # Performance
    f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/fund/performance/graph/1?currentView=1&id={PI}&idtype=morningstarid&CurrencyId=EUR",
    # Ratings
    f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/fund/ratings?id={PI}",
    # Datos básicos
    f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/security_details?id={PI}&idtype=morningstarid&locale=es-ES",
    # New endpoints
    f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/fund/nav/0/{PI}/data",
    f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/fund/summary/0/{PI}/data",
    # Snapshot page (devuelve 202 pero puede tener datos útiles)
    f"https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id={PI}",
    f"https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id={FI}",
]

for url in endpoints:
    try:
        r = SESSION.get(url, timeout=10)
        status = r.status_code
        if status == 200 and len(r.text) > 50:
            print(f"\n✅ {url[-70:]}")
            print(f"   Status: {status} | Len: {len(r.text)}")
            print(f"   {r.text[:300]}")
        elif status == 202:
            print(f"\n⚠️  202 {url[-70:]} | Len: {len(r.text)}")
            # Ver qué hay en los 202
            print(f"   {r.text[:200]}")
        else:
            print(f"   ❌ {status} {url[-60:]}")
    except Exception as e:
        print(f"   ERROR {url[-50:]}: {e}")

# PASO 3: Ver qué XHR hace la página snapshot cuando carga
print(f"\n\n=== PASO 3: Snapshot page content (202) ===")
r = SESSION.get(
    f"https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id={PI}",
    timeout=15
)
print(f"Status: {r.status_code} | Len: {len(r.text)}")
# Buscar URLs de API en el JavaScript
api_refs = re.findall(r'https?://[^\s"\']+morningstar[^\s"\']{5,100}', r.text)
for ref in api_refs[:10]:
    print(f"  API ref: {ref}")
# Buscar cualquier dato financiero
nav_refs = re.findall(r'[Nn][Aa][Vv][^\n]{0,100}', r.text[:3000])
for ref in nav_refs[:5]:
    print(f"  NAV ref: {ref.strip()}")
print(f"\nHTML completo primeros 1000 chars:")
print(r.text[:1000])
