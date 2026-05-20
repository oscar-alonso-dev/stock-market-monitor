"""
debug9_token.py
Captura TODAS las respuestas de Morningstar y muestra los tokens y URLs completas.
El token que necesitamos está en la URL de securityMetaData como access_token=eyJ...
"""
import json, re, time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

opts = Options()
opts.add_argument("--no-sandbox")
opts.add_argument("--window-size=1400,800")
opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36")
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_experimental_option("excludeSwitches", ["enable-automation"])
opts.add_experimental_option("useAutomationExtension", False)

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": """
    window._reqs  = [];
    window._resps = {};
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        window._reqs.push(url);
        return origFetch.apply(this, args).then(r => {
            r.clone().text().then(b => { if (b.length > 5) window._resps[url] = b.substring(0,8000); });
            return r;
        });
    };
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m,url){ this._url=url; window._reqs.push(url); return origOpen.apply(this,arguments); };
    XMLHttpRequest.prototype.send = function(b){
        this.addEventListener('load', function(){ if(this._url&&this.responseText) window._resps[this._url]=this.responseText.substring(0,8000); });
        return origSend.apply(this,arguments);
    };
"""})

try:
    driver.get("https://global.morningstar.com/es/inversiones/fondos/0P00019W2R/cotizacion")
    print("Esperando 15s...")
    time.sleep(15)

    reqs  = driver.execute_script("return window._reqs || [];")
    resps = driver.execute_script("return window._resps || {};")

    print(f"\nTotal peticiones: {len(reqs)}")
    print(f"Total respuestas: {len(resps)}")

    # Mostrar TODAS las URLs de peticiones
    print("\n=== TODAS LAS URLS ===")
    for url in reqs:
        print(f"  {url[:120]}")

    # Buscar tokens en URLs
    print("\n=== TOKENS EN URLs ===")
    for url in reqs:
        m = re.search(r'access_token=(eyJ[A-Za-z0-9\-_\.]+)', url)
        if m:
            print(f"  URL: {url[:80]}")
            print(f"  TOKEN COMPLETO: {m.group(1)}")

    # Mostrar respuesta OAuth completa
    print("\n=== RESPUESTAS OAuth ===")
    for url, body in resps.items():
        if "oauth" in url.lower() or "token" in url.lower():
            print(f"  URL: {url}")
            print(f"  BODY: {body[:500]}")

    # Guardar todo a archivo para inspección
    with open("debug9_output.json","w",encoding="utf-8") as f:
        json.dump({"requests": reqs, "responses": {k:v for k,v in resps.items()}}, f, ensure_ascii=False, indent=2)
    print("\nGuardado en debug9_output.json")

finally:
    driver.quit()
