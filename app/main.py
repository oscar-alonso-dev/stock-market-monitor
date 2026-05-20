import os, json, time, asyncio
import httpx
from pathlib import Path
from pydantic import BaseModel as PydanticModel
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

_FUNDS_CACHE_PATH = Path(__file__).parent / "data" / "funds_cache.json"
_funds_cache: dict = {}

def _load_funds_cache():
    global _funds_cache
    if _FUNDS_CACHE_PATH.exists():
        try:
            with open(_FUNDS_CACHE_PATH, "r", encoding="utf-8") as f:
                _funds_cache = json.load(f)
            print(f"âœ“ CachÃ© fondos cargada: {len(_funds_cache)} fondos")
        except Exception as e:
            print(f"âš ï¸  Error cargando funds_cache.json: {e}")
    else:
        print("â„¹ï¸  Sin funds_cache.json")

_load_funds_cache()

from services.finnhub import (
    get_stock_quote, get_stock_profile, search_stocks,
    get_stock_metrics, get_stock_earnings,
    get_analyst_recommendations, get_company_news
)

app = FastAPI(title="Aurum Markets API", version="6.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])

FMP_KEY    = os.getenv("FMP_KEY",    "hsAsc6Yt9nIwlYTAW1AUOBX7U6MQUNOL")
EODHD_KEY  = os.getenv("EODHD_KEY", "69a1df0a3c8948.57484984")
AV_KEY     = os.getenv("AV_KEY",    "BI5VML3VQQ0DV7WP")
FMP_BASE   = "https://financialmodelingprep.com/stable"
EODHD_BASE = "https://eodhd.com/api"
AV_BASE    = "https://www.alphavantage.co/query"

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}
MSTAR_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.morningstar.es/",
}

_cache: dict = {}

def cache_get(key):
    e = _cache.get(key)
    return e["data"] if e and time.time() - e["ts"] < e["ttl"] else None

def cache_set(key, data, ttl=30):
    _cache[key] = {"data": data, "ts": time.time(), "ttl": ttl}

async def cached(key, fn, ttl=30):
    hit = cache_get(key)
    if hit is not None:
        return hit
    data = await fn()
    cache_set(key, data, ttl)
    return data

async def fmp_get(path: str, params: dict = {}, timeout=15.0):
    ck = f"fmp:{path}:{str(sorted(params.items()))}"
    hit = cache_get(ck)
    if hit is not None: return hit
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.get(f"{FMP_BASE}/{path}", params={"apikey": FMP_KEY, **params})
        if r.status_code == 200:
            d = r.json()
            result = d if d else []
            cache_set(ck, result, ttl=86400)
            return result
        return []

async def av_overview(symbol: str) -> dict:
    sym = symbol.split(".")[0]
    ck  = f"av:overview:{sym}"
    hit = cache_get(ck)
    if hit is not None: return hit
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(AV_BASE, params={"function": "OVERVIEW", "symbol": sym, "apikey": AV_KEY})
        if r.status_code == 200:
            d = r.json()
            if d and "Symbol" in d:
                cache_set(ck, d, ttl=86400)
                return d
    return {}

async def av_income(symbol: str) -> dict:
    sym = symbol.split(".")[0]
    ck  = f"av:income:{sym}"
    hit = cache_get(ck)
    if hit is not None: return hit
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(AV_BASE, params={"function": "INCOME_STATEMENT", "symbol": sym, "apikey": AV_KEY})
        if r.status_code == 200:
            d = r.json()
            if d and "annualReports" in d:
                cache_set(ck, d, ttl=86400)
                return d
    return {}

async def av_balance(symbol: str) -> dict:
    sym = symbol.split(".")[0]
    ck  = f"av:balance:{sym}"
    hit = cache_get(ck)
    if hit is not None: return hit
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(AV_BASE, params={"function": "BALANCE_SHEET", "symbol": sym, "apikey": AV_KEY})
        if r.status_code == 200:
            d = r.json()
            if d and "annualReports" in d:
                cache_set(ck, d, ttl=86400)
                return d
    return {}

async def av_cashflow(symbol: str) -> dict:
    sym = symbol.split(".")[0]
    ck  = f"av:cashflow:{sym}"
    hit = cache_get(ck)
    if hit is not None: return hit
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(AV_BASE, params={"function": "CASH_FLOW", "symbol": sym, "apikey": AV_KEY})
        if r.status_code == 200:
            d = r.json()
            if d and "annualReports" in d:
                cache_set(ck, d, ttl=86400)
                return d
    return {}

TICKERS_LIGHT: list = []
TICKERS_BY_SYM: dict = {}
TICKERS_LOADED = False

def load_tickers():
    global TICKERS_LIGHT, TICKERS_BY_SYM, TICKERS_LOADED
    p = Path(__file__).parent / "data" / "tickers_light.json"
    if p.exists():
        with open(p, encoding="utf-8") as f:
            TICKERS_LIGHT = json.load(f)
        TICKERS_BY_SYM = {t["s"]: t for t in TICKERS_LIGHT}
        TICKERS_LOADED = True
        print(f"âœ“ Tickers: {len(TICKERS_LIGHT):,}")
    else:
        print("âš   Sin tickers_light.json")

try:
    from cnmv import get_vl_historico, search_fondos_cnmv, get_catalog_cnmv, FONDOS_ESP
    CNMV_OK = True
    print("âœ“ MÃ³dulo CNMV cargado")
except ImportError:
    CNMV_OK = False
    print("âš   cnmv.py no encontrado")

try:
    from morningstar import get_fund_data, search_funds_morningstar, get_fund_history_morningstar
    MS_OK = True
    print("âœ“ MÃ³dulo Morningstar cargado")
except ImportError:
    MS_OK = False
    print("âš   morningstar.py no encontrado")

@app.on_event("startup")
async def startup():
    load_tickers()
    asyncio.create_task(_scraper_scheduler())

async def _scraper_scheduler():
    from datetime import datetime
    UPDATE_HOURS = 24
    print(f"âœ“ Scheduler fondos activo â€” actualizarÃ¡ cada {UPDATE_HOURS}h")
    while True:
        await asyncio.sleep(UPDATE_HOURS * 3600)
        try:
            token_path = Path(__file__).parent / "data" / "ms_token.txt"
            if not token_path.exists(): continue
            token = token_path.read_text().strip()
            API   = "https://api-global.morningstar.com/sal-service/v1"
            HDRS  = {"User-Agent": "Mozilla/5.0", "Accept": "application/json",
                     "Origin": "https://global.morningstar.com", "Referer": "https://global.morningstar.com/"}
            updated = 0
            async with httpx.AsyncClient(timeout=12.0) as c:
                for isin, data in _funds_cache.items():
                    if not isinstance(data, dict): continue
                    fi = data.get("morningstar_fi")
                    if not fi: continue
                    try:
                        params = {"locale": "es", "clientId": "INTLCOM", "benchmarkId": "mstarorcat",
                                  "version": "4.86.0", "access_token": token, "secId": fi,
                                  "fundServCode": "", "showAnalystRatingChinaFund": "false",
                                  "showAnalystRating": "false", "hideesg": "false", "region": "EEA"}
                        r = await c.get(f"{API}/fund/quote/v7/{fi}/data", params=params, headers=HDRS)
                        if r.status_code == 200:
                            q = r.json()
                            nav = q.get("latestPrice")
                            if nav:
                                _funds_cache[isin]["current_nav"]   = round(float(nav), 4)
                                _funds_cache[isin]["current_price"] = round(float(nav), 4)
                                _funds_cache[isin]["nav_date"]      = (q.get("latestPriceDate") or "")[:10]
                                _funds_cache[isin]["updated_at"]    = datetime.now().isoformat()
                                updated += 1
                        await asyncio.sleep(0.3)
                    except Exception: continue
            with open(Path(__file__).parent / "data" / "funds_cache.json", "w", encoding="utf-8") as f:
                json.dump(_funds_cache, f, ensure_ascii=False, indent=2)
            print(f"âœ“ Auto-actualizaciÃ³n: {updated} fondos")
        except Exception as e:
            print(f"âš ï¸  Error scheduler: {e}")

def search_local(query: str, limit=50) -> list:
    q, ql = query.upper().strip(), query.lower().strip()
    if not q: return []
    results, seen = [], set()

    def add(t, score):
        if t["s"] not in seen and len(results) < limit:
            seen.add(t["s"])
            results.append({**t, "_score": score})

    if q in TICKERS_BY_SYM: add(TICKERS_BY_SYM[q], 100)
    for t in TICKERS_LIGHT:
        if len(results) >= limit: break
        if t["s"].upper().startswith(q) and t["s"].upper() != q: add(t, 90)
    for t in TICKERS_LIGHT:
        if len(results) >= limit: break
        if t["n"].lower().startswith(ql): add(t, 80)
    for t in TICKERS_LIGHT:
        if len(results) >= limit: break
        if ql in t["n"].lower(): add(t, 60)
    results.sort(key=lambda x: -x["_score"])
    return results[:limit]

@app.get("/health")
def health():
    return {"status": "ok", "version": "6.1.0",
            "tickers": len(TICKERS_LIGHT), "cache": len(_cache)}

@app.get("/search")
async def universal_search(q: str = Query(..., min_length=1), limit: int = 30):
    if TICKERS_LOADED and len(TICKERS_LIGHT) > 1000:
        results = search_local(q, limit)
        return {
            "query": q, "count": len(results), "source": "local",
            "results": [{"symbol": r["s"], "name": r["n"], "exchange": r["e"],
                         "type": r["t"], "isin": r.get("i", ""),
                         "region": r.get("r", ""), "currency": r.get("c", "")}
                        for r in results]
        }
    async def fetch():
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(f"{EODHD_BASE}/search/{q}",
                params={"api_token": EODHD_KEY, "limit": limit, "fmt": "json"})
            data = r.json() if r.status_code == 200 else []
            if not isinstance(data, list): data = []
            return {
                "query": q, "count": len(data), "source": "eodhd",
                "results": [{"symbol": d.get("Code", ""), "name": d.get("Name", ""),
                             "exchange": d.get("Exchange", ""), "type": d.get("Type", "").lower(),
                             "isin": d.get("ISIN", "") or "", "region": "",
                             "currency": d.get("Currency", "")}
                            for d in data if d.get("Code")]
            }
    return await cached(f"search:{q.lower()}", fetch, ttl=300)

@app.get("/stocks/search/{query}")
async def search_legacy(query: str, limit: int = 20):
    r = await universal_search(q=query, limit=limit)
    return {"count": r["count"], "result": [
        {"symbol": x["symbol"], "description": x["name"], "type": x["type"],
         "displaySymbol": x["symbol"], "exchange": x["exchange"]}
        for x in r["results"]]}

@app.get("/stocks/{symbol:path}/detail")
async def stock_detail(symbol: str):
    sym = symbol.upper()
    yahoo_sym = sym[:-3] if sym.endswith(".US") else sym

    async def fetch():
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}",
                params={"interval": "1d", "range": "1y"}, headers=YAHOO_HEADERS)
            chart_res = r.json().get("chart", {}).get("result", [])
            if not chart_res: raise HTTPException(404, f"'{sym}' no encontrado")
            meta   = chart_res[0].get("meta", {})
            ts     = chart_res[0].get("timestamp", [])
            q_data = chart_res[0].get("indicators", {}).get("quote", [{}])[0]
            hist   = [{"date": t, "price": round(float(p), 4), "vol": v or 0}
                      for t, p, v in zip(ts, q_data.get("close", []), q_data.get("volume", [])) if p]
            current = meta.get("regularMarketPrice") or (hist[-1]["price"] if hist else 0)
            prev    = meta.get("chartPreviousClose") or (hist[-2]["price"] if len(hist) > 1 else current)
            chg_pct = round(((current - prev) / prev) * 100, 2) if prev else 0

        fmp_sym = yahoo_sym.split(".")[0]
        fmp_prof = await fmp_get("profile", {"symbol": fmp_sym})
        fp = fmp_prof[0] if fmp_prof else {}
        local = TICKERS_BY_SYM.get(sym, {})

        return {
            "symbol": sym,
            "name":        fp.get("companyName") or meta.get("longName") or sym,
            "sector":      fp.get("sector", ""),
            "industry":    fp.get("industry", ""),
            "description": fp.get("description", ""),
            "website":     fp.get("website", ""),
            "ceo":         fp.get("ceo", ""),
            "employees":   fp.get("fullTimeEmployees"),
            "country":     fp.get("country", ""),
            "exchange":    meta.get("exchangeName") or local.get("e", ""),
            "currency":    meta.get("currency") or local.get("c", "USD"),
            "isin":        local.get("i", ""),
            "market_state": meta.get("marketState", "CLOSED"),
            "current":     current, "prev_close": prev, "change_pct": chg_pct,
            "52w_high":    meta.get("fiftyTwoWeekHigh"),
            "52w_low":     meta.get("fiftyTwoWeekLow"),
            "market_cap":  fp.get("mktCap"),
            "volume":      meta.get("regularMarketVolume"),
            "beta":        fp.get("beta"),
            "history":     hist,
            "data_source": "yahoo+fmp",
        }

    return await cached(f"detail:{sym}", fetch, ttl=300)

RANGE_CFG = {
    "1D": {"interval": "5m",  "range": "1d",  "ttl": 30},
    "5D": {"interval": "15m", "range": "5d",  "ttl": 120},
    "1M": {"interval": "1d",  "range": "1mo", "ttl": 1800},
    "3M": {"interval": "1d",  "range": "3mo", "ttl": 3600},
    "6M": {"interval": "1d",  "range": "6mo", "ttl": 3600},
    "1Y": {"interval": "1d",  "range": "1y",  "ttl": 3600},
    "5Y": {"interval": "1wk", "range": "5y",  "ttl": 7200},
}

@app.get("/stocks/{symbol:path}/chart")
async def chart(symbol: str, range: str = "1D"):
    sym = symbol.upper()
    yahoo_sym = sym[:-3] if sym.endswith(".US") else sym
    cfg = RANGE_CFG.get(range.upper(), RANGE_CFG["1D"])

    async def fetch():
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}",
                params={"interval": cfg["interval"], "range": cfg["range"]},
                headers=YAHOO_HEADERS)
            res = r.json().get("chart", {}).get("result", [])
            if not res: raise HTTPException(404, f"Sin datos para {sym}")
            meta = res[0].get("meta", {})
            ts   = res[0].get("timestamp", [])
            q    = res[0].get("indicators", {}).get("quote", [{}])[0]
            pts  = []
            for i, t in enumerate(ts):
                cv = (q.get("close") or [])[i] if i < len(q.get("close") or []) else None
                if cv is None: continue
                pts.append({
                    "ts": t, "time": t, "price": round(cv, 4),
                    "open":  round(q["open"][i],  4) if q.get("open")   and i < len(q["open"])   and q["open"][i]   else None,
                    "high":  round(q["high"][i],  4) if q.get("high")   and i < len(q["high"])   and q["high"][i]   else None,
                    "low":   round(q["low"][i],   4) if q.get("low")    and i < len(q["low"])    and q["low"][i]    else None,
                    "vol":   q["volume"][i]           if q.get("volume") and i < len(q["volume"]) and q["volume"][i]  else 0,
                })
            cur  = meta.get("regularMarketPrice") or (pts[-1]["price"] if pts else 0)
            prev = meta.get("chartPreviousClose") or (pts[0]["price"]  if pts else cur)
            chg  = round(cur - prev, 4)
            return {"symbol": sym, "range": range, "current": cur, "prev_close": prev,
                    "change": chg, "change_pct": round(chg / prev * 100, 4) if prev else 0,
                    "currency": meta.get("currency", "USD"),
                    "name": meta.get("longName") or meta.get("shortName") or sym,
                    "market_state": meta.get("marketState", "CLOSED"), "points": pts}

    return await cached(f"chart:{sym}:{range}", fetch, ttl=cfg["ttl"])

@app.get("/market/quotes")
async def batch_quotes(symbols: str = Query(...)):
    sl = [s.strip().upper() for s in symbols.split(",") if s.strip()][:60]
    if not sl: return []
    cache_key = f"quotes:{'|'.join(sorted(sl))}"
    hit = cache_get(cache_key)
    if hit is not None: return hit
    to_fetch    = [s for s in sl if cache_get(f"q1:{s}") is None]
    cached_ones = {s: cache_get(f"q1:{s}") for s in sl if cache_get(f"q1:{s}") is not None}

    async def fetch_one(client: httpx.AsyncClient, sym: str):
        yahoo_sym = sym[:-3] if sym.endswith(".US") else sym
        try:
            r = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}",
                params={"interval": "1d", "range": "5d"})
            if r.status_code != 200: return {"symbol": sym, "error": True}
            res = r.json().get("chart", {}).get("result", [])
            if not res: return {"symbol": sym, "error": True}
            meta = res[0].get("meta", {})
            cur  = meta.get("regularMarketPrice") or 0
            prev = meta.get("chartPreviousClose") or cur
            chg  = round(((cur - prev) / prev) * 100, 2) if prev else 0
            result = {"symbol": sym, "current_price": cur, "change_percent": chg,
                      "change": round(cur - prev, 4), "volume": meta.get("regularMarketVolume") or 0,
                      "market_cap": meta.get("marketCap"), "currency": meta.get("currency", ""),
                      "name": meta.get("longName") or meta.get("shortName") or sym}
            cache_set(f"q1:{sym}", result, ttl=20)
            return result
        except Exception:
            return {"symbol": sym, "error": True}

    if to_fetch:
        async with httpx.AsyncClient(timeout=8.0, headers=YAHOO_HEADERS,
                                     limits=httpx.Limits(max_connections=20)) as client:
            new_results = await asyncio.gather(*[fetch_one(client, s) for s in to_fetch])
    else:
        new_results = []

    fetched_map = {r["symbol"]: r for r in new_results}
    all_results = [cached_ones.get(s) or fetched_map.get(s) or {"symbol": s, "error": True} for s in sl]
    cache_set(cache_key, all_results, ttl=20)
    return all_results

IBEX35 = [
    "SAN.MC","BBVA.MC","ITX.MC","IBE.MC","REP.MC","TEF.MC","CABK.MC",
    "AMS.MC","FER.MC","ACS.MC","GRF.MC","IAG.MC","ACX.MC","NTGY.MC",
    "CLNX.MC","MEL.MC","MAP.MC","BKT.MC","AENA.MC","ELE.MC",
    "COL.MC","ENG.MC","MRL.MC","VIS.MC","SAB.MC","MTS.MC","PHM.MC",
    "LOG.MC","ROVI.MC","SLR.MC","ENCE.MC","PRIM.MC","SGRE.MC",
]

@app.get("/market/ibex35")
async def ibex35():
    hit = cache_get("ibex35:full")
    if hit: return hit
    quotes = await batch_quotes(symbols=",".join(IBEX35))
    result = [{"symbol": q["symbol"], "name": q.get("name", q["symbol"]),
               "price": q.get("current_price", 0), "change_pct": q.get("change_percent", 0),
               "change": q.get("change", 0), "volume": q.get("volume", 0),
               "market_cap": q.get("market_cap"), "currency": q.get("currency", "EUR"),
               "market_state": "REGULAR"}
              for q in quotes if not q.get("error")]
    cache_set("ibex35:full", result, ttl=20)
    return result

@app.get("/stocks/{symbol:path}/quote")
async def quote(symbol: str):
    return await cached(f"quote:{symbol.upper()}", lambda: get_stock_quote(symbol.upper()), ttl=30)

@app.get("/stocks/{symbol:path}/profile")
async def profile(symbol: str):
    return await cached(f"profile:{symbol.upper()}", lambda: get_stock_profile(symbol.upper()), ttl=3600)

@app.get("/stocks/{symbol:path}/metrics")
async def metrics(symbol: str):
    return await cached(f"metrics:{symbol.upper()}", lambda: get_stock_metrics(symbol.upper()), ttl=3600)

@app.get("/stocks/{symbol:path}/earnings")
async def earnings(symbol: str):
    return await cached(f"earnings:{symbol.upper()}", lambda: get_stock_earnings(symbol.upper()), ttl=3600)

@app.get("/stocks/{symbol:path}/recommendations")
async def recommendations(symbol: str):
    return await cached(f"rec:{symbol.upper()}", lambda: get_analyst_recommendations(symbol.upper()), ttl=3600)

@app.get("/stocks/{symbol:path}/news")
async def news(symbol: str):
    return await cached(f"news:{symbol.upper()}", lambda: get_company_news(symbol.upper()), ttl=600)

@app.get("/funds/search")
async def funds_search(q: str = Query(..., min_length=1)):
    async def fetch():
        results = []
        if MS_OK:
            try:
                ms_results = await search_funds_morningstar(q, limit=15)
                for item in ms_results:
                    results.append({"symbol": item.get("isin") or item.get("id", ""),
                                    "isin": item.get("isin", ""), "mstar_id": item.get("id", ""),
                                    "name": item.get("name", ""), "type": "MUTUALFUND",
                                    "category": item.get("category", ""), "exchange": "Morningstar", "source": "morningstar"})
            except Exception as e:
                print(f"[funds_search] MS error: {e}")
        if CNMV_OK:
            try:
                cnmv_results = await search_fondos_cnmv(q)
                existing_isins = {r["isin"] for r in results if r.get("isin")}
                for cr in cnmv_results:
                    isin = cr.get("isin", "")
                    if isin and isin not in existing_isins:
                        results.append({"symbol": isin, "isin": isin, "mstar_id": "",
                                        "name": cr.get("nombre", ""), "type": "MUTUALFUND",
                                        "category": "Fondo EspaÃ±ol (CNMV)", "exchange": "CNMV", "source": "cnmv"})
                        existing_isins.add(isin)
            except Exception as e:
                print(f"[funds_search] CNMV error: {e}")
        if not results:
            try:
                async with httpx.AsyncClient(timeout=10.0) as c:
                    r = await c.get("https://query1.finance.yahoo.com/v1/finance/search",
                                    params={"q": q, "quotesCount": 10, "newsCount": 0}, headers=YAHOO_HEADERS)
                    if r.status_code == 200:
                        for item in r.json().get("quotes", []):
                            sym = item.get("symbol", "")
                            if not sym: continue
                            results.append({"symbol": sym, "isin": "", "mstar_id": "",
                                            "name": item.get("longname") or item.get("shortname") or sym,
                                            "type": item.get("quoteType", ""), "category": "",
                                            "exchange": item.get("exchDisp") or "", "source": "yahoo"})
            except Exception as e:
                print(f"[funds_search] Yahoo error: {e}")
        return results
    return await cached(f"funds_search:{q.lower().strip()}", fetch, ttl=300)

@app.get("/stocks/quotes/batch")
async def quotes_batch(symbols: str):
    async def fetch():
        tickers = [s.strip() for s in symbols.split(",") if s.strip()][:20]
        if not tickers: return {}
        result = {}
        async def get_one(ticker):
            try:
                async with httpx.AsyncClient(timeout=8.0) as c:
                    r = await c.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
                                    params={"interval": "1d", "range": "5d"}, headers=YAHOO_HEADERS)
                    if r.status_code == 200:
                        meta  = r.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
                        price = meta.get("regularMarketPrice")
                        prev  = meta.get("chartPreviousClose") or meta.get("previousClose")
                        chg_pct = round(((price - prev) / prev) * 100, 2) if price and prev else None
                        if price:
                            result[ticker] = {"price": round(float(price), 4),
                                              "change_pct": chg_pct, "currency": meta.get("currency", "")}
            except Exception: pass
        await asyncio.gather(*[get_one(t) for t in tickers])
        return result
    return await cached(f"quotes_batch:{symbols}", fetch, ttl=25)

@app.get("/funds/catalog")
async def funds_catalog():
    result = []
    for isin, data in _funds_cache.items():
        if not isinstance(data, dict): continue
        result.append({"isin": isin, "name": data.get("name", isin), "mgr": data.get("mgr", ""),
                        "grp": data.get("grp", ""), "currency": data.get("currency", "EUR"),
                        "category": data.get("category", ""), "source": data.get("source", "morningstar")})
    return sorted(result, key=lambda x: (x["grp"], x["name"]))

@app.get("/funds/cnmv/catalog")
async def cnmv_catalog():
    if not CNMV_OK: return []
    return get_catalog_cnmv()

@app.get("/funds/cnmv/search")
async def cnmv_search(q: str = Query(..., min_length=2)):
    if not CNMV_OK: return []
    return await search_fondos_cnmv(q)

@app.get("/funds/debug/cache")
async def debug_cache():
    return {"keys": list(_funds_cache.keys())[:10], "total": len(_funds_cache)}

@app.get("/funds/{symbol}/detail")
async def fund_detail(symbol: str):
    async def fetch():
        import datetime
        is_isin         = len(symbol) == 12 and symbol[:2].isalpha()
        is_spanish_isin = symbol.startswith("ES") and is_isin
        if symbol in _funds_cache:
            cached_fund = _funds_cache[symbol].copy()
            if is_spanish_isin and CNMV_OK and not cached_fund.get("history"):
                cnmv = await get_vl_historico(symbol, num=365)
                if cnmv and cnmv.get("history"):
                    cached_fund["history"]     = cnmv["history"]
                    cached_fund["data_points"] = len(cnmv["history"])
            return cached_fund
        if is_spanish_isin and CNMV_OK:
            result = await get_vl_historico(symbol, num=365)
            if result: return result
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                            params={"interval": "1d", "range": "1y"}, headers=YAHOO_HEADERS)
            if r.status_code != 200: raise HTTPException(404, f"Sin datos para '{symbol}'")
            res = r.json().get("chart", {}).get("result", [])
            if not res: raise HTTPException(404, f"Sin datos para '{symbol}'")
            meta   = res[0].get("meta", {})
            ts     = res[0].get("timestamp", [])
            closes = res[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
            hist   = [{"date": t, "nav": round(float(closes[i]), 4)}
                      for i, t in enumerate(ts) if i < len(closes) and closes[i] and closes[i] > 0]
            if not hist: raise HTTPException(404, f"Sin datos histÃ³ricos para '{symbol}'")
            current = meta.get("regularMarketPrice") or hist[-1]["nav"]
            prev    = meta.get("chartPreviousClose") or (hist[-2]["nav"] if len(hist) > 1 else current)
            chg_pct = round(((current - prev) / prev) * 100, 2) if prev else 0
            def ret(days):
                if len(hist) >= days:
                    old = hist[-days]["nav"]
                    return round(((current - old) / old) * 100, 2) if old else None
                return None
            y0      = int(datetime.datetime(datetime.datetime.now().year, 1, 1).timestamp())
            ytd_pts = [h for h in hist if h["date"] >= y0]
            ytd     = round(((current - ytd_pts[0]["nav"]) / ytd_pts[0]["nav"]) * 100, 2) if ytd_pts else None
            return {"isin": symbol, "symbol": symbol,
                    "name": meta.get("longName") or meta.get("shortName") or symbol,
                    "type": meta.get("quoteType") or "ETF", "currency": meta.get("currency", "USD"),
                    "exchange": meta.get("exchangeName", ""), "current_nav": round(current, 4),
                    "current_price": round(current, 4), "prev_nav": round(prev, 4),
                    "change_pct": chg_pct, "return_1d": chg_pct, "return_1w": ret(5),
                    "return_1m": ret(21), "return_3m": ret(63), "return_6m": ret(126),
                    "return_ytd": ytd, "return_1y": ret(252), "history": hist,
                    "data_points": len(hist), "source": "yahoo_finance"}
    return await cached(f"fund_detail:{symbol}", fetch, ttl=60)

@app.get("/funds/{symbol}/holdings")
async def fund_holdings(symbol: str):
    if symbol not in _funds_cache:
        raise HTTPException(404, f"Fondo '{symbol}' no en cache")
    holdings = _funds_cache[symbol].get("holdings", [])
    if not holdings: return {"isin": symbol, "holdings": [], "count": 0}
    tickers = [h["ticker"] for h in holdings if h.get("ticker")]
    quotes  = {}
    if tickers:
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.get("https://query1.finance.yahoo.com/v7/finance/quote",
                                params={"symbols": ",".join(tickers),
                                        "fields": "regularMarketPrice,regularMarketChangePercent,regularMarketChange,currency"},
                                headers=YAHOO_HEADERS)
                if r.status_code == 200:
                    for q in r.json().get("quoteResponse", {}).get("result", []):
                        sym = q.get("symbol", "")
                        quotes[sym] = {"price": round(q.get("regularMarketPrice", 0), 4),
                                       "change_pct": round(q.get("regularMarketChangePercent", 0), 2),
                                       "change": round(q.get("regularMarketChange", 0), 4),
                                       "currency": q.get("currency", "")}
        except Exception: pass
    enriched = []
    for h in sorted(holdings, key=lambda x: x.get("weight", 0), reverse=True):
        entry = dict(h)
        ticker = h.get("ticker", "")
        entry["quote"] = quotes.get(ticker) if ticker and ticker in quotes else None
        enriched.append(entry)
    return {"isin": symbol, "holdings": enriched, "count": len(enriched)}

import threading, subprocess, sys
from datetime import datetime, timedelta

_scraper_status = {"running": False, "last_run": None, "next_run": None, "log": []}

def _run_scraper_background():
    _scraper_status["running"] = True
    _scraper_status["log"]     = []
    try:
        scraper_path = Path(__file__).parent.parent / "morningstar_scraper.py"
        if not scraper_path.exists():
            scraper_path = Path(__file__).parent / "morningstar_scraper.py"
        result = subprocess.run([sys.executable, str(scraper_path)],
                                capture_output=True, text=True, timeout=300,
                                cwd=str(scraper_path.parent))
        _scraper_status["log"]      = result.stdout.split("\n")[-20:]
        _scraper_status["last_run"] = datetime.now().isoformat()
        _load_funds_cache()
        print(f"âœ“ Scraper completado. Cache: {len(_funds_cache)} fondos")
    except Exception as e:
        _scraper_status["log"] = [f"Error: {e}"]
        print(f"âš ï¸  Error en scraper: {e}")
    finally:
        _scraper_status["running"] = False

@app.get("/funds/scraper/status")
async def scraper_status():
    return {"running": _scraper_status["running"], "last_run": _scraper_status["last_run"],
            "next_run": _scraper_status["next_run"], "funds_in_cache": len(_funds_cache),
            "log": _scraper_status["log"][-5:]}

@app.post("/funds/scraper/run")
async def scraper_run():
    if _scraper_status["running"]: return {"status": "already_running"}
    thread = threading.Thread(target=_run_scraper_background, daemon=True)
    thread.start()
    return {"status": "started"}

@app.get("/crypto/{coin}")
async def crypto(coin: str):
    async def fetch():
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get("https://api.coingecko.com/api/v3/simple/price",
                            params={"ids": coin, "vs_currencies": "usd", "include_24hr_change": "true"})
            d = r.json().get(coin, {})
            return {"current_price": d.get("usd"), "change_percent": d.get("usd_24h_change"), "change": 0}
    return await cached(f"crypto:{coin}", fetch, ttl=60)

@app.get("/currency/rates")
async def currency_rates():
    async def fetch():
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get("https://api.frankfurter.app/latest", params={"from": "EUR"})
            d = r.json()
            rates = d.get("rates", {})
            rates["EUR"] = 1.0
            return {"base": "EUR", "date": d.get("date"), "rates": rates}
    return await cached("currency:rates", fetch, ttl=3600)

@app.get("/currency/convert")
async def currency_convert(amount: float, from_: str = Query(alias="from"), to: str = "USD"):
    rd    = await currency_rates()
    rates = rd["rates"]
    fu, tu = from_.upper(), to.upper()
    if fu not in rates or tu not in rates:
        raise HTTPException(400, "Divisa no encontrada")
    return {"amount": amount, "from": fu, "to": tu,
            "result": round((amount / rates[fu]) * rates[tu], 6),
            "rate":   round(rates[tu] / rates[fu], 6), "date": rd["date"]}

@app.get("/tickers/stats")
def ticker_stats():
    if not TICKERS_LOADED: return {"loaded": False}
    by_ex, by_type = {}, {}
    for t in TICKERS_LIGHT:
        by_ex[t["e"]]   = by_ex.get(t["e"], 0) + 1
        by_type[t["t"]] = by_type.get(t["t"], 0) + 1
    return {"loaded": True, "total": len(TICKERS_LIGHT),
            "by_exchange": dict(sorted(by_ex.items(),   key=lambda x: -x[1])[:20]),
            "by_type":     dict(sorted(by_type.items(), key=lambda x: -x[1]))}

# â”€â”€ FUNDAMENTALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@app.get("/fundamentals/{symbol}")
async def get_fundamentals(symbol: str):
    async def fetch():
        sym       = symbol.upper().strip()
        yahoo_sym = sym[:-3] if sym.endswith(".US") else sym
        fmp_sym   = yahoo_sym.split(".")[0]
        result    = {"symbol": sym, "error": None}

        def fmt_b(n):
            if n is None: return None
            try:
                n = float(n)
                if n == 0: return None
                if abs(n) >= 1e12: return f"{n/1e12:.2f}T"
                if abs(n) >= 1e9:  return f"{n/1e9:.2f}B"
                if abs(n) >= 1e6:  return f"{n/1e6:.2f}M"
                return str(round(n, 2))
            except: return None

        def flt(v):
            try: return float(v) if v and v not in ("None", "-", "N/A") else None
            except: return None

        def pct(v):
            v = flt(v)
            if v is None: return None
            return round(v * 100, 2) if abs(v) < 5 else round(v, 2)

        try:
            # 1. Precio actual (Yahoo v8)
            async with httpx.AsyncClient(timeout=15.0, headers=YAHOO_HEADERS) as c:
                r_chart = await c.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}",
                    params={"interval": "1d", "range": "5d"})
            meta = {}; price = None; currency = "USD"
            if r_chart.status_code == 200:
                res = r_chart.json().get("chart", {}).get("result", [])
                if res:
                    meta     = res[0].get("meta", {})
                    price    = meta.get("regularMarketPrice")
                    currency = meta.get("currency", "USD")

            # 2. Alpha Vantage â€” 4 endpoints en paralelo
            av  = await av_overview(fmp_sym)
            await asyncio.sleep(13)
            inc = await av_income(fmp_sym)
            await asyncio.sleep(13)
            bal = await av_balance(fmp_sym)
            await asyncio.sleep(13)
            cf  = await av_cashflow(fmp_sym)
            if not isinstance(av,  dict): av  = {}
            if not isinstance(inc, dict): inc = {}
            if not isinstance(bal, dict): bal = {}
            if not isinstance(cf,  dict): cf  = {}

            # 3. FMP profile (gratuito)
            fmp_prof = await fmp_get("profile", {"symbol": fmp_sym})
            fp = fmp_prof[0] if fmp_prof else {}

            # â”€â”€ Datos de OVERVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            mktcap      = flt(av.get("MarketCapitalization"))
            trailing_pe = flt(av.get("TrailingPE"))
            forward_pe  = flt(av.get("ForwardPE"))
            pb          = flt(av.get("PriceToBookRatio"))
            ps          = flt(av.get("PriceToSalesRatioTTM"))
            peg         = flt(av.get("PEGRatio"))
            ev_ebitda   = flt(av.get("EVToEBITDA"))
            ev_revenue  = flt(av.get("EVToRevenue"))
            beta        = flt(av.get("Beta"))
            eps         = flt(av.get("EPS"))
            div_yield   = pct(av.get("DividendYield"))
            payout      = pct(av.get("PayoutRatio"))
            roe         = pct(av.get("ReturnOnEquityTTM"))
            roa         = pct(av.get("ReturnOnAssetsTTM"))
            op_margin   = pct(av.get("OperatingMarginTTM"))
            profit_margin = pct(av.get("ProfitMargin"))
            rev_growth  = pct(av.get("QuarterlyRevenueGrowthYOY"))
            eps_growth  = pct(av.get("QuarterlyEarningsGrowthYOY"))
            target_price = flt(av.get("AnalystTargetPrice"))
            week_high   = flt(av.get("52WeekHigh"))
            week_low    = flt(av.get("52WeekLow"))
            shares      = flt(av.get("SharesOutstanding"))

            # â”€â”€ Income statement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            annual = inc.get("annualReports", [])
            is0 = annual[0] if annual else {}
            is1 = annual[1] if len(annual) > 1 else {}

            rev0             = flt(is0.get("totalRevenue"))
            rev1             = flt(is1.get("totalRevenue"))
            ebitda           = flt(is0.get("ebitda"))
            gross_profit     = flt(is0.get("grossProfit"))
            operating_income = flt(is0.get("operatingIncome"))
            net_income       = flt(is0.get("netIncome"))
            interest_expense = flt(is0.get("interestExpense"))

            rev_growth_calc = round(((rev0-rev1)/abs(rev1))*100, 1) if rev0 and rev1 and rev1 != 0 else rev_growth

            # â”€â”€ MÃ¡rgenes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            margen_bruto  = round((gross_profit/rev0)*100,     1) if gross_profit     and rev0 else None
            margen_ebitda = round((ebitda/rev0)*100,           1) if ebitda           and rev0 else None
            margen_op     = round((operating_income/rev0)*100, 1) if operating_income and rev0 else op_margin
            margen_neto   = round((net_income/rev0)*100,       1) if net_income       and rev0 else profit_margin

            # Interest coverage
            interest_cov = round(operating_income / abs(interest_expense), 2) if operating_income and interest_expense and interest_expense != 0 else None

            # â”€â”€ Balance sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            bs_annual = bal.get("annualReports", [])
            bs0 = bs_annual[0] if bs_annual else {}
            total_debt = flt(bs0.get("shortLongTermDebtTotal")) or flt(bs0.get("longTermDebt")) or flt(av.get("TotalDebt"))
            cash       = flt(bs0.get("cashAndCashEquivalentsAtCarryingValue")) or flt(bs0.get("cashAndShortTermInvestments"))
            net_debt   = (total_debt - cash) if total_debt is not None and cash is not None else None

            # â”€â”€ Cash flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            cf_annual = cf.get("annualReports", [])
            cf0    = cf_annual[0] if cf_annual else {}
            op_cf  = flt(cf0.get("operatingCashflow"))
            capex  = flt(cf0.get("capitalExpenditures"))
            fcf    = (op_cf + capex) if op_cf and capex else (op_cf if op_cf else None)
            fcf_yield = round((fcf / mktcap) * 100, 2) if fcf and mktcap and mktcap > 0 else None

            # â”€â”€ EV y Deuda/EBITDA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            ev_abs      = (mktcap + net_debt) if mktcap and net_debt is not None else None
            debt_ebitda = round(net_debt / ebitda, 2) if net_debt is not None and ebitda and ebitda > 0 else None

            # â”€â”€ Perfil â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            name     = av.get("Name")     or fp.get("companyName") or sym
            sector   = av.get("Sector")   or fp.get("sector",   "")
            industry = av.get("Industry") or fp.get("industry", "")
            country  = av.get("Country")  or fp.get("country",  "")
            desc     = (av.get("Description") or fp.get("description", ""))[:500]
            employees = flt(av.get("FullTimeEmployees")) or fp.get("fullTimeEmployees")
            website  = fp.get("website", "")
            ceo      = fp.get("ceo", "")
            exchange = av.get("Exchange") or fp.get("exchange", "") or meta.get("exchangeName", "")

            # â”€â”€ Analistas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            strong_buy  = flt(av.get("AnalystRatingStrongBuy"))  or 0
            buy_count   = flt(av.get("AnalystRatingBuy"))        or 0
            hold_count  = flt(av.get("AnalystRatingHold"))       or 0
            sell_count  = flt(av.get("AnalystRatingSell"))       or 0
            strong_sell = flt(av.get("AnalystRatingStrongSell")) or 0
            total_buy   = int(strong_buy + buy_count)
            total_hold  = int(hold_count)
            total_sell  = int(sell_count + strong_sell)
            total_anal  = total_buy + total_hold + total_sell

            if total_buy > total_hold and total_buy > total_sell:
                rec_key = "buy" if strong_buy <= buy_count else "strongBuy"
            elif total_sell > total_hold and total_sell > total_buy:
                rec_key = "sell"
            elif total_anal > 0:
                rec_key = "hold"
            else:
                rec_key = ""

            result.update({
                "name": name, "sector": sector, "industry": industry,
                "country": country, "description": desc, "website": website,
                "ceo": ceo, "employees": int(employees) if employees else None, "exchange": exchange,
                "price":      round(price, 4) if price else None,
                "currency":   currency,
                "mktcap":     mktcap, "mktcap_fmt": fmt_b(mktcap),
                "ev":         ev_abs, "ev_fmt": fmt_b(ev_abs),
                "beta":       beta or fp.get("beta"),
                "high_52w":   week_high or meta.get("fiftyTwoWeekHigh"),
                "low_52w":    week_low  or meta.get("fiftyTwoWeekLow"),
                "shares":     shares,
                "forward_pe":  round(forward_pe,  2) if forward_pe  else None,
                "trailing_pe": round(trailing_pe, 2) if trailing_pe else None,
                "peg_ratio":   round(peg, 2) if peg else None,
                "pb":          round(pb, 2) if pb else None,
                "ps":          round(ps, 2) if ps else None,
                "ev_ebitda":   round(ev_ebitda,  2) if ev_ebitda  else None,
                "ev_revenue":  round(ev_revenue, 2) if ev_revenue else None,
                "fcf_yield":   fcf_yield,
                "revenue":        rev0, "revenue_fmt": fmt_b(rev0),
                "revenue_growth": rev_growth_calc,
                "ebitda":         ebitda, "ebitda_fmt": fmt_b(ebitda),
                "net_income":     net_income, "net_income_fmt": fmt_b(net_income),
                "eps":            eps, "eps_growth": eps_growth,
                "fcf":            fcf, "fcf_fmt": fmt_b(fcf),
                "margen_bruto":   margen_bruto,
                "margen_ebitda":  margen_ebitda,
                "margen_op":      margen_op,
                "margen_neto":    margen_neto,
                "cash_fmt":       fmt_b(cash),
                "net_debt":       net_debt, "net_debt_fmt": fmt_b(net_debt),
                "debt_ebitda":    debt_ebitda,
                "interest_cov":   interest_cov,
                "roe": roe, "roa": roa, "roic": None,
                "dividend_yield": div_yield, "payout_ratio": payout,
                "rec_key":       rec_key, "target_price": target_price,
                "num_analysts":  total_anal or None,
                "buy_analysts":  total_buy, "hold_analysts": total_hold, "sell_analysts": total_sell,
                "fwd_eps": None, "fwd_revenue": None,
            })

        except Exception as e:
            result["error"] = str(e)
            print(f"[fundamentals] Error {sym}: {e}")

        return result

    return await cached(f"fundamentals:{symbol.upper()}", fetch, ttl=86400)

# â”€â”€ CLAUDE AI PROXY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class ClaudeRequest(PydanticModel):
    prompt: str

@app.post("/ai/analyze")
async def ai_analyze(req: ClaudeRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada en el backend")
    payload = {
        "model": "claude-sonnet-4-20250514", "max_tokens": 1500,
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
        "messages": [{"role": "user", "content": req.prompt}],
    }
    async with httpx.AsyncClient(timeout=60.0) as c:
        r = await c.post("https://api.anthropic.com/v1/messages",
                         headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                                  "anthropic-beta": "web-search-2025-03-05", "content-type": "application/json"},
                         json=payload)
        if r.status_code != 200:
            raise HTTPException(r.status_code, f"Claude API error: {r.text[:200]}")
        data = r.json()
        text = " ".join(b["text"] for b in data.get("content", []) if b.get("type") == "text")
        return {"text": text}
