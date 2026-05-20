"""
debug_morningstar.py
Ejecuta esto y pégame el resultado completo.
"""
import requests, re, json

headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*',
    'Accept-Language': 'es-ES,es;q=0.9',
}

urls = [
    "https://www.morningstar.co.uk/Common/funds/snapshot/SustenabilitySAL.aspx?Site=uk&FC=F00000NOM7&IT=FO&LANG=en-GB&LITTLEMODE=True",
    "https://www.morningstar.es/Common/funds/snapshot/SustenabilitySAL.aspx?Site=es&FC=F0GBR04S23&IT=FO&LANG=es-ES&LITTLEMODE=True",
]

for url in urls:
    print(f"\n{'='*60}")
    print(f"URL: {url[:70]}")
    try:
        r = requests.get(url, headers=headers, timeout=15)
        print(f"Status: {r.status_code}")
        print(f"Content-Type: {r.headers.get('Content-Type','')}")
        print(f"Longitud respuesta: {len(r.text)} chars")
        # Buscar token con varios patrones
        for pat in [r'tokenMaaS', r'tokenMaas', r'Bearer', r'token', r'jwt', r'JWT']:
            found = re.findall(rf'{pat}[^\n]{{0,100}}', r.text[:5000], re.IGNORECASE)
            if found:
                print(f"  Patrón '{pat}': {found[:2]}")
        print(f"Primeros 500 chars: {r.text[:500]}")
    except Exception as e:
        print(f"ERROR: {e}")

print("\n\nProbando endpoint de datos directamente sin token...")
isin = "ES0169107098"
for url2 in [
    f"https://www.morningstar.es/es/util/SecuritySearch.ashx?q={isin}&limit=1",
    f"https://www.morningstar.co.uk/api/rest.svc/klr5zyak8x/security_details?isin={isin}&locale=en-GB",
    f"https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security_details?isin={isin}&locale=en-GB",
]:
    try:
        r = requests.get(url2, headers=headers, timeout=10)
        print(f"\nURL: {url2[:80]}")
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print(f"RESPUESTA: {r.text[:500]}")
    except Exception as e:
        print(f"ERROR: {e}")
