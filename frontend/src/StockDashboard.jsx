import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = "http://localhost:8000";
const REFRESH = 30000;
const GEMINI_API_KEY = "AIzaSyCSfLr1szDDA_tRqkhsLTFGf8bk_lM8uBQ";

export default function StockDashboard({ initialSymbol }) {
  const startSym = initialSymbol || "AAPL";
  const [symbol, setSymbol] = useState(startSym);
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [analisis, setAnalisis] = useState(null);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const timerRef = useRef(null);
  const countRef = useRef(null);
  const symRef = useRef(startSym);

  const load = useCallback(async (sym, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [qRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/stocks/${sym}/quote`),
        fetch(`${API_BASE}/stocks/${sym}/profile`)
      ]);
      const q = await qRes.json();
      const p = await pRes.json();
      setQuote(q);
      setProfile(p);
      setCountdown(30);
    } catch { 
      if (!silent) setError("No se puede conectar al backend"); 
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load(startSym);
    timerRef.current = setInterval(() => load(symRef.current, true), REFRESH);
    countRef.current = setInterval(() => setCountdown(c => c > 0 ? c-1 : 30), 1000);
    return () => { 
      clearInterval(timerRef.current); 
      clearInterval(countRef.current); 
    };
  }, [load, startSym]);

  const pick = (sym) => {
    setSymbol(sym); 
    symRef.current = sym;
    setQuery(""); 
    setResults([]);
    setAnalisis(null);
    load(sym);
  };

  const search = async (v) => {
    setQuery(v);
    if (v.length < 2) { setResults([]); return; }
    try {
      const r = await fetch(`${API_BASE}/stocks/search/${v}`);
      const d = await r.json();
      setResults((d.result||[]).slice(0,8));
    } catch { 
      setResults([]); 
    }
  };

  const generarAnalisisIA = async () => {
    setLoadingAnalisis(true);
    setAnalisis(null);
    
    const PROMPT = `[ROL]
Actúa como analista senior de renta variable (20+ años). Sé crítico, equilibrado y evidencia-primero. Entrega un resumen accionable y auditable.

[INPUT (único)]
- Ticker: ${symbol}
- Horizonte: 12–24 meses.

[CONFIGURACIÓN DEL GENERADOR]
MODO: EXHAUSTIVO. Completa todos los apartados; si faltan datos, marca [NO DISPONIBLE]/[NO VERIF].
Perfil: Largo plazo.
FORMATO: Ficha (bullets) directa y accionable.
LENGUAJE: Intermedio (claro, define jerga cuando aparezca).

[VALORACIÓN / SCORE]
Valoración: triangulación (DCF si hay base + [PROXY] + consenso/PT si existe).
Score mode: Estándar (5 pilares)

[TÉCNICO]
Técnico: BÁSICO (RSI14 + 50/200 + 1–2 niveles) en 1D+1W. Uso: timing + gestión de riesgo.

[RIESGOS / CATALIZADORES]
Riesgos: 3–5 kill-switch + 2–5 adicionales (Prob/Impacto).
Mitigantes: ON (para kill-switch, añade mitigante relevante o [NO VERIF]).
Ventana de catalizadores: 6m.
Exit criteria: ON (1–3 condiciones claras y medibles).

[GOVERNANCE/ESG + RED FLAGS]
Governance/ESG: Material-only (1 línea si es material; si no, omite o [NO VERIF]).
Red flags contables: BÁSICO (SBC/dilución, FCF vs beneficio, cash conversion, AR/inventario, ajustes recurrentes).

REGLAS CRÍTICAS (OBLIGATORIAS)
1) No inventes datos. [NO VERIF] = afirmaciones sin soporte. [NO DISPONIBLE] = dato no existe.
2) Toda cifra relevante debe llevar Fuente (F1, F2, F3…).
3) Prioridad de fuentes: IR/filings/transcripts > reguladores/bolsa > consenso > proveedores.
4) Si hay discrepancias: "Diferencia de fuentes" (1–3 líneas) + justificación.
5) Alinea todo con el horizonte.
6) Técnico = contexto/timing: no cambies BUY/HOLD/SELL solo por técnico.

FORMATO DE SALIDA (OBLIGATORIO)

1) TÍTULO
### {Nombre Empresa} (${symbol}) – {BUY/HOLD/SELL}
Modo: EXHAUSTIVO. Horizonte: 12–24 meses.

2) FAIR VALUE / UPSIDE
- Fair Value / Upside: {DCF o [PROXY]}, {PT consenso o [NO DISPONIBLE]}. Upside: {x}%–{y}%. (F1–F3)

3) SCORE (1–100)
- Score total: {0–100}
- Pilares (pesos 1–10, sub-score 0–100):
1) Valoración y margen de seguridad — Peso {1–10} — Sub-score {0–100}
2) Calidad del negocio (moat + pricing power) — Peso {1–10} — Sub-score {0–100}
3) Finanzas y balance (resiliencia) — Peso {1–10} — Sub-score {0–100}
4) Crecimiento y ejecución (guidance + señales) — Peso {1–10} — Sub-score {0–100}
5) Asimetría riesgo/retorno (lectura global) — Peso {1–10} — Sub-score {0–100}
- Cálculo: media ponderada. Penaliza por falta de datos.
- Encaje score ↔ etiqueta: 1 línea.

4) BLOQUES PRINCIPALES (con métricas y fuentes)
- Modelo de Negocio: 2–3 líneas. (F1)
- Ventaja Competitiva (moat cuantificado): 3–5 bullets + ≥1 métrica. (F1/F3 o [NO VERIF])
- Solidez Financiera: 5–8 métricas con números. (F1/F2)
- Calidad (ROIC/ROE/ROA o KPIs sectoriales). (F1/F2)
- Management (+Governance/ESG si material): 1–3 bullets. (F1/F4 o [NO VERIF])
- Ventas y Crecimiento/Guidance: FY/TTM, YoY, métrica recurrente, CAGR/guía + drivers. (F1/F2)
- Mercado y competencia: drivers, cuota si existe, pricing, regulación subsector. (F3/F4)
- Performance (si aplica): vs benchmark (alfa vs beta). (F2/F3)
- Técnico (si ON): refuerza o matiza timing; no tesis independiente. (F2/F3)

5) RIESGOS Y CATALIZADORES
- Riesgos kill-switch: Riesgo — Prob(A/M/B) — Impacto(A/M/B) — Mitigante o [NO VERIF]
- Catalizadores: Positivos/Negativos con hitos verificables.

6) TESIS Y VEREDICTO {BUY/HOLD/SELL}
- Tesis (1–2 frases).
- 3–6 motivos, atados a 4 pilares: (i) FV/upside, (ii) calidad, (iii) balance, (iv) catalizadores.

7) EXIT CRITERIA
- 1–3 condiciones medibles.

8) FUENTES
- Fuentes: F1, F2, F3, F4…

9) DISCLAIMER + FIRMA
_este contenido es solo para fines informativos y no constituye asesoramiento de inversión._

Zorte On!
Ortzi`;

    try {
      // URL CORRECTA: usa v1 en lugar de v1beta, y gemini-pro en lugar de gemini-1.5-flash
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8000 }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setAnalisis(`❌ Error: ${data.error.message}`);
      } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        setAnalisis(data.candidates[0].content.parts[0].text);
      } else {
        setAnalisis("❌ No se pudo generar el análisis");
      }
    } catch (err) {
      setAnalisis(`❌ Error: ${err.message}`);
    }
    
    setLoadingAnalisis(false);
  };

  const isUp = (quote?.change||0) >= 0;
  const accent = isUp ? "#22c55e" : "#ef4444";

  return (
    <div style={{ background: "#0b0f18", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {error && <div style={{ background: "#1a0a0a", border: "1px solid #ef444430", borderRadius: "8px", padding: "12px 16px", color: "#ef4444", fontSize: "13px", marginBottom: "16px" }}>⚠ {error}</div>}

        {/* SEARCH */}
        <div style={{ position: "relative", marginBottom: "24px" }}>
          <input 
            value={query} 
            onChange={e => search(e.target.value)} 
            placeholder="Busca ticker..."
            style={{ width: "400px", background: "#111827", border: "1px solid #1e2a3a", borderRadius: "8px", padding: "10px 14px", color: "#e2e8f0", fontSize: "13px" }} 
          />
          {results.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, width: "400px", background: "#111827", border: "1px solid #1e2a3a", borderRadius: "8px", overflow: "hidden", zIndex: 200, boxShadow: "0 20px 40px #00000060" }}>
              {results.map((r, i) => (
                <div 
                  key={i} 
                  onClick={() => pick(r.symbol)}
                  style={{ padding: "10px 14px", borderBottom: i<results.length-1?"1px solid #1e2a3a":"none", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1a2332"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#e2e8f0" }}>{r.symbol}</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{r.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>Cargando...</div>}

        {!loading && quote && profile && (
          <>
            {/* HEADER */}
            <div style={{ marginBottom: "24px" }}>
              <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#e2e8f0", margin: "0 0 8px 0" }}>{symbol}</h1>
              <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>{profile.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                <span style={{ fontSize: "40px", fontWeight: 700, color: "#e2e8f0" }}>${quote.current_price?.toFixed(2)}</span>
                <span style={{ fontSize: "18px", fontWeight: 600, color: accent }}>
                  {isUp?"+":""}{quote.change?.toFixed(2)} ({isUp?"+":""}{quote.change_percent?.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* ANÁLISIS IA */}
            <div style={{ background: "#111827", border: "1px solid #1e2a3a", borderRadius: "10px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Análisis Exhaustivo con IA</h2>
                <button 
                  onClick={generarAnalisisIA}
                  disabled={loadingAnalisis}
                  style={{ 
                    background: loadingAnalisis ? "#334155" : "#3b82f6", 
                    color: "#fff", 
                    border: "none", 
                    borderRadius: "8px", 
                    padding: "10px 20px", 
                    fontSize: "14px", 
                    fontWeight: 600, 
                    cursor: loadingAnalisis ? "not-allowed" : "pointer",
                    opacity: loadingAnalisis ? 0.6 : 1
                  }}>
                  {loadingAnalisis ? "⏳ Generando análisis..." : "🤖 Generar Análisis IA"}
                </button>
              </div>
              {analisis ? (
                <div style={{ fontSize: "14px", lineHeight: 1.8, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>
                  {analisis}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#64748b", padding: "60px 0" }}>
                  {loadingAnalisis 
                    ? "Gemini está analizando la empresa..." 
                    : "Haz clic en 'Generar Análisis IA' para obtener un informe completo"}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
