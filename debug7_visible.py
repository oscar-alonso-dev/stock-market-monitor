"""
debug7_visible.py
Abre Chrome VISIBLE (no headless) e intercepta las peticiones XHR
inyectando JavaScript antes de que la página cargue.
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
# SIN --headless para ver qué pasa
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1400,900")
opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36")
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_experimental_option("excludeSwitches", ["enable-automation"])
opts.add_experimental_option("useAutomationExtension", False)

# Interceptar XHR con JS antes de que cargue la página
opts.add_argument("--auto-open-devtools-for-tabs")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

# Inyectar script para capturar todas las peticiones fetch/XHR
driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
    "source": """
    window._capturedRequests = [];
    window._capturedResponses = {};
    
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        window._capturedRequests.push({type: 'fetch', url: url});
        return origFetch.apply(this, args).then(r => {
            const clone = r.clone();
            clone.text().then(body => {
                if (body.length > 10 && body.length < 100000) {
                    window._capturedResponses[url] = body.substring(0, 2000);
                }
            });
            return r;
        });
    };
    
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        window._capturedRequests.push({type: 'xhr', url: url});
        return origOpen.apply(this, arguments);
    };
    """
})

try:
    print(f"Abriendo Chrome visible: {URL}")
    print("Espera 15 segundos mientras carga...")
    driver.get(URL)
    time.sleep(15)

    print(f"\nURL actual: {driver.current_url}")
    print(f"Título: {driver.title}")
    
    src = driver.page_source
    print(f"HTML length: {len(src)}")

    # Obtener las peticiones capturadas
    requests_made = driver.execute_script("return window._capturedRequests || [];")
    responses     = driver.execute_script("return window._capturedResponses || {};")

    print(f"\n=== Peticiones capturadas: {len(requests_made)} ===")
    for req in requests_made:
        url = req.get('url', '')
        if 'morningstar' in url.lower() or 'api' in url.lower():
            in_resp = '✅' if url in responses else '  '
            print(f"  {in_resp} [{req['type']}] {url[:120]}")

    print(f"\n=== Respuestas con datos ({len(responses)}) ===")
    for url, body in list(responses.items())[:20]:
        if any(kw in url.lower() for kw in ['api', 'morningstar', 'data', 'fund', 'sal']):
            print(f"\n  URL: {url[:100]}")
            print(f"  Body: {body[:400]}")

    # También intentar leer datos del DOM
    print(f"\n=== Texto visible en página ===")
    try:
        body_text = driver.find_element(By.TAG_NAME, "body").text
        print(f"Texto total: {len(body_text)} chars")
        # Buscar números que parezcan NAVs
        lines = [l.strip() for l in body_text.split('\n') if l.strip()]
        for line in lines[:50]:
            if any(c.isdigit() for c in line) and len(line) < 100:
                print(f"  {line}")
    except Exception as e:
        print(f"Error: {e}")

    # Guardar HTML
    with open("page_visible.html", "w", encoding="utf-8") as f:
        f.write(src)
    print("\nHTML guardado en page_visible.html")
    
    # Buscar en el HTML patrones de datos
    print("\n=== Patrones en HTML ===")
    for pat_name, pat in [
        ("nav/price numbers", r'"(?:nav|price|closePrice|lastPrice|value)"\s*:\s*(\d+\.?\d*)'),
        ("return numbers",    r'"(?:return\w+|ret\w+)"\s*:\s*([+\-]?\d+\.?\d*)'),
        ("JSON con cobas",    r'.{0,100}[Cc]obas.{0,200}'),
    ]:
        found = re.findall(pat, src, re.IGNORECASE)
        if found:
            print(f"  {pat_name}: {found[:5]}")

finally:
    print("\nCerrando Chrome en 3 segundos...")
    time.sleep(3)
    driver.quit()
