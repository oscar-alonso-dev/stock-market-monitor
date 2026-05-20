"""
debug5_network.py
Intercepta las peticiones XHR que hace global.morningstar.com
para encontrar los endpoints de datos.
"""
import time, json, re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

PI = "0P00019W2R"  # Cobas Internacional C FI
URL = f"https://global.morningstar.com/es/inversiones/fondos/{PI}/cotizacion"

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1920,1080")
opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36")
# Activar logging de red
opts.set_capability("goog:loggingPrefs", {"performance": "ALL"})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

try:
    print(f"Cargando {URL}")
    driver.get(URL)
    print("Esperando 12 segundos...")
    time.sleep(12)

    # Recoger todas las peticiones de red
    logs = driver.get_log("performance")
    print(f"\nTotal eventos de red: {len(logs)}")

    api_calls = []
    for log in logs:
        try:
            msg = json.loads(log["message"])["message"]
            method = msg.get("method", "")

            if method == "Network.responseReceived":
                url = msg["params"]["response"]["url"]
                status = msg["params"]["response"]["status"]
                ctype = msg["params"]["response"].get("mimeType", "")
                if status == 200 and ("api" in url or "sal-service" in url or "ecint" in url or
                                       "graphql" in url or "json" in url.lower() or
                                       "morningstar" in url) and "favicon" not in url and "font" not in url and "css" not in url:
                    api_calls.append({
                        "url": url,
                        "status": status,
                        "type": ctype,
                        "request_id": msg["params"].get("requestId", "")
                    })
        except:
            pass

    print(f"\n=== APIs llamadas ({len(api_calls)}) ===")
    for call in api_calls:
        print(f"  ✅ {call['status']} [{call['type'][:20]}] {call['url'][:120]}")

    # Intentar obtener el body de las respuestas JSON importantes
    print(f"\n=== Respuestas JSON ===")
    for call in api_calls:
        if "json" in call["type"].lower() or "graphql" in call["url"] or "api" in call["url"]:
            try:
                result = driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": call["request_id"]})
                body = result.get("body", "")
                if body and len(body) > 10:
                    print(f"\nURL: {call['url'][:100]}")
                    print(f"Body ({len(body)} chars): {body[:500]}")
            except Exception as e:
                pass

    # También buscar datos en el HTML final
    print(f"\n=== Datos en el HTML ===")
    src = driver.page_source

    # Buscar patrones de datos financieros
    patterns = {
        "NAV": r'"nav"\s*:\s*"?(\d+[.,]\d+)"?',
        "Price": r'"price"\s*:\s*"?(\d+[.,]\d+)"?',
        "Return1Month": r'"return1Month"\s*:\s*"?([+\-]?\d+[.,]\d+)"?',
        "Return1Year": r'"return1Year"\s*:\s*"?([+\-]?\d+[.,]\d+)"?',
        "DailyReturn": r'"dailyReturn"\s*:\s*"?([+\-]?\d+[.,]\d+)"?',
        "closePrice": r'"closePrice"\s*:\s*"?(\d+[.,]\d+)"?',
        "lastPrice": r'"lastPrice"\s*:\s*"?(\d+[.,]\d+)"?',
    }
    for name, pat in patterns.items():
        m = re.search(pat, src, re.IGNORECASE)
        if m:
            print(f"  {name}: {m.group(1)}")

    # Buscar bloques JSON en el HTML (window.__nuxt__ o similar)
    for varname in ["__nuxt__", "__NUXT__", "window.__STATE__", "initialData", "pageData"]:
        if varname in src:
            idx = src.index(varname)
            snippet = src[idx:idx+200]
            print(f"\n  Encontrado '{varname}': {snippet[:150]}")

finally:
    driver.quit()
    print("\nDone.")
