"""
morningstar_scraper.py — FINAL v2
Los ETFs usan endpoint diferente: etf/quote en lugar de fund/quote
"""
import requests, json, re, time, sys
from pathlib import Path
from datetime import datetime

OUTPUT = Path("app/data/funds_cache.json")

FONDOS = [
    # type "fund" = fondo de inversión, type "etf" = ETF cotizado
    {"isin":"ES0169107098","buscar":"Cobas Internacional C FI",        "mgr":"Cobas AM",          "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0169107049","buscar":"Cobas Seleccion FI",              "mgr":"Cobas AM",          "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0169107056","buscar":"Cobas Grandes Companias FI",      "mgr":"Cobas AM",          "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0175897007","buscar":"azValor Internacional FI",        "mgr":"azValor AM",        "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0175897031","buscar":"azValor Iberia FI",               "mgr":"azValor AM",        "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0147622002","buscar":"Magallanes European Equity M FI", "mgr":"Magallanes",        "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0147622010","buscar":"Magallanes Iberian Equity M FI",  "mgr":"Magallanes",        "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180790006","buscar":"Bestinver Internacional FI",      "mgr":"Bestinver",         "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180790014","buscar":"Bestinver Bolsa FI",              "mgr":"Bestinver",         "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180790030","buscar":"Bestinver Patrimonio FI",         "mgr":"Bestinver",         "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180792002","buscar":"True Value FI",                   "mgr":"True Value AM",     "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180792028","buscar":"True Value Small Caps FI",        "mgr":"True Value AM",     "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180560009","buscar":"Valentum FI",                     "mgr":"Valentum AM",       "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180847002","buscar":"Horos Internacional FI",          "mgr":"Horos AM",          "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180717002","buscar":"Numantia Patrimonio Global FI",   "mgr":"Numantia Gestión",  "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0162870003","buscar":"Metavalor Internacional FI",      "mgr":"Metagestión",       "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0114930029","buscar":"Santander Indice Espana FI",      "mgr":"Santander AM",      "grp":"🇪🇸 Indexados España", "type":"fund"},
    {"isin":"ES0138569037","buscar":"Cartesio X FI",                   "mgr":"Cartesio",          "grp":"⚖️ Mixtos España",    "type":"fund"},
    {"isin":"ES0138569011","buscar":"Cartesio Y FI",                   "mgr":"Cartesio",          "grp":"⚖️ Mixtos España",    "type":"fund"},
    {"isin":"ES0149133000","buscar":"Belgravia Epsilon FI",            "mgr":"Belgravia Capital", "grp":"⚖️ Mixtos España",    "type":"fund"},
    {"isin":"LU0552385295","buscar":"Fundsmith Equity T EUR Acc",      "mgr":"Fundsmith",         "grp":"🌍 Globales",         "type":"fund"},
    {"isin":"IE00B19Z9505","buscar":"Seilern World Growth EUR U",      "mgr":"Seilern",           "grp":"🌍 Globales",         "type":"fund"},
    {"isin":"IE00BYX5MX67","buscar":"Fidelity Index World",            "mgr":"Fidelity",          "grp":"🇺🇸 USA",             "type":"fund"},
    {"isin":"LU0360863863","buscar":"Nordea Stable Return BP EUR",     "mgr":"Nordea",            "grp":"⚖️ Mixtos",          "type":"fund"},
    # ETFs — usan universo ETFALL y endpoint diferente
    {"isin":"IE00B4L5Y983","buscar":"iShares Core MSCI World",        "mgr":"BlackRock",         "grp":"🌍 Globales",         "type":"etf"},
    {"isin":"IE00BK5BQT80","buscar":"Vanguard FTSE All-World",        "mgr":"Vanguard",          "grp":"🌍 Globales",         "type":"etf"},
    {"isin":"IE00B5BMR087","buscar":"iShares Core S&P 500 UCITS",     "mgr":"BlackRock",         "grp":"🇺🇸 USA",             "type":"etf"},
    {"isin":"IE00B3XXRP09","buscar":"Vanguard S&P 500 UCITS",         "mgr":"Vanguard",          "grp":"🇺🇸 USA",             "type":"etf"},
    {"isin":"IE00B4K48X80","buscar":"iShares Core MSCI Europe",       "mgr":"BlackRock",         "grp":"🌍 Europa",           "type":"etf"},
    {"isin":"FR0010261198","buscar":"Amundi MSCI Europe UCITS",       "mgr":"Amundi",            "grp":"🌍 Europa",           "type":"etf"},
    {"isin":"IE00BKM4GZ66","buscar":"iShares Core MSCI EM IMI",       "mgr":"BlackRock",         "grp":"🌏 Emergentes",       "type":"etf"},
    # ── Más value español ────────────────────────────────────────────────────
    {"isin":"ES0180560017","buscar":"Valentum Flexible FI",            "mgr":"Valentum AM",       "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0180847010","buscar":"Horos Value Iberia FI",           "mgr":"Horos AM",          "grp":"💎 Value Español",    "type":"fund"},
    {"isin":"ES0109457006","buscar":"Alianza Popular Acciones FI",     "mgr":"Alianza Popular",   "grp":"💎 Value Español",    "type":"fund"},
    # ── Fondos indexados España ───────────────────────────────────────────────
    {"isin":"ES0112705018","buscar":"BBVA Bolsa Indice USA FI",        "mgr":"BBVA AM",           "grp":"🇪🇸 Indexados España", "type":"fund"},
    {"isin":"ES0138942006","buscar":"Amundi IS MSCI World AE-C",       "mgr":"Amundi",            "grp":"🇪🇸 Indexados España", "type":"fund"},
    # ── Fondos internacionales populares ──────────────────────────────────────
    {"isin":"LU0114760746","buscar":"Robeco Global Consumer Trends D", "mgr":"Robeco",            "grp":"🌍 Globales",         "type":"fund"},
    {"isin":"LU0234570918","buscar":"Pictet Global Megatrend Sel P",   "mgr":"Pictet",            "grp":"🌍 Globales",         "type":"fund"},
    {"isin":"LU0274208692","buscar":"Threadneedle Global Focus",       "mgr":"Columbia Threadneedle","grp":"🌍 Globales",      "type":"fund"},
    {"isin":"IE00B579F325","buscar":"Comgest Growth World EUR Acc",    "mgr":"Comgest",           "grp":"🌍 Globales",         "type":"fund"},
    {"isin":"LU0011850392","buscar":"Templeton Growth A Acc",          "mgr":"Franklin Templeton","grp":"🌍 Globales",         "type":"fund"},
    {"isin":"LU0119216554","buscar":"Fidelity European Growth A",      "mgr":"Fidelity",          "grp":"🌍 Europa",           "type":"fund"},
    {"isin":"LU0048578792","buscar":"Invesco Pan European High Income","mgr":"Invesco",           "grp":"🌍 Europa",           "type":"fund"},
    {"isin":"LU0119216398","buscar":"Fidelity Funds America A",        "mgr":"Fidelity",          "grp":"🇺🇸 USA",             "type":"fund"},
    {"isin":"LU0069952863","buscar":"Morgan Stanley US Growth A",      "mgr":"Morgan Stanley",    "grp":"🇺🇸 USA",             "type":"fund"},
    {"isin":"LU0149511784","buscar":"BGF World Technology A2",         "mgr":"BlackRock",         "grp":"🔬 Tecnología",       "type":"fund"},
    {"isin":"LU0124384867","buscar":"Pictet Digital P EUR",            "mgr":"Pictet",            "grp":"🔬 Tecnología",       "type":"fund"},
    {"isin":"IE00B39F4K84","buscar":"Polar Capital Technology TR",     "mgr":"Polar Capital",     "grp":"🔬 Tecnología",       "type":"fund"},
    {"isin":"LU0260869739","buscar":"Pictet Clean Energy I EUR",       "mgr":"Pictet",            "grp":"🔬 Tecnología",       "type":"fund"},
    {"isin":"LU0106235391","buscar":"Pictet Health EUR",               "mgr":"Pictet",            "grp":"🏥 Salud",            "type":"fund"},
    {"isin":"LU0127771498","buscar":"BGF World Healthscience A2",      "mgr":"BlackRock",         "grp":"🏥 Salud",            "type":"fund"},
    # ── Mixtos y retorno absoluto ──────────────────────────────────────────────
    {"isin":"LU0323578657","buscar":"Flossbach von Storch Multiple Opp","mgr":"Flossbach von Storch","grp":"⚖️ Mixtos",        "type":"fund"},
    {"isin":"LU0323578731","buscar":"Flossbach von Storch SICAV Bond", "mgr":"Flossbach von Storch","grp":"⚖️ Mixtos",        "type":"fund"},
    {"isin":"IE00B4WL9142","buscar":"Standard Life GARS",              "mgr":"abrdn",             "grp":"⚖️ Mixtos",          "type":"fund"},
    {"isin":"LU0093570256","buscar":"JPM Global Income A",             "mgr":"JPMorgan",          "grp":"⚖️ Mixtos",          "type":"fund"},
    {"isin":"LU0095939695","buscar":"M&G Optimal Income A",            "mgr":"M&G",               "grp":"⚖️ Mixtos",          "type":"fund"},
    {"isin":"GB00B3DS4T95","buscar":"M&G Global Dividend A",           "mgr":"M&G",               "grp":"⚖️ Mixtos",          "type":"fund"},
    # ── Renta fija ────────────────────────────────────────────────────────────
    {"isin":"LU0201319680","buscar":"PIMCO GIS Income E Class",        "mgr":"PIMCO",             "grp":"🏦 Renta Fija",       "type":"fund"},
    {"isin":"LU0366536711","buscar":"Templeton Global Bond A",         "mgr":"Franklin Templeton","grp":"🏦 Renta Fija",       "type":"fund"},
    {"isin":"LU0148751616","buscar":"Pictet EUR Short Term Bond P",    "mgr":"Pictet",            "grp":"🏦 Renta Fija",       "type":"fund"},
    # ── ETFs adicionales ─────────────────────────────────────────────────────
    {"isin":"IE00B52MJY50","buscar":"iShares Core MSCI Pacific",       "mgr":"BlackRock",         "grp":"🌏 Emergentes",       "type":"etf"},
    {"isin":"IE00B4L5YX21","buscar":"iShares Core MSCI Japan",         "mgr":"BlackRock",         "grp":"🌏 Asia",             "type":"etf"},
    {"isin":"IE00B3VVMM84","buscar":"Vanguard FTSE Developed Asia",    "mgr":"Vanguard",          "grp":"🌏 Asia",             "type":"etf"},
    {"isin":"IE00B3F81R35","buscar":"iShares Core MSCI World Small Cap","mgr":"BlackRock",        "grp":"🌍 Globales",         "type":"etf"},
    {"isin":"IE00B6R52259","buscar":"iShares Automation Robotics",     "mgr":"BlackRock",         "grp":"🔬 Tecnología",       "type":"etf"},
    {"isin":"IE00BYZK4776","buscar":"iShares Global Clean Energy",     "mgr":"BlackRock",         "grp":"🔬 Tecnología",       "type":"etf"},
]

API  = "https://api-global.morningstar.com/sal-service/v1"
HDRS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9",
    "Origin":          "https://global.morningstar.com",
    "Referer":         "https://global.morningstar.com/",
}

def get_token():
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager

    print("🔑 Capturando token OAuth...")
    opts = Options()
    opts.add_argument("--no-sandbox")
    opts.add_argument("--window-size=1400,800")
    opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": """
        window._reqs = [];
        window._oauthBody = null;
        const origFetch = window.fetch;
        window.fetch = function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            window._reqs.push(url);
            return origFetch.apply(this, args).then(r => {
                if (url.includes('oauth/token')) r.clone().text().then(b => { window._oauthBody = b; });
                return r;
            });
        };
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(m, url) { this._url=url; window._reqs.push(url); return origOpen.apply(this,arguments); };
        XMLHttpRequest.prototype.send = function(b) {
            this.addEventListener('load', function() { if(this._url&&this._url.includes('oauth/token')) window._oauthBody=this.responseText; });
            return origSend.apply(this,arguments);
        };
    """})

    try:
        driver.get("https://global.morningstar.com/es/inversiones/fondos/0P00019W2R/cotizacion")
        time.sleep(15)
        reqs = driver.execute_script("return window._reqs || [];")
        for url in reqs:
            m = re.search(r'access_token=(eyJ[A-Za-z0-9\-_\.]+)', url)
            if m:
                print(f"   ✅ Token de URL ({len(m.group(1))} chars)")
                return m.group(1)
        body = driver.execute_script("return window._oauthBody;")
        if body:
            d = json.loads(body)
            tok = d.get("token") or d.get("access_token")
            if tok:
                print(f"   ✅ Token del OAuth body ({len(tok)} chars)")
                return tok
        return None
    finally:
        driver.quit()

def buscar_fi(nombre, tipo="fund"):
    import urllib.parse
    universo = "FOESP$$ALL|FOEUR$$ALL|FOUSA$$ALL" if tipo == "fund" else "ETFEUR$$ALL|ETFESP$$ALL|ETFUS$$ALL|ETFALL$$ALL"
    r = requests.get(
        "https://www.morningstar.es/es/util/SecuritySearch.ashx",
        params={"q": nombre, "limit": 5, "universeIds": universo},
        headers=HDRS, timeout=10
    )
    if r.status_code != 200 or not r.text.strip():
        return None, None
    fis = re.findall(r'"i"\s*:\s*"([^"]+)"', r.text)
    pis = re.findall(r'"pi"\s*:\s*"([^"]+)"', r.text)
    return (fis[0] if fis else None), (pis[0] if pis else None)

def p(path, token, extra=None):
    params = {"locale":"es","clientId":"INTLCOM","benchmarkId":"mstarorcat","version":"4.86.0","access_token":token}
    if extra: params.update(extra)
    try:
        r = requests.get(f"{API}/{path}", params=params, headers=HDRS, timeout=12)
        if r.status_code == 200: return r.json()
        print(f"[{r.status_code}]", end=" ")
    except: print("[err]", end=" ")
    return {}

def sf(v):
    try: return round(float(v),4) if v is not None else None
    except: return None

def procesar(fi, pi, isin, fondo, token):
    tipo = fondo.get("type","fund")

    if tipo == "etf":
        quote    = p(f"etf/quote/v1/{fi}/data",             token, {"secId":fi,"region":"EEA"})
        trailing = p(f"etf/trailingReturn/v1/{fi}/data",    token, {"duration":"quarterly","secId":fi})
        meta     = p(f"etf/securityMetaData/{fi}",          token, {"secId":fi})
        chart    = p("etf/chart/v1",                        token, {"shareClassId":fi,"secId":fi})
        if not quote.get("latestPrice"):
            quote    = p(f"fund/quote/v7/{fi}/data",         token, {"fundServCode":"","showAnalystRatingChinaFund":"false","showAnalystRating":"false","hideesg":"false","region":"EEA","secId":fi})
            trailing = p(f"fund/trailingReturn/v3/{fi}/data",token, {"duration":"quarterly","limitAge":"","secId":fi})
            meta     = p(f"fund/securityMetaData/{fi}",      token, {"secId":fi})
            chart    = p("fund/data/performance/chart",      token, {"shareClassId":fi,"secExchangeList":"","hideYTD":"false","secId":fi})
    else:
        quote    = p(f"fund/quote/v7/{fi}/data",          token, {"fundServCode":"","showAnalystRatingChinaFund":"false","showAnalystRating":"false","hideesg":"false","region":"EEA","secId":fi})
        trailing = p(f"fund/trailingReturn/v3/{fi}/data", token, {"duration":"quarterly","limitAge":"","secId":fi})
        meta     = p(f"fund/securityMetaData/{fi}",       token, {"secId":fi})
        chart    = p("fund/data/performance/chart",       token, {"shareClassId":fi,"secExchangeList":"","hideYTD":"false","secId":fi})

    # Posiciones del fondo
    holdings_raw = p(f"fund/portfolio/holding/v2/{fi}/data", token,
                     {"premiumNum":"10","freeNum":"10","secId":fi})
    holdings = []
    if isinstance(holdings_raw, dict):
        raw_list = (holdings_raw.get("equityHoldingPage", {}).get("holdingList") or
                    holdings_raw.get("holdingSummary", {}).get("holdingList") or
                    holdings_raw.get("holdingList") or [])
    elif isinstance(holdings_raw, list):
        raw_list = holdings_raw
    else:
        raw_list = []
    for h in raw_list:
        if not isinstance(h, dict): continue
        name   = h.get("securityName") or h.get("holdingName") or h.get("name") or ""
        ticker = h.get("ticker") or h.get("tradingSymbol") or ""
        weight = h.get("weighting") or h.get("weight") or 0
        sector = h.get("sectorName") or ""
        country = h.get("countryName") or h.get("country") or ""
        if name and float(weight or 0) > 0:
            holdings.append({"name": name, "ticker": ticker,
                             "weight": round(float(weight), 2),
                             "sector": sector, "country": country})

    nav     = sf(quote.get("latestPrice"))
    ter_raw = sf(quote.get("onGoingCharge"))
    ter     = round(ter_raw*100,4) if ter_raw and ter_raw < 1 else ter_raw
    cols    = trailing.get("columnDefs",[])
    rets    = trailing.get("totalReturnNAV",[])
    ret     = {c: sf(rets[i]) for i,c in enumerate(cols) if i<len(rets)}

    history = []
    pts = chart.get("graphData",{}).get("fund",[])
    if pts:
        base = float(pts[0].get("value",10000) or 10000)
        for pt in pts:
            try:
                dt = datetime.strptime(pt["date"][:10],"%Y-%m-%d")
                history.append({"date":int(dt.timestamp()),"nav":round(float(pt["value"])/base*100,4)})
            except: pass

    return nav, {
        "isin":isin, "name":meta.get("name") or fondo["buscar"],
        "mgr":fondo["mgr"], "grp":fondo["grp"],
        "morningstar_fi":fi, "morningstar_pi":pi or "",
        "currency":meta.get("currencyId") or quote.get("currency") or "EUR",
        "category":meta.get("categoryId") or "",
        "current_nav":nav, "current_price":nav,
        "nav_date":(quote.get("latestPriceDate") or "")[:10],
        "change_pct":sf(quote.get("dayEndPriceReturn") or quote.get("return1Day") or quote.get("1DayReturn")),
        "return_1d": sf(quote.get("dayEndPriceReturn") or quote.get("return1Day") or quote.get("1DayReturn")),
        "return_1m":ret.get("1Month"),  "return_3m":ret.get("3Month"),
        "return_6m":ret.get("6Month"),  "return_ytd":ret.get("YearToDate"),
        "return_1y":ret.get("1Year"),   "return_3y":ret.get("3Year"),
        "return_5y":ret.get("5Year"),   "return_10y":ret.get("10Year"),
        "total_assets":sf(quote.get("fundSize")), "ter":ter,
        "holdings": holdings,
        "source":"morningstar", "updated_at":datetime.now().isoformat(),
        "history":history, "data_points":len(history),
    }

def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    cache = {}
    if OUTPUT.exists():
        with open(OUTPUT,"r",encoding="utf-8") as f: cache = json.load(f)
        print(f"📂 Cache: {len(cache)} fondos\n")

    token = get_token()
    if not token: print("❌ Sin token"); sys.exit(1)
    # Guardar token para que el backend pueda usarlo en posiciones
    token_path = OUTPUT.parent / "ms_token.txt"
    token_path.write_text(token)
    print(f"   💾 Token guardado en {token_path}")
    print(f"\n✅ Token OK. Actualizando {len(FONDOS)} fondos...\n")

    ok = fail = 0
    for fondo in FONDOS:
        isin = fondo["isin"]
        print(f"⬇️  {isin} — {fondo['buscar']}...", end=" ", flush=True)
        try:
            cached_entry = cache.get(isin, {})
            if not isinstance(cached_entry, dict):
                cached_entry = {}
            fi = cached_entry.get("morningstar_fi")
            pi = cached_entry.get("morningstar_pi", "")
            if not fi:
                fi, pi = buscar_fi(fondo["buscar"], fondo.get("type","fund"))
            if not fi:
                print("❌ No encontrado"); fail+=1; continue

            nav, entry = procesar(str(fi), str(pi), isin, fondo, token)
            cache[isin] = entry
            if nav:
                r1y = entry.get("return_1y")
                rs  = f" ret1y={r1y:+.1f}%" if r1y is not None else ""
                print(f"✅ NAV={float(nav):.4f}{rs} hist={len(entry['history'])}pts")
                ok += 1
            else:
                print("⚠️  Sin NAV"); fail+=1
        except Exception as e:
            print(f"❌ {e}"); fail+=1
        time.sleep(0.3)

    with open(OUTPUT,"w",encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"✅ {ok} OK | ❌ {fail} errores | {len(cache)} fondos")
    if ok > 0: print("🚀 Reinicia: uvicorn main:app --reload")

if __name__ == "__main__":
    main()
