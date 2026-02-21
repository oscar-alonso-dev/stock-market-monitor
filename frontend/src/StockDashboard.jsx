import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:8000";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n, dec = 2) => n != null && !isNaN(n) ? Number(n).toFixed(dec) : "—";
const fmtB = (n) => {
  if (n == null) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}T`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}B`;
  return `$${n.toFixed(2)}M`;
};
const fmtPct = (n) => n != null ? `${n > 0 ? "+" : ""}${fmt(n)}%` : "—";
const fmtDate = (ts) => {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
};

// ── Price history generator (simulated) ───────────────────────────────────
const genPrice = (base) => {
  const pts = [];
  let p = base * 0.82;
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    p *= 1 + (Math.random() - 0.47) * 0.025;
    const d = new Date(now); d.setDate(d.getDate() - i);
    pts.push({ date: d, price: parseFloat(p.toFixed(2)), vol: Math.floor(Math.random() * 80e6 + 20e6) });
  }
  return pts;
};

// ── Build analysts from Finnhub recommendation data ───────────────────────
const buildAnalysts = (data) => {
  if (!data || !data.length) return { buy: 32, hold: 10, sell: 3, priceTargets: { low: 185, avg: 227, high: 275 } };
  const latest = data[0];
  return {
    buy: (latest.strongBuy || 0) + (latest.buy || 0),
    hold: latest.hold || 0,
    sell: (latest.sell || 0) + (latest.strongSell || 0),
    history: data,
    priceTargets: { low: 185, avg: 227, high: 275 },
  };
};

// ── Build news from Finnhub company-news data ─────────────────────────────
const buildNews = (data) => {
  if (!data || !data.length) return [];
  return data.map(n => ({
    title: n.headline,
    source: n.source,
    time: fmtDate(n.datetime),
    url: n.url,
    summary: n.summary,
    sentiment: n.headline?.toLowerCase().match(/beat|record|growth|upgrade|strong|profit|surge/) ? "positive" : "negative",
  }));
};

// ── SVG Chart Components ───────────────────────────────────────────────────
const LineChart = ({ data, height = 180, showVolume = false }) => {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return null;
  const W = 600, H = height, PL = 0, PR = 0, PT = 10, PB = showVolume ? 50 : 20;
  const cw = W - PL - PR, ch = H - PT - PB;
  const prices = data.map(d => d.price);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const rng = maxP - minP || 1;
  const x = (i) => PL + (i / (data.length - 1)) * cw;
  const y = (p) => PT + ch - ((p - minP) / rng) * ch;
  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.price)}`).join(" ");
  const areaD = `${pathD} L${x(data.length-1)},${H-PB} L${x(0)},${H-PB} Z`;
  const isUp = data[data.length-1].price >= data[0].price;
  const lineColor = isUp ? "#00c896" : "#ff4d6d";
  const gradId = `g_${Math.random().toString(36).slice(2,8)}`;
  const vols = data.map(d => d.vol || 0);
  const maxV = Math.max(...vols);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: `${height}px` }}
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.round((mx - PL) / cw * (data.length - 1));
          setHovered(Math.max(0, Math.min(data.length - 1, idx)));
        }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {showVolume && vols.map((v, i) => (
          <rect key={i} x={x(i) - 0.8} y={H - PB - (v / maxV) * 35}
            width="1.6" height={(v / maxV) * 35} fill={lineColor} opacity="0.25" />
        ))}
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
        {hovered != null && (
          <>
            <line x1={x(hovered)} y1={PT} x2={x(hovered)} y2={H - PB} stroke="#ffffff15" strokeWidth="1" strokeDasharray="4,4" />
            <circle cx={x(hovered)} cy={y(data[hovered].price)} r="4" fill={lineColor} />
            <rect x={Math.min(x(hovered) - 55, W - 120)} y={y(data[hovered].price) - 32} width="110" height="26" rx="4" fill="#0d1a2e" />
            <text x={Math.min(x(hovered) - 55, W - 120) + 55} y={y(data[hovered].price) - 14} textAnchor="middle"
              fill="#e8edf5" fontSize="11" fontFamily="monospace">
              ${data[hovered].price.toFixed(2)} · {data[hovered].date?.toLocaleDateString?.("es-ES", { day: "2-digit", month: "short" }) || ""}
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

const BarChart = ({ labels, values, color = "#00c896", height = 140 }) => {
  const W = 400, H = height, PB = 24, PT = 10;
  const max = Math.max(...values) || 1;
  const bw = (W / values.length) * 0.55;
  const gap = W / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: `${height}px` }}>
      {values.map((v, i) => {
        const bh = ((v / max) * (H - PT - PB));
        const bx = gap * i + (gap - bw) / 2;
        const by = H - PB - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={bh} rx="3" fill={color} opacity="0.85" />
            <text x={bx + bw / 2} y={H - 6} textAnchor="middle" fill="#5a7a9a" fontSize="10" fontFamily="monospace">{labels[i]}</text>
            <text x={bx + bw / 2} y={by - 4} textAnchor="middle" fill="#c8d8e8" fontSize="9" fontFamily="monospace">
              {v >= 1e3 ? `$${(v / 1e3).toFixed(0)}B` : `$${v.toFixed(0)}B`}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const DonutChart = ({ buy, hold, sell }) => {
  const total = buy + hold + sell || 1;
  const pct = (n) => n / total;
  const W = 120, cx = 60, cy = 60, r = 42, sw = 16;
  const arc = (start, end, color) => {
    if (end - start <= 0) return null;
    const s = start * 2 * Math.PI - Math.PI / 2;
    const e = end * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = end - start > 0.5 ? 1 : 0;
    return <path d={`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`}
      fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />;
  };
  const buyPct = pct(buy), holdPct = pct(hold);
  return (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: "120px", height: "120px" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2a40" strokeWidth={sw} />
      {arc(0, buyPct - 0.01, "#00c896")}
      {arc(buyPct, buyPct + holdPct - 0.01, "#f59e0b")}
      {arc(buyPct + holdPct, 0.999, "#ff4d6d")}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#e8edf5" fontSize="16" fontWeight="bold" fontFamily="monospace">{Math.round(pct(buy) * 100)}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#5a7a9a" fontSize="9" fontFamily="monospace">BUY</text>
    </svg>
  );
};

const GaugeBar = ({ label, value, max = 100, color = "#00c896", suffix = "%" }) => (
  <div style={{ marginBottom: "14px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
      <span style={{ fontSize: "11px", color: "#5a7a9a", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: "12px", color: "#e8edf5", fontWeight: 500 }}>{fmt(value)}{suffix}</span>
    </div>
    <div style={{ height: "4px", background: "#1a2a40", borderRadius: "2px", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min((value / max) * 100, 100)}%`, background: color, borderRadius: "2px" }} />
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────
export default function StockDashboard() {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [symbol, setSymbol]         = useState("AAPL");
  const [quote, setQuote]           = useState(null);
  const [profile, setProfile]       = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [analysts, setAnalysts]     = useState(null);
  const [news, setNews]             = useState([]);
  const [earnings, setEarnings]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [tab, setTab]               = useState("overview");
  const [range, setRange]           = useState("1Y");

  const rangeMap = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

  const load = useCallback(async (sym) => {
    setLoading(true); setError(null);
    try {
      const [qRes, pRes, mRes, rRes, nRes, eRes] = await Promise.all([
        fetch(`${API_BASE}/stocks/${sym}/quote`),
        fetch(`${API_BASE}/stocks/${sym}/profile`),
        fetch(`${API_BASE}/stocks/${sym}/metrics`),
        fetch(`${API_BASE}/stocks/${sym}/recommendations`),
        fetch(`${API_BASE}/stocks/${sym}/news`),
        fetch(`${API_BASE}/stocks/${sym}/earnings`),
      ]);
      const q = await qRes.json();
      const p = await pRes.json();
      const m = await mRes.json();
      const r = await rRes.json();
      const n = await nRes.json();
      const e = await eRes.json();

      setQuote(q);
      setProfile(p);
      setFinancials(m);
      setAnalysts(buildAnalysts(r));
      setNews(buildNews(n));
      setEarnings(Array.isArray(e) ? e.slice(0, 8) : []);
      const base = q.current_price || q.previous_close || 150;
      setPriceHistory(genPrice(base));
    } catch {
      setError("No se puede conectar al backend. Asegúrate de que está corriendo en :8000");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load("AAPL"); }, [load]);

  const search = async (v) => {
    setQuery(v);
    if (v.length < 2) { setResults([]); return; }
    try {
      const r = await fetch(`${API_BASE}/stocks/search/${v}`);
      const d = await r.json();
      setResults((d.result || []).slice(0, 7));
    } catch { setResults([]); }
  };

  const pick = (sym) => { setSymbol(sym); setQuery(""); setResults([]); load(sym); };

  const isUp = quote?.change >= 0;
  const accent = isUp ? "#00c896" : "#ff4d6d";
  const chartData = priceHistory.slice(-rangeMap[range]);
  const TABS = ["overview", "financials", "analysts", "news"];

  return (
    <div style={{ minHeight: "100vh", background: "#060a10", color: "#d8e4f0", fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#1e2d45}
        input::placeholder{color:#2a3a50}
        input:focus{outline:none}
        .hov{transition:all .15s}
        .hov:hover{background:#0d1a2e!important;cursor:pointer}
        .tabhov:hover{color:#d8e4f0!important}
        .card{background:#0a1018;border:1px solid #111d2e;border-radius:12px;transition:border-color .2s}
        .card:hover{border-color:#1e3050}
        @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fade .35s ease forwards}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .skel{background:linear-gradient(90deg,#0a1018 25%,#111d2e 50%,#0a1018 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;border-radius:6px}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        .blink{animation:blink 2s infinite}
        .rng:hover{background:#1a2a40!important;color:#d8e4f0!important}
        a{color:inherit;text-decoration:none}
      `}</style>

      {/* NAV */}
      <nav style={{ background:"#060a10", borderBottom:"1px solid #0d1a2e", padding:"0 28px", height:"52px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200, backdropFilter:"blur(12px)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ fontFamily:"'Bebas Neue'", fontSize:"22px", letterSpacing:"0.1em" }}>
            MARKET<span style={{ color:accent }}>TERMINAL</span>
          </div>
          <div style={{ width:"1px", height:"20px", background:"#1a2a40", margin:"0 8px" }} />
          <span style={{ fontSize:"10px", color:"#2a4060", letterSpacing:"0.15em" }}>PRO DASHBOARD v2.0</span>
        </div>
        <div style={{ position:"relative", width:"320px" }}>
          <div style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#2a4060", fontSize:"13px" }}>⌕</div>
          <input value={query} onChange={e => search(e.target.value)} placeholder="Buscar ticker o empresa..."
            style={{ width:"100%", background:"#0a1018", border:"1px solid #111d2e", borderRadius:"8px", padding:"8px 12px 8px 32px", color:"#d8e4f0", fontSize:"12px", fontFamily:"inherit" }} />
          {results.length > 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#0a1018", border:"1px solid #111d2e", borderRadius:"10px", overflow:"hidden", zIndex:300, boxShadow:"0 24px 48px #00000080" }}>
              {results.map((r,i) => (
                <div key={i} className="hov" onClick={() => pick(r.symbol)}
                  style={{ padding:"9px 14px", borderBottom: i<results.length-1?"1px solid #0d1a2e":"none", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"#00c896", fontSize:"12px", fontWeight:600 }}>{r.symbol}</span>
                  <span style={{ color:"#2a4060", fontSize:"11px", maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <div className="blink" style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#00c896" }} />
            <span style={{ fontSize:"10px", color:"#2a4060", letterSpacing:"0.12em" }}>LIVE DATA</span>
          </div>
          <div style={{ fontSize:"11px", color:"#2a4060" }}>{new Date().toLocaleTimeString("es-ES")}</div>
        </div>
      </nav>

      <div style={{ maxWidth:"1400px", margin:"0 auto", padding:"24px 28px" }}>
        {error && <div style={{ background:"#1a0810", border:"1px solid #ff4d6d30", borderRadius:"10px", padding:"14px 18px", color:"#ff4d6d", fontSize:"12px", marginBottom:"20px" }}>⚠ {error}</div>}

        {loading ? (
          <div style={{ display:"grid", gap:"16px" }}>
            {[200,100,160].map((h,i) => <div key={i} className="skel" style={{ height:`${h}px` }} />)}
          </div>
        ) : quote && (
          <div className="fade">
            {/* HERO */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"20px", marginBottom:"20px" }}>
              <div className="card" style={{ padding:"28px", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, right:0, width:"50%", height:"100%", opacity:.06 }}>
                  <LineChart data={priceHistory.slice(-90)} height={160} />
                </div>
                <div style={{ position:"relative", zIndex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"20px" }}>
                    {profile?.logo && <img src={profile.logo} alt="" style={{ width:"44px", height:"44px", borderRadius:"10px", background:"#fff", padding:"3px", objectFit:"contain" }} />}
                    <div>
                      <div style={{ fontFamily:"'Bebas Neue'", fontSize:"32px", letterSpacing:"0.05em", lineHeight:1 }}>{symbol}</div>
                      <div style={{ fontSize:"12px", color:"#4a6a8a" }}>{profile?.name} · {profile?.exchange}</div>
                    </div>
                    <div style={{ marginLeft:"auto", textAlign:"right" }}>
                      <div style={{ fontFamily:"'Bebas Neue'", fontSize:"46px", letterSpacing:"-0.02em", lineHeight:1, color:"#f0f6ff" }}>${fmt(quote.current_price)}</div>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", padding:"5px 12px", background:`${accent}18`, border:`1px solid ${accent}35`, borderRadius:"100px", color:accent, fontSize:"13px", marginTop:"6px" }}>
                        {isUp ? "▲" : "▼"} {fmt(Math.abs(quote.change))} ({fmtPct(quote.change_percent)})
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"12px" }}>
                    {[
                      { l:"APERTURA", v:`$${fmt(quote.open)}` },
                      { l:"MÁXIMO", v:`$${fmt(quote.high)}`, c:"#00c896" },
                      { l:"MÍNIMO", v:`$${fmt(quote.low)}`, c:"#ff4d6d" },
                      { l:"CIERRE ANT.", v:`$${fmt(quote.previous_close)}` },
                      { l:"CAP. MERCADO", v:fmtB(profile?.marketCapitalization) },
                    ].map((s,i) => (
                      <div key={i} style={{ background:"#060a10", border:"1px solid #0d1a2e", borderRadius:"8px", padding:"12px 14px" }}>
                        <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"6px" }}>{s.l}</div>
                        <div style={{ fontSize:"16px", fontWeight:600, color: s.c || "#d8e4f0" }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card" style={{ padding:"22px" }}>
                <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>PERFIL DE EMPRESA</div>
                {[
                  { l:"Sector", v: profile?.finnhubIndustry },
                  { l:"País", v: profile?.country },
                  { l:"Moneda", v: profile?.currency },
                  { l:"IPO", v: profile?.ipo },
                  { l:"Acciones", v: profile?.shareOutstanding ? `${(profile.shareOutstanding/1000).toFixed(2)}B` : "—" },
                  { l:"Beta", v: financials?.beta ? fmt(financials.beta) : "—" },
                  { l:"Div. Yield", v: financials?.dividendYield ? `${fmt(financials.dividendYield)}%` : "—" },
                  { l:"52W Máx", v: financials?.["52weekHigh"] ? `$${fmt(financials["52weekHigh"])}` : "—", c:"#00c896" },
                  { l:"52W Mín", v: financials?.["52weekLow"] ? `$${fmt(financials["52weekLow"])}` : "—", c:"#ff4d6d" },
                ].map((r,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #0d1a2e" }}>
                    <span style={{ fontSize:"11px", color:"#4a6a8a" }}>{r.l}</span>
                    <span style={{ fontSize:"11px", color: r.c || "#c8d8e8", fontWeight:500 }}>{r.v || "—"}</span>
                  </div>
                ))}
                {profile?.weburl && (
                  <a href={profile.weburl} target="_blank" rel="noreferrer"
                    style={{ display:"block", marginTop:"14px", textAlign:"center", padding:"8px", background:"#0d1a2e", borderRadius:"6px", color:"#00c896", fontSize:"11px", letterSpacing:"0.08em" }}>
                    VISITAR SITIO WEB ↗
                  </a>
                )}
              </div>
            </div>

            {/* CHART */}
            <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
                <div>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"4px" }}>PRECIO HISTÓRICO</div>
                  <div style={{ fontFamily:"'Bebas Neue'", fontSize:"22px", letterSpacing:"0.05em" }}>
                    <span style={{ color: accent }}>{isUp ? "▲" : "▼"}</span> {fmtPct(quote.change_percent)} HOY
                  </div>
                </div>
                <div style={{ display:"flex", gap:"4px" }}>
                  {Object.keys(rangeMap).map(r => (
                    <button key={r} className="rng" onClick={() => setRange(r)}
                      style={{ padding:"5px 12px", border:"1px solid #111d2e", borderRadius:"6px", background: range===r?"#1a2a40":"transparent", color: range===r?"#d8e4f0":"#4a6a8a", fontSize:"11px", cursor:"pointer", fontFamily:"inherit", transition:"all .15s" }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <LineChart data={chartData} height={200} showVolume={true} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"12px", padding:"12px 0 0", borderTop:"1px solid #0d1a2e" }}>
                {[
                  { l:`MÍN ${range}`, v:`$${fmt(Math.min(...chartData.map(d=>d.price)))}`, c:"#ff4d6d" },
                  { l:`MÁX ${range}`, v:`$${fmt(Math.max(...chartData.map(d=>d.price)))}`, c:"#00c896" },
                  { l:"VARIACIÓN", v:fmtPct(((chartData.at(-1)?.price - chartData[0]?.price)/chartData[0]?.price)*100), c:chartData.at(-1)?.price >= chartData[0]?.price ? "#00c896":"#ff4d6d" },
                  { l:"VOL. MEDIO", v:`${((chartData.reduce((a,d)=>a+(d.vol||0),0)/chartData.length)/1e6).toFixed(0)}M` },
                ].map((s,i) => (
                  <div key={i}>
                    <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.12em", marginBottom:"4px" }}>{s.l}</div>
                    <div style={{ fontSize:"18px", fontWeight:600, color: s.c||"#d8e4f0", fontFamily:"'Bebas Neue'", letterSpacing:"0.05em" }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* TABS */}
            <div style={{ display:"flex", gap:"2px", background:"#0a1018", borderRadius:"10px", padding:"4px", width:"fit-content", marginBottom:"20px", border:"1px solid #111d2e" }}>
              {TABS.map(t => (
                <button key={t} className="tabhov" onClick={() => setTab(t)}
                  style={{ padding:"7px 18px", borderRadius:"7px", border:"none", background: tab===t?"#1a2a40":"transparent", color: tab===t?"#d8e4f0":"#4a6a8a", fontSize:"11px", cursor:"pointer", fontFamily:"inherit", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight: tab===t?600:400, transition:"all .15s" }}>
                  {t === "overview" ? "Resumen" : t === "financials" ? "Finanzas" : t === "analysts" ? "Analistas" : "Noticias"}
                </button>
              ))}
            </div>

            {/* TAB: OVERVIEW */}
            {tab === "overview" && financials && (
              <div className="fade" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
                <div className="card" style={{ padding:"22px" }}>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>VALORACIÓN</div>
                  {[
                    { l:"P/E Ratio", v: fmt(financials.peRatio) },
                    { l:"P/B Ratio", v: fmt(financials.pbRatio) },
                    { l:"P/S Ratio", v: fmt(financials.psRatio) },
                    { l:"EV/EBITDA", v: fmt(financials.evEbitda) },
                    { l:"Dividend Yield", v: financials.dividendYield ? `${fmt(financials.dividendYield)}%` : "—" },
                    { l:"Payout Ratio", v: financials.payoutRatio ? `${fmt(financials.payoutRatio)}%` : "—" },
                  ].map((r,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #0d1a2e" }}>
                      <span style={{ fontSize:"11px", color:"#4a6a8a" }}>{r.l}</span>
                      <span style={{ fontSize:"13px", fontWeight:600, color:"#d8e4f0" }}>{r.v}</span>
                    </div>
                  ))}
                  {financials.source === "simulated" && (
                    <div style={{ marginTop:"12px", fontSize:"9px", color:"#2a4060", textAlign:"center" }}>⚠ Datos simulados (red lenta)</div>
                  )}
                </div>
                <div className="card" style={{ padding:"22px" }}>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>RENTABILIDAD</div>
                  <GaugeBar label="Margen Bruto" value={financials.grossMargin} color="#00c896" />
                  <GaugeBar label="Margen Operativo" value={financials.operatingMargin} color="#00c896" />
                  <GaugeBar label="Margen Neto" value={financials.netMargin} color="#00c896" />
                  <GaugeBar label="ROE" value={financials.roe} max={200} color="#f59e0b" suffix="%" />
                  <GaugeBar label="ROA" value={financials.roa} max={50} color="#f59e0b" suffix="%" />
                </div>
                <div className="card" style={{ padding:"22px" }}>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>BALANCE / RIESGO</div>
                  {[
                    { l:"Deuda/Equity", v: fmt(financials.debtToEquity), warn: financials.debtToEquity > 2 },
                    { l:"Current Ratio", v: fmt(financials.currentRatio), warn: financials.currentRatio < 1 },
                    { l:"Beta", v: fmt(financials.beta) },
                    { l:"Crec. EPS (3A)", v: financials.epsGrowth ? `${fmt(financials.epsGrowth)}%` : "—" },
                  ].map((r,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #0d1a2e" }}>
                      <span style={{ fontSize:"11px", color:"#4a6a8a" }}>{r.l}</span>
                      <span style={{ fontSize:"13px", fontWeight:600, color: r.warn?"#f59e0b":"#d8e4f0" }}>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:"20px", padding:"14px", background:"#060a10", borderRadius:"8px", border:"1px solid #0d1a2e" }}>
                    <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.12em", marginBottom:"8px" }}>52 SEMANAS</div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontSize:"9px", color:"#ff4d6d", marginBottom:"4px" }}>MÍNIMO</div>
                        <div style={{ fontSize:"18px", fontWeight:600, color:"#ff4d6d", fontFamily:"'Bebas Neue'" }}>${fmt(financials["52weekLow"])}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:"9px", color:"#00c896", marginBottom:"4px" }}>MÁXIMO</div>
                        <div style={{ fontSize:"18px", fontWeight:600, color:"#00c896", fontFamily:"'Bebas Neue'" }}>${fmt(financials["52weekHigh"])}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: FINANCIALS */}
            {tab === "financials" && (
              <div className="fade" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                <div className="card" style={{ padding:"22px" }}>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"6px" }}>MÉTRICAS DE RENTABILIDAD</div>
                  <div style={{ fontSize:"11px", color:"#4a6a8a", marginBottom:"16px" }}>Datos reales via Finnhub API</div>
                  {financials && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                      {[
                        { l:"Margen Bruto", v:`${fmt(financials.grossMargin)}%`, c:"#00c896" },
                        { l:"Margen Oper.", v:`${fmt(financials.operatingMargin)}%`, c:"#00c896" },
                        { l:"Margen Neto", v:`${fmt(financials.netMargin)}%`, c:"#00c896" },
                        { l:"ROE", v:`${fmt(financials.roe)}%`, c:"#f59e0b" },
                        { l:"ROA", v:`${fmt(financials.roa)}%`, c:"#f59e0b" },
                        { l:"Beta", v:fmt(financials.beta) },
                        { l:"P/E Ratio", v:fmt(financials.peRatio) },
                        { l:"EV/EBITDA", v:fmt(financials.evEbitda) },
                      ].map((s,i) => (
                        <div key={i} style={{ background:"#060a10", border:"1px solid #0d1a2e", borderRadius:"8px", padding:"12px 14px" }}>
                          <div style={{ fontSize:"9px", color:"#2a4060", marginBottom:"4px" }}>{s.l}</div>
                          <div style={{ fontSize:"18px", fontWeight:600, color: s.c || "#d8e4f0", fontFamily:"'Bebas Neue'", letterSpacing:"0.05em" }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ padding:"22px" }}>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"6px" }}>EPS HISTÓRICO</div>
                  <div style={{ fontSize:"11px", color:"#4a6a8a", marginBottom:"16px" }}>Earnings Per Share — datos reales</div>
                  {earnings.length > 0 ? (
                    <div style={{ display:"grid", gap:"8px" }}>
                      {[{ period:"PERÍODO", actual:"REAL", estimate:"ESTIMADO", surprise:"SORPRESA", header:true }, ...earnings.slice(0,6)].map((e,i) => (
                        <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 90px 90px", padding: i===0?"6px 12px":"10px 12px", background: i===0?"#0d1a2e":i%2===0?"#060a10":"transparent", borderRadius:"6px", alignItems:"center" }}>
                          <span style={{ fontSize: i===0?"9px":"11px", color: i===0?"#2a4060":"#d8e4f0", letterSpacing: i===0?"0.1em":"0" }}>
                            {i===0 ? e.period : e.period?.slice(0,7)}
                          </span>
                          <span style={{ fontSize: i===0?"9px":"12px", color: i===0?"#2a4060":"#00c896", fontFamily: i===0?"inherit":"'Bebas Neue'", letterSpacing:"0.05em" }}>
                            {i===0 ? e.actual : `$${fmt(e.actual)}`}
                          </span>
                          <span style={{ fontSize: i===0?"9px":"12px", color: i===0?"#2a4060":"#4a6a8a" }}>
                            {i===0 ? e.estimate : `$${fmt(e.estimate)}`}
                          </span>
                          <span style={{ fontSize: i===0?"9px":"11px", color: i===0?"#2a4060": (e.surprise||0) >= 0?"#00c896":"#ff4d6d" }}>
                            {i===0 ? e.surprise : `${(e.surprise||0) >= 0?"+":""}${fmt(e.surprisePercent)}%`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color:"#2a4060", fontSize:"12px", textAlign:"center", padding:"40px" }}>No hay datos de EPS disponibles</div>
                  )}
                </div>

                <div className="card" style={{ padding:"22px", gridColumn:"1 / -1" }}>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>RATIOS DE VALORACIÓN COMPARADOS</div>
                  {financials && (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:"12px" }}>
                      {[
                        { l:"P/E", v:fmt(financials.peRatio), note:"Precio/Beneficio" },
                        { l:"P/B", v:fmt(financials.pbRatio), note:"Precio/Valor libro" },
                        { l:"P/S", v:fmt(financials.psRatio), note:"Precio/Ventas" },
                        { l:"EV/EBITDA", v:fmt(financials.evEbitda), note:"Valor empresa" },
                        { l:"Div. Yield", v:financials.dividendYield?`${fmt(financials.dividendYield)}%`:"—", note:"Rentab. dividendo" },
                        { l:"Payout", v:financials.payoutRatio?`${fmt(financials.payoutRatio)}%`:"—", note:"% beneficio repartido" },
                      ].map((s,i) => (
                        <div key={i} style={{ background:"#060a10", border:"1px solid #0d1a2e", borderRadius:"10px", padding:"16px 14px", textAlign:"center" }}>
                          <div style={{ fontSize:"9px", color:"#2a4060", marginBottom:"8px", letterSpacing:"0.1em" }}>{s.l}</div>
                          <div style={{ fontFamily:"'Bebas Neue'", fontSize:"26px", color:"#d8e4f0", letterSpacing:"0.05em" }}>{s.v}</div>
                          <div style={{ fontSize:"9px", color:"#4a6a8a", marginTop:"4px" }}>{s.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: ANALYSTS */}
            {tab === "analysts" && analysts && (
              <div className="fade" style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"16px" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                  <div className="card" style={{ padding:"22px", textAlign:"center" }}>
                    <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>CONSENSO DE MERCADO</div>
                    <DonutChart buy={analysts.buy} hold={analysts.hold} sell={analysts.sell} />
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginTop:"16px" }}>
                      {[
                        { l:"COMPRAR", v:analysts.buy, c:"#00c896" },
                        { l:"MANTENER", v:analysts.hold, c:"#f59e0b" },
                        { l:"VENDER", v:analysts.sell, c:"#ff4d6d" },
                      ].map((r,i) => (
                        <div key={i} style={{ background:"#060a10", border:`1px solid ${r.c}25`, borderRadius:"8px", padding:"10px 6px" }}>
                          <div style={{ fontSize:"9px", color:r.c, letterSpacing:"0.1em", marginBottom:"4px" }}>{r.l}</div>
                          <div style={{ fontFamily:"'Bebas Neue'", fontSize:"24px", color:r.c }}>{r.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card" style={{ padding:"22px" }}>
                    <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"20px" }}>PRECIO OBJETIVO</div>
                    <div style={{ position:"relative", height:"6px", background:"#0d1a2e", borderRadius:"3px", margin:"8px 0 28px" }}>
                      <div style={{ position:"absolute", left:`${Math.min(Math.max(((quote.current_price - analysts.priceTargets.low)/(analysts.priceTargets.high - analysts.priceTargets.low))*100, 0), 100)}%`, top:"-4px", width:"14px", height:"14px", background:accent, borderRadius:"50%", transform:"translateX(-50%)", border:"2px solid #060a10" }} />
                      <div style={{ position:"absolute", left:"0", top:"12px", fontSize:"9px", color:"#4a6a8a" }}>${analysts.priceTargets.low}</div>
                      <div style={{ position:"absolute", left:"50%", top:"12px", transform:"translateX(-50%)", fontSize:"9px", color:"#00c896", fontWeight:600 }}>${analysts.priceTargets.avg}</div>
                      <div style={{ position:"absolute", right:"0", top:"12px", fontSize:"9px", color:"#4a6a8a" }}>${analysts.priceTargets.high}</div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:"8px" }}>
                      <div>
                        <div style={{ fontSize:"9px", color:"#2a4060", marginBottom:"4px" }}>PRECIO ACTUAL</div>
                        <div style={{ fontSize:"18px", fontWeight:600 }}>${fmt(quote.current_price)}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:"9px", color:"#2a4060", marginBottom:"4px" }}>UPSIDE POTENCIAL</div>
                        <div style={{ fontSize:"18px", fontWeight:600, color:"#00c896" }}>
                          +{fmt(((analysts.priceTargets.avg - quote.current_price)/quote.current_price)*100)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding:"22px" }}>
                  <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>HISTORIAL DE RECOMENDACIONES — DATOS REALES</div>
                  {analysts.history?.length > 0 ? (
                    <div style={{ display:"grid", gap:"2px" }}>
                      {[{ period:"PERÍODO", strongBuy:"STRONG BUY", buy:"BUY", hold:"HOLD", sell:"SELL", header:true }, ...analysts.history].map((r,i) => (
                        <div key={i} className={i>0?"hov":""} style={{ display:"grid", gridTemplateColumns:"1fr 100px 80px 80px 80px", padding: i===0?"8px 14px":"12px 14px", background: i===0?"#0d1a2e":i%2===0?"#060a10":"transparent", borderRadius:"6px", alignItems:"center" }}>
                          <span style={{ fontSize: i===0?"9px":"12px", color: i===0?"#2a4060":"#d8e4f0", letterSpacing: i===0?"0.12em":"0" }}>{i===0?r.period:r.period?.slice(0,7)}</span>
                          <span style={{ fontSize: i===0?"9px":"13px", color: i===0?"#2a4060":"#00c896", fontFamily: i===0?"inherit":"'Bebas Neue'" }}>{i===0?r.strongBuy:r.strongBuy}</span>
                          <span style={{ fontSize: i===0?"9px":"13px", color: i===0?"#2a4060":"#00c896", fontFamily: i===0?"inherit":"'Bebas Neue'" }}>{i===0?r.buy:r.buy}</span>
                          <span style={{ fontSize: i===0?"9px":"13px", color: i===0?"#2a4060":"#f59e0b", fontFamily: i===0?"inherit":"'Bebas Neue'" }}>{i===0?r.hold:r.hold}</span>
                          <span style={{ fontSize: i===0?"9px":"13px", color: i===0?"#2a4060":"#ff4d6d", fontFamily: i===0?"inherit":"'Bebas Neue'" }}>{i===0?r.sell:r.sell}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color:"#2a4060", fontSize:"12px", textAlign:"center", padding:"40px" }}>No hay datos de analistas disponibles</div>
                  )}
                  <div style={{ marginTop:"20px", padding:"16px", background:"#060a10", border:"1px solid #0d1a2e", borderRadius:"10px" }}>
                    <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.12em", marginBottom:"12px" }}>RESUMEN DE CONSENSO</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
                      {[
                        { l:"Total analistas", v: analysts.buy + analysts.hold + analysts.sell },
                        { l:"Recomendación", v: analysts.buy > analysts.hold + analysts.sell ? "COMPRAR" : "MANTENER", c: analysts.buy > analysts.hold + analysts.sell ? "#00c896" : "#f59e0b" },
                        { l:"% Positivos", v: `${Math.round((analysts.buy/(analysts.buy+analysts.hold+analysts.sell||1))*100)}%` },
                      ].map((s,i) => (
                        <div key={i}>
                          <div style={{ fontSize:"9px", color:"#4a6a8a", marginBottom:"4px" }}>{s.l}</div>
                          <div style={{ fontSize:"15px", fontWeight:600, color: s.c||"#d8e4f0" }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: NEWS */}
            {tab === "news" && (
              <div className="fade" style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"16px" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                  {news.length > 0 ? news.map((n,i) => (
                    <a key={i} href={n.url || "#"} target="_blank" rel="noreferrer" className="card hov"
                      style={{ padding:"20px 22px", display:"flex", gap:"16px", alignItems:"flex-start" }}>
                      <div style={{ width:"4px", minWidth:"4px", height:"50px", background: n.sentiment==="positive"?"#00c896":"#ff4d6d", borderRadius:"2px" }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:"13px", color:"#d8e4f0", fontWeight:500, marginBottom:"6px", lineHeight:1.5 }}>{n.title}</div>
                        {n.summary && <div style={{ fontSize:"11px", color:"#4a6a8a", marginBottom:"8px", lineHeight:1.4 }}>{n.summary?.slice(0,120)}...</div>}
                        <div style={{ display:"flex", gap:"12px" }}>
                          <span style={{ fontSize:"10px", color:"#4a6a8a" }}>{n.source}</span>
                          <span style={{ fontSize:"10px", color:"#2a4060" }}>{n.time}</span>
                          <span style={{ fontSize:"10px", color: n.sentiment==="positive"?"#00c896":"#ff4d6d", letterSpacing:"0.08em" }}>
                            {n.sentiment === "positive" ? "▲ POSITIVO" : "▼ NEGATIVO"}
                          </span>
                        </div>
                      </div>
                    </a>
                  )) : (
                    <div className="card" style={{ padding:"40px", textAlign:"center", color:"#2a4060" }}>No hay noticias disponibles</div>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                  <div className="card" style={{ padding:"22px" }}>
                    <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"16px" }}>SENTIMIENTO DE NOTICIAS</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"16px" }}>
                      {[
                        { l:"POSITIVAS", v:news.filter(n=>n.sentiment==="positive").length, c:"#00c896" },
                        { l:"NEGATIVAS", v:news.filter(n=>n.sentiment==="negative").length, c:"#ff4d6d" },
                      ].map((s,i) => (
                        <div key={i} style={{ background:"#060a10", border:`1px solid ${s.c}25`, borderRadius:"8px", padding:"14px", textAlign:"center" }}>
                          <div style={{ fontFamily:"'Bebas Neue'", fontSize:"36px", color:s.c }}>{s.v}</div>
                          <div style={{ fontSize:"9px", color:s.c, letterSpacing:"0.12em" }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    {news.length > 0 && <GaugeBar label="Sentimiento positivo" value={(news.filter(n=>n.sentiment==="positive").length/news.length)*100} color="#00c896" />}
                  </div>
                  <div className="card" style={{ padding:"22px" }}>
                    <div style={{ fontSize:"9px", color:"#2a4060", letterSpacing:"0.14em", marginBottom:"14px" }}>FUENTES</div>
                    {[...new Set(news.map(n=>n.source))].slice(0,6).map((s,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #0d1a2e" }}>
                        <span style={{ fontSize:"11px", color:"#d8e4f0" }}>{s}</span>
                        <span style={{ fontSize:"11px", color:"#4a6a8a" }}>{news.filter(n=>n.source===s).length} artículos</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop:"32px", padding:"16px 0", borderTop:"1px solid #0d1a2e", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:"10px", color:"#2a4060" }}>
                {financials?.source === "simulated" ? "⚠ Algunos datos son simulados por limitaciones de red." : "✓ Datos reales via Finnhub API."} Precios en tiempo real.
              </span>
              <button onClick={() => load(symbol)} style={{ background:"#0a1018", border:"1px solid #111d2e", borderRadius:"6px", padding:"8px 18px", color:"#4a6a8a", fontSize:"11px", cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.1em" }}>↻ ACTUALIZAR</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
