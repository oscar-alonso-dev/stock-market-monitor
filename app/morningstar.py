"""
morningstar.py — Datos de fondos desde la API interna de Morningstar
La misma que usa morningstar.com/es — sin API key, token automático por ISIN.
"""

import httpx, asyncio, json, re, time
from typing import Optional

# ── Cache simple en memoria ───────────────────────────────────────────────────
_cache: dict = {}

def _cache_get(key: str, ttl: int) -> Optional[dict]:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < ttl:
            return data
    return None

def _cache_set(key: str, data: dict):
    _cache[key] = (data, time.time())

# ── Headers que imitan un navegador real ─────────────────────────────────────
HEADERS_BASE = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Origin": "https://www.morningstar.es",
    "Referer": "https://www.morningstar.es/",
}

# ── Paso 1: obtener token Bearer de Morningstar ───────────────────────────────
async def _get_token(client: httpx.AsyncClient) -> Optional[str]:
    """
    Morningstar genera un JWT automáticamente al visitar su web.
    Lo obtenemos del endpoint de autenticación público.
    """
    key = "ms_token"
    cached = _cache_get(key, ttl=300)  # token válido ~5 min
    if cached:
        return cached.get("token")

    try:
        r = await client.get(
            "https://www.morningstar.es/api/rest.svc/klr5zyak8x/login",
            headers=HEADERS_BASE,
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            token = data.get("token")
            if token:
                _cache_set(key, {"token": token})
                return token
    except Exception:
        pass

    # Fallback: token público conocido (válido temporalmente)
    try:
        r = await client.get(
            "https://www.morningstar.com/api/cauth/user",
            headers={**HEADERS_BASE, "Referer": "https://www.morningstar.com/"},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            token = data.get("token") or data.get("access_token")
            if token:
                _cache_set(key, {"token": token})
                return token
    except Exception:
        pass

    return None

# ── Paso 2: buscar SecId de Morningstar por ISIN ─────────────────────────────
async def _isin_to_secid(isin: str, client: httpx.AsyncClient) -> Optional[str]:
    """Convierte ISIN → SecId de Morningstar (identificador interno)."""
    key = f"ms_secid:{isin}"
    cached = _cache_get(key, ttl=86400)
    if cached:
        return cached.get("secid")

    try:
        r = await client.get(
            "https://www.morningstar.es/api/rest.svc/klr5zyak8x/security_details",
            params={"isin": isin, "locale": "es-ES"},
            headers=HEADERS_BASE,
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            secid = (data or [{}])[0].get("Id") or (data or [{}])[0].get("SecId")
            if secid:
                _cache_set(key, {"secid": secid})
                return secid
    except Exception:
        pass

    # Fallback: buscador de Morningstar
    try:
        r = await client.get(
            "https://www.morningstar.es/api/rest.svc/klr5zyak8x/securities/search",
            params={"q": isin, "limit": 1, "locale": "es-ES"},
            headers=HEADERS_BASE,
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            results = data.get("m", []) or data.get("results", [])
            if results:
                secid = results[0].get("id") or results[0].get("SecId")
                if secid:
                    _cache_set(key, {"secid": secid})
                    return secid
    except Exception:
        pass

    return None

# ── Paso 3: datos completos del fondo por ISIN ───────────────────────────────
async def get_fund_data(isin: str) -> Optional[dict]:
    """
    Devuelve datos completos del fondo desde Morningstar:
    nombre, VL, rentabilidades, categoría, gestora, posiciones, etc.
    """
    cache_key = f"ms_fund:{isin}"
    cached = _cache_get(cache_key, ttl=3600)
    if cached:
        return cached

    async with httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=True,
        limits=httpx.Limits(max_connections=10)
    ) as client:

        result = await _fetch_morningstar_fund(isin, client)
        if result:
            _cache_set(cache_key, result)

        return result


async def _fetch_morningstar_fund(isin: str, client: httpx.AsyncClient) -> Optional[dict]:
    """Intenta múltiples endpoints de Morningstar para obtener datos del fondo."""

    # ── Endpoint 1: API pública de Morningstar ES con ISIN directo ──────────
    try:
        r = await client.get(
            f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/security_details",
            params={
                "isin": isin,
                "locale": "es-ES",
                "viewId": "MFsnapshot",
            },
            headers=HEADERS_BASE,
            timeout=12,
        )
        if r.status_code == 200:
            raw = r.json()
            if raw and isinstance(raw, list) and len(raw) > 0:
                parsed = _parse_morningstar_snapshot(raw[0], isin)
                if parsed and parsed.get("current_nav"):
                    return parsed
    except Exception as e:
        print(f"[MS] Endpoint 1 falló para {isin}: {e}")

    # ── Endpoint 2: Buscador de Morningstar ─────────────────────────────────
    try:
        r = await client.get(
            "https://www.morningstar.es/api/rest.svc/klr5zyak8x/securities/search",
            params={"q": isin, "limit": 5, "locale": "es-ES", "universe": "FOESP$$ALL"},
            headers=HEADERS_BASE,
            timeout=12,
        )
        if r.status_code == 200:
            data = r.json()
            results = data.get("m", []) or []
            if results:
                fund = results[0]
                return _parse_morningstar_search(fund, isin)
    except Exception as e:
        print(f"[MS] Endpoint 2 falló para {isin}: {e}")

    # ── Endpoint 3: API de Financial Times (gratuita, datos buenos) ─────────
    try:
        r = await client.get(
            f"https://markets.ft.com/data/funds/tearsheet/summary?s={isin}:EUR:ESP",
            headers={
                **HEADERS_BASE,
                "Origin": "https://markets.ft.com",
                "Referer": "https://markets.ft.com/",
            },
            timeout=12,
        )
        if r.status_code == 200:
            text = r.text
            parsed = _parse_ft_fund(text, isin)
            if parsed and parsed.get("current_nav"):
                return parsed
    except Exception as e:
        print(f"[MS] FT falló para {isin}: {e}")

    # ── Endpoint 4: Morningstar UK (más permisivo) ───────────────────────────
    try:
        r = await client.get(
            "https://www.morningstar.co.uk/api/rest.svc/klr5zyak8x/security_details",
            params={"isin": isin, "locale": "en-GB"},
            headers={**HEADERS_BASE, "Referer": "https://www.morningstar.co.uk/"},
            timeout=12,
        )
        if r.status_code == 200:
            raw = r.json()
            if raw and isinstance(raw, list) and len(raw) > 0:
                parsed = _parse_morningstar_snapshot(raw[0], isin)
                if parsed:
                    return parsed
    except Exception as e:
        print(f"[MS] Endpoint UK falló para {isin}: {e}")

    return None


# ── Parsers ───────────────────────────────────────────────────────────────────

def _parse_morningstar_snapshot(data: dict, isin: str) -> Optional[dict]:
    """Parsea respuesta del endpoint security_details de Morningstar."""
    try:
        nav = data.get("Nav") or data.get("NAV") or data.get("Price")
        if not nav:
            return None

        name = (data.get("Name") or data.get("LegalName") or
                data.get("FundName") or isin)

        def safe_float(v):
            try:
                return round(float(v), 4) if v is not None else None
            except (ValueError, TypeError):
                return None

        return {
            "symbol":           isin,
            "isin":             isin,
            "name":             name,
            "type":             "Fondo de Inversión",
            "currency":         data.get("Currency") or data.get("CurrencyId") or "EUR",
            "category":         data.get("CategoryName") or data.get("Category") or "",
            "subcategory":      data.get("CategoryGroupName") or "",
            "management_company": data.get("BrandingCompanyName") or data.get("FundFamily") or "",
            "domicile":         data.get("DomicileName") or data.get("Domicile") or "",
            "inception_date":   data.get("InceptionDate") or "",
            "morningstar_rating": data.get("RatingOverall") or data.get("StarRatingM255") or 0,
            "morningstar_id":   data.get("SecId") or data.get("Id") or "",
            "current_nav":      safe_float(nav),
            "current_price":    safe_float(nav),
            "nav_date":         data.get("NavDate") or data.get("PriceDate") or "",
            "return_1d":        safe_float(data.get("DailyReturn") or data.get("ReturnD1")),
            "return_1w":        safe_float(data.get("Return1Week") or data.get("ReturnW1")),
            "return_1m":        safe_float(data.get("Return1Month") or data.get("ReturnM1")),
            "return_3m":        safe_float(data.get("Return3Month") or data.get("ReturnM3")),
            "return_6m":        safe_float(data.get("Return6Month") or data.get("ReturnM6")),
            "return_ytd":       safe_float(data.get("ReturnYTD") or data.get("ReturnYtd")),
            "return_1y":        safe_float(data.get("Return1Year") or data.get("ReturnY1")),
            "return_3y":        safe_float(data.get("Return3Year") or data.get("ReturnY3")),
            "return_5y":        safe_float(data.get("Return5Year") or data.get("ReturnY5")),
            "volatility_1y":    safe_float(data.get("Volatility1Year") or data.get("VolatilityM12")),
            "sharpe_ratio":     safe_float(data.get("SharpeRatio") or data.get("SharpeM36")),
            "max_drawdown":     safe_float(data.get("MaxDrawdown") or data.get("MaxDrawdownM36")),
            "total_assets":     safe_float(data.get("TotalNetAssets") or data.get("FundNetAssets")),
            "ter":              safe_float(data.get("TER") or data.get("OngoingCharge") or data.get("AnnualReportNetExpenseRatio")),
            "min_investment":   safe_float(data.get("MinPurchase") or data.get("InitialPurchase")),
            "benchmark":        data.get("IndexName") or data.get("BenchmarkName") or "",
            "source":           "morningstar",
        }
    except Exception as e:
        print(f"[MS] Error parseando snapshot: {e}")
        return None


def _parse_morningstar_search(data: dict, isin: str) -> Optional[dict]:
    """Parsea resultado del buscador de Morningstar."""
    try:
        nav = data.get("nav") or data.get("price") or data.get("Price")
        name = data.get("name") or data.get("Name") or isin

        def safe_float(v):
            try:
                return round(float(v), 4) if v is not None else None
            except (ValueError, TypeError):
                return None

        return {
            "symbol":             isin,
            "isin":               isin,
            "name":               name,
            "type":               "Fondo de Inversión",
            "currency":           data.get("currency") or "EUR",
            "category":           data.get("categoryName") or data.get("category") or "",
            "management_company": data.get("brandingCompanyName") or data.get("family") or "",
            "morningstar_rating": data.get("ratingOverall") or data.get("starRating") or 0,
            "morningstar_id":     data.get("secId") or data.get("id") or "",
            "current_nav":        safe_float(nav),
            "current_price":      safe_float(nav),
            "return_1d":          safe_float(data.get("dailyReturn") or data.get("return1Day")),
            "return_1m":          safe_float(data.get("return1Month")),
            "return_ytd":         safe_float(data.get("returnYTD")),
            "return_1y":          safe_float(data.get("return1Year")),
            "return_3y":          safe_float(data.get("return3Year")),
            "source":             "morningstar_search",
        }
    except Exception as e:
        print(f"[MS] Error parseando search: {e}")
        return None


def _parse_ft_fund(html: str, isin: str) -> Optional[dict]:
    """Extrae datos del HTML de Financial Times como fallback."""
    try:
        # FT incluye datos en JSON dentro del HTML
        match = re.search(r'__NEXT_DATA__\s*=\s*(\{.*?\})\s*</script>', html, re.DOTALL)
        if not match:
            return None
        data = json.loads(match.group(1))
        # Navegar por el JSON de FT para extraer precio, nombre, etc.
        props = data.get("props", {}).get("pageProps", {})
        fund_data = props.get("data", {}) or props.get("fund", {})
        price = fund_data.get("price") or fund_data.get("nav")
        name = fund_data.get("name") or fund_data.get("title") or isin
        if not price:
            return None
        return {
            "symbol": isin,
            "isin": isin,
            "name": name,
            "type": "Fondo de Inversión",
            "currency": "EUR",
            "current_nav": round(float(price), 4),
            "current_price": round(float(price), 4),
            "source": "financial_times",
        }
    except Exception:
        return None


# ── Búsqueda de fondos en Morningstar ────────────────────────────────────────
async def search_funds_morningstar(query: str, limit: int = 10) -> list:
    """Busca fondos por nombre o ISIN en Morningstar."""
    cache_key = f"ms_search:{query.lower().strip()}"
    cached = _cache_get(cache_key, ttl=300)
    if cached:
        return cached.get("results", [])

    results = []
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        for universe in ["FOESP$$ALL", "FOEUR$$ALL", "FO$$ALL"]:
            try:
                r = await client.get(
                    "https://www.morningstar.es/api/rest.svc/klr5zyak8x/securities/search",
                    params={
                        "q": query,
                        "limit": limit,
                        "locale": "es-ES",
                        "universe": universe,
                    },
                    headers=HEADERS_BASE,
                    timeout=10,
                )
                if r.status_code == 200:
                    data = r.json()
                    raw = data.get("m", []) or []
                    for item in raw:
                        results.append({
                            "id":       item.get("id") or item.get("SecId", ""),
                            "isin":     item.get("isin") or item.get("ISIN", ""),
                            "name":     item.get("name") or item.get("Name", ""),
                            "type":     "fund",
                            "currency": item.get("currency") or "EUR",
                            "category": item.get("categoryName") or "",
                            "source":   "morningstar",
                        })
                    if results:
                        break
            except Exception:
                continue

    _cache_set(cache_key, {"results": results})
    return results


# ── Histórico de VL desde Morningstar ────────────────────────────────────────
async def get_fund_history_morningstar(isin: str, years: int = 1) -> list:
    """Obtiene histórico de VL del fondo desde Morningstar."""
    cache_key = f"ms_history:{isin}:{years}"
    cached = _cache_get(cache_key, ttl=3600)
    if cached:
        return cached.get("history", [])

    history = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        # Obtener SecId primero
        secid = await _isin_to_secid(isin, client)
        if not secid:
            return []

        try:
            import datetime
            end = datetime.date.today().strftime("%Y-%m-%d")
            start_year = datetime.date.today().year - years
            start = f"{start_year}-01-01"

            r = await client.get(
                f"https://www.morningstar.es/api/rest.svc/klr5zyak8x/security_details",
                params={
                    "secId": secid,
                    "idtype": "SecId",
                    "frequency": "daily",
                    "startDate": start,
                    "endDate": end,
                    "outputType": "COMPACTJSON",
                    "locale": "es-ES",
                },
                headers=HEADERS_BASE,
                timeout=15,
            )
            if r.status_code == 200:
                data = r.json()
                for row in (data.get("TimeSeries", {}).get("Security", [{}])[0]
                            .get("HistoryDetail", [])):
                    try:
                        history.append({
                            "date": row.get("EndDate"),
                            "nav": round(float(row.get("Value", 0)), 4)
                        })
                    except (ValueError, TypeError):
                        continue
        except Exception as e:
            print(f"[MS] Error histórico para {isin}: {e}")

    _cache_set(cache_key, {"history": history})
    return history
