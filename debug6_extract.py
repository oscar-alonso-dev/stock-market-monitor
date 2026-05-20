"""
debug6_extract.py
La página global.morningstar.com tiene 5MB de HTML renderizado con SSR (server-side rendering).
Los datos están en el HTML. Vamos a extraerlos directamente.
"""
import time, json, re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

PI  = "0P00019W2R"
URL = f"https://global.morningstar.com/es/inversiones/fondos/{PI}/cotizacion"

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1920,1080")
opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

try:
    driver.get(URL)
    time.sleep(8)
    src = driver.page_source

    print(f"HTML length: {len(src)}")

    # Guardar HTML completo para inspección
    with open("morningstar_page.html", "w", encoding="utf-8") as f:
        f.write(src)
    print("HTML guardado en morningstar_page.html")

    # Buscar bloques __NUXT__ que contienen todos los datos pre-renderizados
    print("\n=== Buscando datos en __NUXT__ / SSR data ===")
    
    # En Nuxt.js los datos vienen en window.__NUXT__
    nuxt_match = re.search(r'window\.__NUXT__\s*=\s*(\{.*?\})\s*</script>', src, re.DOTALL)
    if nuxt_match:
        print(f"Encontrado __NUXT__ ({len(nuxt_match.group(1))} chars)")
        try:
            nuxt = json.loads(nuxt_match.group(1))
            print(f"Keys: {list(nuxt.keys())[:10]}")
            # Volcar a archivo
            with open("nuxt_data.json", "w", encoding="utf-8") as f:
                json.dump(nuxt, f, ensure_ascii=False, indent=2)
            print("Guardado en nuxt_data.json")
        except Exception as e:
            print(f"Error parseando: {e}")
            print(f"Primeros 500 chars: {nuxt_match.group(1)[:500]}")
    else:
        print("__NUXT__ no encontrado directamente")
        # Buscar otras variantes
        for pat in [r'__NUXT_DATA__', r'__INITIAL_STATE__', r'__STATE__', r'window\[.nuxt.\]']:
            if re.search(pat, src, re.IGNORECASE):
                print(f"  Encontrado: {pat}")

    # Buscar datos de precio en el HTML
    print("\n=== Buscando precios en HTML ===")
    
    # Buscar en scripts JSON-LD o application/json
    scripts = re.findall(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', src, re.DOTALL)
    print(f"Scripts JSON encontrados: {len(scripts)}")
    for i, s in enumerate(scripts[:5]):
        try:
            d = json.loads(s)
            print(f"  Script {i}: keys={list(d.keys())[:8] if isinstance(d, dict) else type(d)}")
            # Buscar NAV/price en este JSON
            txt = json.dumps(d)
            for key in ['nav', 'price', 'closePrice', 'lastPrice', 'return']:
                m = re.search(rf'"{key}"\s*:\s*"?([+\-]?\d+[.,]\d+)"?', txt, re.IGNORECASE)
                if m:
                    print(f"    {key}: {m.group(1)}")
        except:
            print(f"  Script {i}: no es JSON válido ({s[:50]})")

    # Buscar en elementos del DOM
    print("\n=== DOM elements ===")
    
    # Intentar encontrar el elemento con el precio
    selectors = [
        "[data-testid*='price']",
        "[data-testid*='nav']",
        ".price", ".nav-value", ".fund-price",
        "[class*='price']",
        "[class*='nav']",
        "mds-stat",
    ]
    for sel in selectors:
        try:
            els = driver.find_elements(By.CSS_SELECTOR, sel)
            if els:
                for el in els[:3]:
                    txt = el.text.strip()
                    if txt and any(c.isdigit() for c in txt):
                        print(f"  {sel}: '{txt}'")
        except:
            pass

    # Buscar cualquier número que pueda ser un NAV (entre 1 y 9999 con decimales)
    print("\n=== Todos los posibles NAVs en el HTML ===")
    # Buscar en contexto financiero
    money_patterns = re.findall(r'(?:precio|nav|valor|price|cotiz)[^0-9]{0,50}(\d{1,4}[,\.]\d{2,4})', src, re.IGNORECASE)
    print(f"Valores con contexto financiero: {money_patterns[:10]}")

    # Buscar en JSON embebido más amplio
    print("\n=== Buscar en JSON embebido (primeras ocurrencias) ===")
    # Buscar cualquier JSON grande en scripts
    big_scripts = re.findall(r'<script[^>]*>([\s\S]{500,}?)</script>', src)
    print(f"Scripts grandes: {len(big_scripts)}")
    for i, s in enumerate(big_scripts[:3]):
        if any(kw in s for kw in ['cobas', 'Cobas', 'nav', 'NAV', 'return', 'Return']):
            print(f"\n  Script {i} tiene datos relevantes ({len(s)} chars)")
            # Buscar JSON objects
            json_objs = re.findall(r'\{[^{}]{100,500}\}', s)
            for obj in json_objs[:5]:
                if any(kw in obj.lower() for kw in ['nav', 'price', 'return', 'cobas']):
                    print(f"    Objeto JSON: {obj[:200]}")

finally:
    driver.quit()
    print("\nDone. Revisa morningstar_page.html para ver el HTML completo.")
