import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { API_BASE } from "./config.js";

// ─── Utils ────────────────────────────────────────────────────────────────────
const n4  = v => v != null && !isNaN(v) ? Number(v).toFixed(4) : "—";
const n2  = v => v != null && !isNaN(v) ? Number(v).toFixed(2) : "—";
const pct = v => v != null && !isNaN(v) ? `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—";
const mil = v => v != null && !isNaN(v) ? `${(v / 1e6).toFixed(0)} M€` : "—";
const clr = v => v == null || isNaN(v) ? "#64748b" : v >= 0 ? "#16a34a" : "#dc2626";
const MONO = { fontFamily: "ui-monospace,'JetBrains Mono',monospace" };

// ─── Sparkline mini ───────────────────────────────────────────────────────────
function Spark({ history, positive }) {
  const vals = (history || []).slice(-60).map(h => h.nav).filter(Boolean);
  if (vals.length < 2) return <div style={{ width: 80, height: 32 }} />;
  const W = 80, H = 32, mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  const pts = vals.map((v, i) =>
    `${(i / (vals.length - 1) * W).toFixed(1)},${(H - ((v - mn) / rng) * (H - 4) - 2).toFixed(1)}`
  ).join(" ");
  const c = positive === false ? "#dc2626" : "#16a34a";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Gráfica histórico ────────────────────────────────────────────────────────
function NavChart({ history }) {
  const [hov, setHov] = useState(null);
  const [w, setW]     = useState(600);
  const ref    = useRef(null);
  const gidRef = useRef("g" + Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    const ob = new ResizeObserver(([e]) => setW(e.contentRect.width || 600));
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, []);

  const pts = (history || []).filter(h => h.nav > 0);
  const gid = gidRef.current;

  if (pts.length < 2) {
    return <div ref={ref} style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Sin histórico disponible</div>;
  }

  const PL = 56, PR = 16, PT = 12, PB = 28, H = 200;
  const cw = w - PL - PR, ch = H - PT - PB;
  const navs = pts.map(p => p.nav);
  const mn = Math.min(...navs), mx = Math.max(...navs);
  const pad = (mx - mn) * 0.08 || 1;
  const yMn = mn - pad, yRng = mx + pad - yMn;
  const xp = i => PL + (i / (pts.length - 1)) * cw;
  const yp = v => PT + ch - ((v - yMn) / yRng) * ch;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xp(i).toFixed(1)},${yp(p.nav).toFixed(1)}`).join(" ");
  const first = navs[0], last = navs.at(-1);
  const isUp = last >= first;
  const c = isUp ? "#16a34a" : "#dc2626";
  const area = `${d} L${xp(pts.length - 1).toFixed(1)},${PT + ch} L${PL},${PT + ch} Z`;
  const yLabels = [0, 0.5, 1].map(f => ({ v: yMn + f * yRng, y: PT + ch * (1 - f) }));
  const xStep = Math.max(1, Math.floor(pts.length / 5));
  const xLabels = [0, 1, 2, 3, 4].map(i => Math.min(i * xStep, pts.length - 1));
  const onMove = e => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.round(((e.clientX - r.left - PL) / cw) * (pts.length - 1));
    setHov(Math.max(0, Math.min(pts.length - 1, i)));
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
      <div style={{ height: 28, display: "flex", alignItems: "center", gap: 16, padding: "0 4px", ...MONO, fontSize: 12 }}>
        {hov != null ? (
          <>
            <span style={{ color: "#64748b" }}>
              {new Date(pts[hov].date * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <span style={{ color: "#1e293b", fontWeight: 700 }}>{n4(pts[hov].nav)}</span>
            <span style={{ color: clr(((pts[hov].nav - first) / first) * 100) }}>
              {pct(((pts[hov].nav - first) / first) * 100)} desde inicio
            </span>
          </>
        ) : (
          <span style={{ color: "#94a3b8" }}>Rentabilidad total período: <strong style={{ color: clr(((last - first) / first) * 100) }}>{pct(((last - first) / first) * 100)}</strong></span>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity=".12" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1={PL} x2={w - PR} y1={l.y} y2={l.y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PL - 6} y={l.y + 4} textAnchor="end" fill="#94a3b8" fontSize={10} fontFamily="monospace">{n2(l.v)}</text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={d} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
        {hov != null ? (
          <>
            <line x1={xp(hov)} x2={xp(hov)} y1={PT} y2={PT + ch} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 2" />
            <circle cx={xp(hov)} cy={yp(pts[hov].nav)} r={4} fill={c} stroke="white" strokeWidth={2} />
          </>
        ) : (
          <circle cx={xp(pts.length - 1)} cy={yp(last)} r={3.5} fill={c} stroke="white" strokeWidth={2} />
        )}
        {xLabels.map((i, k) => (
          <text key={k} x={xp(i)} y={H - 6} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">
            {new Date(pts[i].date * 1000).toLocaleDateString("es-ES", { month: "short", year: "2-digit" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Panel lateral detalle ────────────────────────────────────────────────────
function DetailPanel({ fund, detail, loading, error, onClose }) {
  const [tab, setTab]           = useState("resumen");
  const [holdings, setHoldings] = useState(null);
  const [holdLoad, setHoldLoad] = useState(false);
  const [quotes, setQuotes]     = useState({});
  const pollRef                 = useRef(null);

  useEffect(() => { setTab("resumen"); setHoldings(null); setQuotes({}); }, [fund?.isin]);

  // Función para cargar cotizaciones
  const loadQuotes = useCallback(async (holdingsList) => {
    const tickers = holdingsList.map(h => h.ticker).filter(Boolean);
    if (!tickers.length) return;
    try {
      const r = await fetch(`${API_BASE}/stocks/quotes/batch?symbols=${tickers.join(",")}`);
      if (r.ok) setQuotes(await r.json());
    } catch { }
  }, []);

  useEffect(() => {
    if (tab !== "posiciones" || holdings || holdLoad) return;
    setHoldLoad(true);
    fetch(`${API_BASE}/funds/${fund.isin}/holdings`)
      .then(r => r.ok ? r.json() : null)
      .then(async d => {
        setHoldings(d);
        setHoldLoad(false);
        if (d?.holdings?.length) {
          // Carga inicial
          await loadQuotes(d.holdings);
          // Polling cada 30 segundos
          pollRef.current = setInterval(() => loadQuotes(d.holdings), 30000);
        }
      })
      .catch(() => setHoldLoad(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, fund?.isin, holdings, holdLoad, loadQuotes]);

  // Limpiar polling al cerrar panel
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const rets = [
    { l: "1 semana", v: detail?.return_1w },
    { l: "1 mes",    v: detail?.return_1m },
    { l: "3 meses",  v: detail?.return_3m },
    { l: "6 meses",  v: detail?.return_6m },
    { l: "YTD",      v: detail?.return_ytd },
    { l: "1 año",    v: detail?.return_1y },
    { l: "3 años",   v: detail?.return_3y },
    { l: "5 años",   v: detail?.return_5y },
  ].filter(r => r.v != null);

  const navUp = (detail?.change_pct || 0) >= 0;

  return (
    <div style={{
      background: "white", border: "1px solid #e2e8f0", borderRadius: 12,
      overflow: "hidden", position: "sticky", top: 16,
      maxHeight: "calc(100vh - 32px)", overflowY: "auto",
      boxShadow: "0 4px 24px rgba(0,0,0,.08)",
    }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.3, marginBottom: 3 }}>
              {detail?.name || fund?.name}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{detail?.mgr || fund?.mgr}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {detail?.category && (
                <span style={{ fontSize: 11, color: "#475569", background: "#e2e8f0", padding: "2px 8px", borderRadius: 20 }}>
                  {detail.category}
                </span>
              )}
              <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 20, ...MONO }}>
                {fund.isin}
              </span>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, width: 30, height: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#94a3b8", fontSize: 16, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}>✕</button>
        </div>

        {/* NAV */}
        {detail && !loading && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...MONO, fontSize: 30, fontWeight: 700, color: "#0f172a" }}>
                {n4(detail.current_nav || detail.current_price)}
              </span>
              <span style={{ fontSize: 13, color: "#64748b" }}>{detail.currency}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              {detail.change_pct != null && (
                <span style={{
                  ...MONO, fontSize: 14, fontWeight: 600,
                  color: navUp ? "#16a34a" : "#dc2626",
                  background: navUp ? "#dcfce7" : "#fee2e2",
                  padding: "3px 10px", borderRadius: 6,
                }}>
                  {navUp ? "▲" : "▼"} {pct(detail.change_pct)}
                </span>
              )}
              {detail.nav_date && <span style={{ fontSize: 11, color: "#94a3b8" }}>a {detail.nav_date}</span>}
            </div>
            {detail.total_assets && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                Patrimonio: <strong>{mil(detail.total_assets)}</strong>
                {detail.ter && <span> · TER: <strong>{n2(detail.ter)}%</strong></span>}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "45%", background: "#3b82f6", animation: "finect-slide 1s infinite" }} />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Cargando datos...</div>
          </div>
        )}
        {error && !loading && <div style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>⚠ {error}</div>}
      </div>

      {/* Tabs */}
      {detail && !loading && (
        <>
          <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "white" }}>
            {[["resumen","Resumen"],["grafica","Gráfica"],["posiciones","Cartera"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: "10px 4px", background: "none", border: "none",
                borderBottom: `2px solid ${tab === id ? "#3b82f6" : "transparent"}`,
                color: tab === id ? "#3b82f6" : "#64748b",
                fontSize: 13, fontWeight: tab === id ? 600 : 400,
                fontFamily: "inherit", cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>

          {/* Resumen */}
          {tab === "resumen" && (
            <div style={{ padding: "16px 20px" }}>
              {rets.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Rentabilidades</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                    <tbody>
                      {rets.map(r => (
                        <tr key={r.l} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "7px 0", fontSize: 13, color: "#475569" }}>{r.l}</td>
                          <td style={{ padding: "7px 0", textAlign: "right", ...MONO, fontSize: 13, fontWeight: 600, color: clr(r.v) }}>{pct(r.v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Información</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["Gestora", detail.mgr],
                    ["Divisa",  detail.currency],
                    ["TER",     detail.ter ? `${n2(detail.ter)}%` : null],
                    ["Patrimonio", detail.total_assets ? mil(detail.total_assets) : null],
                    ["Fuente",  detail.source === "morningstar" ? "Morningstar" : detail.source === "cnmv" ? "CNMV" : "Yahoo Finance"],
                  ].filter(([,v]) => v).map(([l, v]) => (
                    <tr key={l} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 0", fontSize: 13, color: "#475569" }}>{l}</td>
                      <td style={{ padding: "7px 0", textAlign: "right", fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Gráfica */}
          {tab === "grafica" && (
            <div style={{ padding: "12px 8px 8px" }}>
              <NavChart history={detail.history} />
            </div>
          )}

          {/* Posiciones */}
          {tab === "posiciones" && (
            <div style={{ padding: "16px 20px" }}>
              {holdLoad && (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 30 }}>
                  Cargando cartera...
                </div>
              )}
              {!holdLoad && holdings?.holdings?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                    Principales posiciones · {holdings.holdings.length} empresas
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "6px 0", fontSize: 11, color: "#94a3b8", textAlign: "left", fontWeight: 600 }}>Empresa</th>
                        <th style={{ padding: "6px 0", fontSize: 11, color: "#94a3b8", textAlign: "right", fontWeight: 600 }}>Cotización</th>
                        <th style={{ padding: "6px 0", fontSize: 11, color: "#94a3b8", textAlign: "right", fontWeight: 600 }}>Hoy</th>
                        <th style={{ padding: "6px 0", fontSize: 11, color: "#94a3b8", textAlign: "right", fontWeight: 600 }}>Peso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.holdings.map((h, i) => {
                        const q = quotes[h.ticker];
                        const qUp = q ? q.change_pct >= 0 : null;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                            <td style={{ padding: "8px 0" }}>
                              <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{h.name}</div>
                              <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                                {h.ticker && <span style={{ ...MONO, fontSize: 10, color: "#3b82f6" }}>{h.ticker}</span>}
                                {h.country && <span style={{ fontSize: 10, color: "#cbd5e1" }}>{h.country}</span>}
                              </div>
                              <div style={{ marginTop: 4, height: 2, background: "#f1f5f9", borderRadius: 2 }}>
                                <div style={{ height: "100%", width: `${Math.min(h.weight * 6, 100)}%`, background: "#3b82f6", borderRadius: 2 }} />
                              </div>
                            </td>
                            <td style={{ padding: "8px 0 8px 8px", textAlign: "right", ...MONO, fontSize: 12, color: "#1e293b", verticalAlign: "top" }}>
                              {q ? `${n2(q.price)} ${q.currency || ""}` : "—"}
                            </td>
                            <td style={{ padding: "8px 0 8px 8px", textAlign: "right", ...MONO, fontSize: 12, fontWeight: 600,
                              color: qUp === null ? "#94a3b8" : qUp ? "#16a34a" : "#dc2626", verticalAlign: "top" }}>
                              {q ? pct(q.change_pct) : "—"}
                            </td>
                            <td style={{ padding: "8px 0 8px 8px", textAlign: "right", ...MONO, fontSize: 13, fontWeight: 700, color: "#1e293b", verticalAlign: "top" }}>
                              {n2(h.weight)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
                    Posiciones: Morningstar · Cotizaciones: Yahoo Finance (tiempo real)
                  </div>
                </>
              )}
              {!holdLoad && !holdings?.holdings?.length && (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>Posiciones no disponibles</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    Ejecuta el scraper para activar este dato
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Funds() {
  const [catalog, setCatalog]     = useState([]);
  const [details, setDetails]     = useState({});
  const [loading, setLoading]     = useState({});
  const [errors, setErrors]       = useState({});
  const [selected, setSelected]   = useState(null);
  const [activeGrp, setActiveGrp] = useState("Todos");
  const [filter, setFilter]       = useState("");
  const loaded = useRef(new Set());

  // Cargar catálogo dinámico del backend
  useEffect(() => {
    fetch(`${API_BASE}/funds/catalog`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setCatalog(Array.isArray(d) ? d : []))
      .catch(() => setCatalog([]));
  }, []);

  const GROUPS = useMemo(() => ["Todos", ...new Set(catalog.map(f => f.grp))], [catalog]);

  const loadDetail = useCallback(async (isin) => {
    if (loaded.current.has(isin)) return;
    loaded.current.add(isin);
    setLoading(p => ({ ...p, [isin]: true }));
    try {
      const r = await fetch(`${API_BASE}/funds/${isin}/detail`);
      if (r.ok) {
        const d = await r.json();
        if (d.detail) throw new Error(d.detail);
        setDetails(p => ({ ...p, [isin]: d }));
      } else {
        setErrors(p => ({ ...p, [isin]: `Error ${r.status}` }));
      }
    } catch (e) {
      setErrors(p => ({ ...p, [isin]: e.message }));
    }
    setLoading(p => ({ ...p, [isin]: false }));
  }, []);

  useEffect(() => {
    if (!catalog.length) return;
    const run = async () => {
      for (let i = 0; i < catalog.length; i++) {
        loadDetail(catalog[i].isin);
        if (i % 6 === 5) await new Promise(r => setTimeout(r, 200));
      }
    };
    run();
  }, [catalog, loadDetail]);

  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  const filtered = useMemo(() => {
    let list = catalog;
    if (activeGrp !== "Todos") list = list.filter(f => f.grp === activeGrp);
    if (filter.trim()) {
      const fl = filter.toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(fl) ||
        f.isin.toLowerCase().includes(fl) ||
        f.mgr.toLowerCase().includes(fl) ||
        (details[f.isin]?.name || "").toLowerCase().includes(fl)
      );
    }
    return list;
  }, [catalog, activeGrp, filter, details]);

  const grouped = useMemo(() => {
    if (activeGrp !== "Todos") return [{ grp: activeGrp, funds: filtered }];
    return [...new Set(filtered.map(f => f.grp))].map(g => ({
      grp: g, funds: filtered.filter(f => f.grp === g)
    }));
  }, [filtered, activeGrp]);

  const loadedCount = Object.values(details).filter(d => d?.current_nav || d?.current_price).length;
  const selectedFund = catalog.find(f => f.isin === selected) || { isin: selected, name: selected, mgr: "" };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes finect-pulse { 0%,100%{opacity:.3} 50%{opacity:.9} }
        @keyframes finect-slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px }
        ::-webkit-scrollbar-track { background: #f1f5f9 }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>

        {/* HEADER */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#0f172a" }}>
            Fondos de Inversión
          </h1>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {catalog.length} fondos y ETFs · <span style={{ color: "#16a34a", fontWeight: 500 }}>{loadedCount} con datos</span> · Datos vía Morningstar y CNMV
          </div>
        </div>

        {/* FILTROS */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Buscador */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200,
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px" }}>
            <span style={{ color: "#94a3b8", fontSize: 15 }}>🔍</span>
            <input value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="Buscar fondo, gestora o ISIN…"
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "#1e293b", fontFamily: "inherit" }} />
            {filter && <button onClick={() => setFilter("")}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>✕</button>}
          </div>

          {/* Categorías */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GROUPS.map(g => {
              const cnt = g === "Todos" ? catalog.length : catalog.filter(f => f.grp === g).length;
              const active = activeGrp === g;
              return (
                <button key={g} onClick={() => setActiveGrp(g)} style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: `1px solid ${active ? "#3b82f6" : "#e2e8f0"}`,
                  background: active ? "#eff6ff" : "white",
                  color: active ? "#3b82f6" : "#475569",
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  {g} <span style={{ opacity: .6, fontSize: 11 }}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* LAYOUT PRINCIPAL */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 16, alignItems: "start" }}>

          {/* TABLA */}
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>

            {/* Cabecera tabla */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 88px 70px 70px 70px 70px 84px 12px",
              padding: "10px 16px", borderBottom: "2px solid #e2e8f0", gap: 8, background: "#f8fafc" }}>
              {["Fondo / Gestora","NAV","Hoy","1 Mes","1 Año","3 Años","Evolución",""].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: ".06em", textAlign: i === 0 ? "left" : "right" }}>{h}</div>
              ))}
            </div>

            {/* Filas */}
            <div style={{ maxHeight: "72vh", overflowY: "auto" }}>
              {grouped.length === 0 && (
                <div style={{ padding: 50, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                  Sin resultados para "{filter}"
                </div>
              )}
              {grouped.map(({ grp, funds }) => (
                <div key={grp}>
                  {activeGrp === "Todos" && (
                    <div style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
                      fontSize: 12, fontWeight: 600, color: "#475569", letterSpacing: ".04em" }}>
                      {grp}
                    </div>
                  )}
                  {funds.map(f => {
                    const d    = details[f.isin];
                    const l    = loading[f.isin];
                    const err  = errors[f.isin];
                    const nav  = d?.current_nav || d?.current_price;
                    const isSel = selected === f.isin;
                    const r1yUp = d?.return_1y != null ? d.return_1y >= 0 : null;

                    return (
                      <div key={f.isin}
                        onClick={() => setSelected(isSel ? null : f.isin)}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "white"; }}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 88px 70px 70px 70px 70px 84px 12px",
                          padding: "11px 16px", gap: 8, alignItems: "center", cursor: "pointer",
                          background: isSel ? "#eff6ff" : "white",
                          borderBottom: "1px solid #f1f5f9",
                          borderLeft: `3px solid ${isSel ? "#3b82f6" : "transparent"}`,
                          transition: "all .1s",
                        }}>

                        {/* Nombre */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d?.name || f.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "flex", gap: 10 }}>
                            <span>{f.mgr}</span>
                            <span style={{ ...MONO }}>{f.isin}</span>
                          </div>
                        </div>

                        {l ? (
                          <div style={{ gridColumn: "2/8", height: 8, background: "#f1f5f9", borderRadius: 4,
                            animation: "finect-pulse 1.5s ease-in-out infinite" }} />
                        ) : d && nav ? (
                          <>
                            <div style={{ ...MONO, fontSize: 13, color: "#0f172a", textAlign: "right", fontWeight: 700 }}>{n4(nav)}</div>
                            <div style={{ ...MONO, fontSize: 12, color: clr(d.change_pct), textAlign: "right", fontWeight: 600 }}>{pct(d.change_pct)}</div>
                            <div style={{ ...MONO, fontSize: 12, color: clr(d.return_1m), textAlign: "right" }}>{pct(d.return_1m)}</div>
                            <div style={{ ...MONO, fontSize: 12, color: clr(d.return_1y), textAlign: "right" }}>{pct(d.return_1y)}</div>
                            <div style={{ ...MONO, fontSize: 12, color: clr(d.return_3y), textAlign: "right" }}>{pct(d.return_3y)}</div>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <Spark history={d.history} positive={r1yUp} />
                            </div>
                          </>
                        ) : (
                          <div style={{ gridColumn: "2/8", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                            {err || "Sin datos"}
                          </div>
                        )}

                        <div style={{ width: 8, height: 8, borderRadius: "50%",
                          background: isSel ? "#3b82f6" : (d && nav ? "#16a34a" : "#e2e8f0"),
                          margin: "0 auto" }} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer tabla */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                Clic en una fila para ver detalle, gráfica y cartera de posiciones
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 80, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${catalog.length ? (loadedCount / catalog.length) * 100 : 0}%`,
                    background: "#16a34a", transition: "width .4s" }} />
                </div>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{filtered.length} fondos</span>
              </div>
            </div>
          </div>

          {/* PANEL DETALLE */}
          {selected && (
            <DetailPanel
              key={selected}
              fund={selectedFund}
              detail={details[selected]}
              loading={loading[selected]}
              error={errors[selected]}
              onClose={() => setSelected(null)}
            />
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: "#cbd5e1", textAlign: "center" }}>
          Datos: Morningstar · CNMV · NAV actualizado diariamente
        </div>
      </div>
    </div>
  );
}
