"""
debug4_selenium.py
Comprueba qué devuelve Morningstar con Selenium y JS.
"""
import time, re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

PI = "0P00019W2R"  # Cobas Internacional C FI

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1920,1080")
opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36")
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_experimental_option("excludeSwitches", ["enable-automation"])

service = Service(ChromeDriverManager().install())
driver  = webdriver.Chrome(service=service, options=opts)

try:
    url = f"https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id={PI}"
    print(f"Cargando: {url}")
    driver.get(url)

    # Esperar 15 segundos y ver qué hay
    for i in range(15):
        src = driver.page_source
        print(f"  t={i+1}s | len={len(src)} | title={driver.title[:50]}")
        if len(src) > 3000:
            break
        time.sleep(1)

    src = driver.page_source
    print(f"\nLongitud final HTML: {len(src)}")
    print(f"Título: {driver.title}")
    print(f"URL actual: {driver.current_url}")
    print(f"\n--- HTML primeros 2000 chars ---")
    print(src[:2000])
    print(f"\n--- HTML últimos 500 chars ---")
    print(src[-500:])

    # Buscar cualquier número que parezca un NAV
    navs = re.findall(r'\b[0-9]{1,4}[,\.][0-9]{2,4}\b', src)
    print(f"\nNúmeros encontrados (posibles NAVs): {navs[:20]}")

    # Buscar palabras clave financieras
    for kw in ['nav', 'Nav', 'NAV', 'return', 'Return', 'rentabilidad', 'liquidativo', 'cobas']:
        if kw.lower() in src.lower():
            idx = src.lower().index(kw.lower())
            print(f"  '{kw}' encontrado en pos {idx}: ...{src[max(0,idx-30):idx+80]}...")

    # Interceptar XHR - ver qué peticiones hace la página
    print("\n--- Network requests (performance log) ---")
    try:
        opts2 = Options()
        opts2.add_argument("--headless=new")
        opts2.add_argument("--no-sandbox")
        opts2.add_argument("--window-size=1920,1080")
        opts2.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        driver2 = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts2)
        driver2.get(url)
        time.sleep(8)
        logs = driver2.get_log('performance')
        for log in logs:
            import json
            msg = json.loads(log['message'])['message']
            if msg.get('method') == 'Network.responseReceived':
                req_url = msg.get('params', {}).get('response', {}).get('url', '')
                status  = msg.get('params', {}).get('response', {}).get('status', '')
                if 'morningstar' in req_url and status == 200 and len(req_url) > 30:
                    print(f"  ✅ {status} {req_url[:100]}")
        driver2.quit()
    except Exception as e:
        print(f"  Error network log: {e}")

finally:
    driver.quit()
