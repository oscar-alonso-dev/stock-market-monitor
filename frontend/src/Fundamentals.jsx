import { useState, useCallback, useEffect } from "react";
import { API_BASE } from "./config.js";

const MONO  = { fontFamily: "ui-monospace,'JetBrains Mono',monospace" };
const GREEN = "#16a34a", RED = "#dc2626", YELLOW = "#d97706", BLUE = "#3b82f6", PURPLE = "#7c3aed";

const HINTS = {
  forward_pe:   "P/E futuro < 15 es barato históricamente. > 30 exige crecimiento alto. Compara siempre con el sector.",
  trailing_pe:  "P/E histórico basado en beneficios reales de los últimos 12 meses. Más fiable que el forward para empresas maduras.",
  ev_ebitda:    "EV/EBITDA < 10 es atractivo. > 20 implica expectativas muy altas. Elimina el efecto de la estructura de capital.",
  fcf_yield:    "FCF Yield > 5% es atractivo. > 8% puede indicar infravaloración. Más honesto que el beneficio contable.",
  debt_ebitda:  "< 2x es conservador. > 4x preocupante. > 6x en ciclo bajista puede ser peligroso.",
  margen_ebitda:"< 10% es bajo. 15-25% es bueno. > 30% indica ventaja competitiva fuerte (pricing power).",
  roe:          "ROE > 15% indica que la empresa usa bien el capital. Buffett busca > 20% consistente. Alto ROE con mucha deuda puede ser engañoso.",
  revenue_growth:"Crecimiento > 10% sostenido es excelente. Lo ideal es crecimiento orgánico con mejora de márgenes.",
  ps:           "Price/Sales < 1x muy barato, > 10x muy caro. En SaaS/tech > 10x puede justificarse con crecimiento alto.",
  pb:           "Price/Book < 1x puede indicar infravaloración. > 5x implica que el mercado valora mucho los intangibles.",
  peg:          "PEG < 1 sugiere infravaloración respecto al crecimiento. PEG = P/E ÷ tasa de crecimiento esperada.",
  interest_cov: "Cobertura de intereses > 3x es saludable. < 1.5x es preocupante. Mide cuántas veces el EBIT cubre los intereses.",
  current_ratio:"Ratio corriente > 1.5x es bueno. < 1x puede indicar problemas de liquidez a corto plazo.",
  roic:         "ROIC > coste de capital (WACC) significa que la empresa crea valor. > 15% es excelente.",
};

const EJEMPLOS = ["AAPL","MSFT","NVDA","ITX.MC","SAN.MC","AMZN","TSLA","META","ASML.AS","GOOGL"];

function n(v, dec=2) { return v != null && !isNaN(v) ? Number(v).toFixed(dec) : "N/D"; }
function pct(v) { return v != null && !isNaN(v) ? `${v >= 0 ? "+" : ""}${Number(v).toFixed(1)}%` : "N/D"; }

function sig(val, thresholds, invert=false) {
  if (val == null || isNaN(val)) return "grey";
  const [good, warn] = thresholds;
  if (!invert) return val <= good ? "green" : val <= warn ? "yellow" : "red";
  return val >= good ? "green" : val >= warn ? "yellow" : "red";
}

const SIG_COLORS = { green: GREEN, yellow: YELLOW, red: RED, grey: "#94a3b8" };
const SIG_LABELS = { green: "✓ Bueno", yellow: "⚠ Neutral", red: "✗ Precaución", grey: "" };

function MetricRow({ label, value, unit="", hint, signal="grey", big=false }) {
  const [open, setOpen] = useState(false);
  const sc = SIG_COLORS[signal];
  return (
    <div style={{ borderBottom:"1px solid #f1f5f9", paddingBottom:10, marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:13, color:"#475569" }}>{label}</span>
          {hint && (
            <button onClick={()=>setOpen(!open)} style={{
              background:"none", border:"1px solid #e2e8f0", borderRadius:"50%",
              width:17, height:17, fontSize:10, color:"#94a3b8", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
            }}>?</button>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {signal !== "grey" && (
            <span style={{ fontSize:11, color:sc, fontWeight:600 }}>{SIG_LABELS[signal]}</span>
          )}
          <span style={{ ...MONO, fontSize:big?18:14, fontWeight:700, color:"#0f172a" }}>
            {value}{value !== "N/D" ? unit : ""}
          </span>
        </div>
      </div>
      {open && hint && (
        <div style={{ marginTop:6, background:"#eff6ff", border:"1px solid #bfdbfe",
          borderRadius:6, padding:"8px 10px", fontSize:12, color:"#1e40af", lineHeight:1.6 }}>
          💡 {hint}
        </div>
      )}
    </div>
  );
}

function Card({ title, accent=BLUE, children }) {
  return (
    <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:10,
      overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.04)", marginBottom:14 }}>
      <div style={{ padding:"9px 16px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9",
        display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:3, height:14, background:accent, borderRadius:2 }} />
        <span style={{ fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:".06em" }}>{title}</span>
      </div>
      <div style={{ padding:"14px 16px" }}>{children}</div>
    </div>
  );
}

function Verdict({ rec, target, price, analysts }) {
  if (!rec) return null;
  const map = {
    "strongbuy":"COMPRA FUERTE","buy":"COMPRA","hold":"MANTENER",
    "sell":"VENTA","strongsell":"VENTA FUERTE","underperform":"INFRAPONDERAR"
  };
  const label    = map[rec.toLowerCase()] || rec.toUpperCase();
  const isPos    = rec.toLowerCase().includes("buy");
  const isNeg    = rec.toLowerCase().includes("sell");
  const color    = isPos ? GREEN : isNeg ? RED : YELLOW;
  const bg       = isPos ? "#dcfce7" : isNeg ? "#fee2e2" : "#fef3c7";
  const upside   = target && price ? ((target - price) / price * 100).toFixed(1) : null;
  const totalAnal = analysts ? analysts.buy + analysts.hold + analysts.sell : null;

  return (
    <div style={{ background:bg, border:`1px solid ${color}30`, borderRadius:10,
      padding:"14px 18px", marginBottom:16, display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
      <div>
        <div style={{ fontSize:11, color:"#64748b", fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>
          Consenso analistas {totalAnal ? `(${totalAnal})` : ""}
        </div>
        <div style={{ fontSize:20, fontWeight:800, color }}>{label}</div>
      </div>
      {target && (
        <div style={{ borderLeft:`1px solid ${color}30`, paddingLeft:16 }}>
          <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>Precio objetivo medio</div>
          <div style={{ ...MONO, fontSize:18, fontWeight:700, color:"#0f172a" }}>{n(target)}</div>
          {upside && (
            <div style={{ fontSize:12, color:Number(upside)>=0?GREEN:RED, fontWeight:600 }}>
              {Number(upside)>=0?"▲":"▼"} {Math.abs(upside)}% vs precio actual
            </div>
          )}
        </div>
      )}
      {analysts && (
        <div style={{ borderLeft:`1px solid ${color}30`, paddingLeft:16 }}>
          <div style={{ fontSize:11, color:"#64748b", marginBottom:6 }}>Distribución</div>
          <div style={{ display:"flex", gap:10 }}>
            {[["Compra", analysts.buy, GREEN],["Neutral", analysts.hold, YELLOW],["Venta", analysts.sell, RED]]
              .map(([l,v,c]) => v > 0 ? (
                <div key={l} style={{ textAlign:"center" }}>
                  <div style={{ ...MONO, fontSize:16, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontSize:10, color:"#64748b" }}>{l}</div>
                </div>
              ) : null)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANÁLISIS PROFESIONAL EXHAUSTIVO ─────────────────────────────────────────
function AnalysisPro({ d }) {
  if (!d) return null;

  const secciones = [];

  // ── 1. VALORACIÓN ─────────────────────────────────────────────────────────
  const fpe = d.forward_pe, tpe = d.trailing_pe, evebitda = d.ev_ebitda, ps = d.ps, pb = d.pb, peg = d.peg_ratio;
  if (fpe || tpe || evebitda) {
    let txt = "";
    if (fpe && tpe) {
      const diff = ((tpe - fpe) / tpe * 100).toFixed(0);
      txt += `El mercado descuenta un Forward P/E de ${n(fpe)}x frente a un Trailing P/E de ${n(tpe)}x, lo que implica que los analistas esperan un crecimiento significativo del beneficio (${diff}% de mejora implícita). `;
      if (fpe < 15) txt += `Un Forward P/E por debajo de 15x es históricamente barato — el mercado no está pagando una prima excesiva por los beneficios futuros. `;
      else if (fpe < 25) txt += `El Forward P/E es moderado y razonable para una empresa de calidad en su sector. `;
      else txt += `El Forward P/E elevado exige una ejecución impecable para justificarse — cualquier decepción en resultados podría penalizar fuertemente el precio. `;
    } else if (fpe) {
      txt += `El Forward P/E de ${n(fpe)}x ${fpe < 15 ? "es atractivo y sugiere que el mercado no descuenta expectativas excesivamente optimistas" : fpe < 25 ? "es razonable para el perfil de la empresa" : "implica expectativas de crecimiento muy exigentes"}. `;
    }
    if (peg) {
      txt += `El ratio PEG de ${n(peg)}x ${peg < 1 ? "por debajo de 1 sugiere que la acción está infravalorada respecto a su tasa de crecimiento esperada — una señal positiva según Peter Lynch" : peg < 2 ? "es razonable — el precio refleja adecuadamente el crecimiento" : "indica que la acción cotiza cara respecto a su crecimiento esperado"}. `;
    }
    if (evebitda) {
      txt += `El EV/EBITDA de ${n(evebitda)}x ${evebitda < 10 ? "es atractivo en términos absolutos e históricos" : evebitda < 18 ? "es razonable para una empresa de calidad" : "implica que el mercado paga una prima importante — solo justificable con márgenes y crecimiento superiores"}. `;
    }
    if (ps) txt += `El Price/Sales de ${n(ps)}x ${ps < 2 ? "es bajo, sugiriendo posible infravaloración o presión en márgenes" : ps < 8 ? "es moderado" : "es elevado — la empresa debe demostrar capacidad de convertir ventas en beneficios"}. `;
    secciones.push({ titulo: "📊 Valoración", texto: txt });
  }

  // ── 2. CALIDAD DEL NEGOCIO Y MÁRGENES ────────────────────────────────────
  const mb = d.margen_bruto, me = d.margen_ebitda, mo = d.margen_op, mn = d.margen_neto;
  const roe = d.roe, roa = d.roa, roic = d.roic;
  if (mb || me || mo || mn || roe) {
    let txt = "";
    if (mb) {
      txt += `El margen bruto del ${n(mb)}% ${mb > 50 ? "es excepcional e indica un negocio con fuerte poder de fijación de precios o ventaja competitiva estructural" : mb > 30 ? "es sólido y refleja un modelo de negocio eficiente" : mb > 15 ? "es moderado — la empresa opera en un entorno competitivo con presión en precios" : "es bajo, característico de sectores con alta intensidad de costes o commoditización"}. `;
    }
    if (me) {
      txt += `El margen EBITDA del ${n(me)}% ${me > 30 ? "denota una ventaja competitiva significativa — la empresa genera caja abundante respecto a sus ventas" : me > 18 ? "es bueno y sostenible" : me > 10 ? "es modesto pero aceptable según el sector" : "es bajo y requiere vigilancia sobre la evolución de costes"}. `;
    }
    if (mn) {
      txt += `El margen neto del ${n(mn)}% refleja la rentabilidad real tras impuestos e intereses. ${mn > 20 ? "Un margen neto superior al 20% es señal de un negocio de altísima calidad — muy pocos sectores logran mantenerlo de forma consistente." : mn > 10 ? "Es un margen neto saludable." : mn > 5 ? "Es modesto." : "Está bajo presión — hay que analizar si es coyuntural o estructural."}`;
    }
    if (roe) {
      txt += ` El ROE del ${n(roe)}% ${roe > 20 ? "es sobresaliente — la empresa genera valor para el accionista de forma muy eficiente sobre el capital invertido. Warren Buffett considera el ROE sostenido por encima del 20% como uno de los indicadores más fiables de ventaja competitiva duradera" : roe > 15 ? "es sólido y por encima de la media del mercado" : roe > 10 ? "es aceptable pero mejorable" : "es bajo — la empresa no está rentabilizando eficientemente el capital de sus accionistas"}. `;
    }
    if (roic) {
      txt += `El ROIC del ${n(roic)}% ${roic > 15 ? "supera ampliamente el coste de capital típico, lo que indica que la empresa crea valor económico real con cada unidad de capital invertida" : roic > 8 ? "es razonable aunque relativamente ajustado al coste de capital" : "está cerca o por debajo del coste de capital — la empresa podría estar destruyendo valor"}. `;
    }
    secciones.push({ titulo: "🏆 Calidad del negocio y márgenes", texto: txt });
  }

  // ── 3. CRECIMIENTO ────────────────────────────────────────────────────────
  const crev = d.revenue_growth, ceps = d.eps_growth;
  if (crev != null || ceps != null) {
    let txt = "";
    if (crev != null) {
      txt += `El crecimiento de ingresos del ${pct(crev)} ${crev > 30 ? "es extraordinario y sitúa a la empresa en la categoría de hipercrecimiento — aunque debe valorarse si es sostenible o puntual" : crev > 15 ? "es muy sólido y por encima de la media del mercado" : crev > 5 ? "es moderado, consistente con una fase de madurez" : crev > 0 ? "es bajo — la empresa está en un entorno de estancamiento de ventas" : "es negativo — hay que analizar si responde a factores puntuales (desinversiones, divisas) o a deterioro estructural del negocio"}. `;
    }
    if (ceps != null) {
      txt += `El crecimiento del BPA del ${pct(ceps)} ${ceps > crev ? "supera al de ventas, lo que indica mejora de márgenes — muy positivo" : ceps < 0 ? "es negativo pese al crecimiento de ventas, señal de presión en costes o dilución" : "es consistente con la evolución de las ventas"}. `;
    }
    txt += `Un inversor a largo plazo debería preguntarse si este crecimiento es orgánico, repetible y rentable, o si depende de adquisiciones, expansión de deuda o factores no recurrentes.`;
    secciones.push({ titulo: "📈 Crecimiento y momentum", texto: txt });
  }

  // ── 4. BALANCE Y SOLIDEZ FINANCIERA ──────────────────────────────────────
  const de = d.debt_ebitda, icov = d.interest_cov, cr = d.current_ratio;
  if (de != null || icov != null || cr != null || d.net_debt != null) {
    let txt = "";
    if (d.net_debt != null) {
      if (d.net_debt < 0) {
        txt += `La empresa tiene **caja neta** (más liquidez que deuda), lo que le da una flexibilidad financiera excepcional para invertir, recomprar acciones o realizar adquisiciones sin presión. `;
      } else {
        txt += `La deuda neta es de ${d.net_debt_fmt || n(d.net_debt)}. `;
      }
    }
    if (de != null) {
      txt += `El ratio Deuda Neta/EBITDA de ${n(de)}x ${de < 0 ? "confirma la posición de caja neta" : de < 2 ? "es conservador y saludable — la empresa puede devolver su deuda en menos de 2 años con el EBITDA generado" : de < 3.5 ? "es manejable aunque requiere vigilancia en entornos de tipos altos" : de < 5 ? "es elevado y puede limitar la flexibilidad financiera — cualquier deterioro del negocio amplificaría el riesgo" : "es muy alto y representa un riesgo significativo, especialmente en un ciclo bajista o de tipos elevados"}. `;
    }
    if (icov != null) {
      txt += `La cobertura de intereses de ${n(icov)}x ${icov > 5 ? "es muy holgada — la empresa genera más que suficiente beneficio operativo para atender sus compromisos financieros" : icov > 3 ? "es adecuada" : icov > 1.5 ? "es ajustada y deja poco margen ante una caída del EBIT" : "es preocupante — la empresa podría tener dificultades para atender sus intereses si el negocio se deteriora"}. `;
    }
    if (cr != null) {
      txt += `El ratio de liquidez corriente de ${n(cr)}x ${cr > 2 ? "indica una posición de liquidez sólida a corto plazo" : cr > 1 ? "es aceptable — la empresa puede cubrir sus pasivos corrientes con el activo corriente" : "es inferior a 1, lo que puede indicar tensiones de liquidez a corto plazo que merecen seguimiento"}. `;
    }
    secciones.push({ titulo: "🏦 Balance y solidez financiera", texto: txt });
  }

  // ── 5. GENERACIÓN DE CAJA ─────────────────────────────────────────────────
  const fcfy = d.fcf_yield;
  if (fcfy != null || d.fcf_fmt) {
    let txt = "";
    if (d.fcf_fmt) txt += `La empresa genera un Free Cash Flow de ${d.fcf_fmt}. `;
    if (fcfy != null) {
      txt += `El FCF Yield del ${n(fcfy)}% ${fcfy > 8 ? "es excelente — por cada euro invertido en la empresa, se generan más de 8 céntimos de caja libre real. Esto puede indicar infravaloración significativa" : fcfy > 5 ? "es atractivo y sugiere que la empresa genera caja de forma abundante relativa a su valoración" : fcfy > 2 ? "es modesto pero positivo" : "es bajo — la empresa genera poca caja libre respecto a su capitalización, lo que puede deberse a inversiones agresivas en crecimiento (no necesariamente malo) o a problemas estructurales"}. `;
    }
    txt += `El FCF es el indicador más honesto de la salud financiera de una empresa, ya que a diferencia del beneficio contable, no puede manipularse fácilmente con criterios contables.`;
    secciones.push({ titulo: "💵 Generación de caja libre (FCF)", texto: txt });
  }

  // ── 6. ANALISTAS Y PRECIO OBJETIVO ───────────────────────────────────────
  if (d.target_price && d.price) {
    const upside = ((d.target_price - d.price) / d.price * 100).toFixed(1);
    const total  = (d.buy_analysts || 0) + (d.hold_analysts || 0) + (d.sell_analysts || 0);
    let txt = "";
    if (total > 0) {
      const pctBuy = ((d.buy_analysts || 0) / total * 100).toFixed(0);
      txt += `El consenso de ${total} analistas que cubren el valor muestra un ${pctBuy}% con recomendación de compra. `;
    }
    txt += `El precio objetivo medio de ${n(d.target_price)} implica un ${Number(upside) >= 0 ? "potencial alcista" : "potencial bajista"} del ${Math.abs(upside)}% respecto al precio actual de ${n(d.price)}. `;
    txt += `${Number(upside) > 20 ? "Un descuento tan significativo respecto al consenso puede indicar una oportunidad, aunque conviene analizar si hay factores de riesgo que el mercado está descontando que los analistas no." : Number(upside) > 5 ? "El mercado cotiza con cierto descuento respecto al consenso." : Number(upside) < -10 ? "La cotización supera al precio objetivo consenso — el mercado está descontando un escenario más optimista que los analistas, lo que añade riesgo a la baja." : "La cotización está en línea con el consenso."} `;
    txt += `Recuerda que los precios objetivo de los analistas son estimaciones con un horizonte típico de 12 meses y tienen un historial de imprecisión significativo — úsalos como referencia, no como verdad absoluta.`;
    secciones.push({ titulo: "🎯 Consenso de analistas y precio objetivo", texto: txt });
  }

  // ── 7. RIESGOS A VIGILAR ──────────────────────────────────────────────────
  const riesgos = [];
  if (d.trailing_pe && d.trailing_pe > 40) riesgos.push(`Valoración exigente (P/E ${n(d.trailing_pe)}x) — cualquier decepción en resultados puede generar caídas abruptas`);
  if (d.debt_ebitda && d.debt_ebitda > 4)  riesgos.push(`Apalancamiento elevado (${n(d.debt_ebitda)}x Deuda/EBITDA) — sensible a subidas de tipos o deterioro del negocio`);
  if (d.interest_cov && d.interest_cov < 3) riesgos.push(`Cobertura de intereses ajustada (${n(d.interest_cov)}x) — poco margen ante una caída del beneficio operativo`);
  if (d.revenue_growth != null && d.revenue_growth < 0) riesgos.push(`Caída de ingresos (${pct(d.revenue_growth)}) — hay que determinar si es puntual o estructural`);
  if (d.margen_neto != null && d.margen_neto < 5) riesgos.push(`Márgenes netos bajos (${n(d.margen_neto)}%) — vulnerable a presiones de costes o de competencia`);
  if (d.current_ratio != null && d.current_ratio < 1) riesgos.push(`Ratio de liquidez por debajo de 1x — posibles tensiones a corto plazo`);
  if (d.ps && d.ps > 10) riesgos.push(`Price/Sales muy elevado (${n(d.ps)}x) — requiere mantener crecimiento alto para justificarse`);
  if (riesgos.length > 0) {
    secciones.push({ titulo: "⚠️ Riesgos clave a vigilar", texto: riesgos.map((r,i) => `${i+1}. ${r}.`).join(" ") });
  }

  // ── 8. VEREDICTO FINAL ────────────────────────────────────────────────────
  let score = 0, total = 0;
  const check = (val, cond) => { if (val != null) { total++; if (cond) score++; } };
  check(d.forward_pe,     d.forward_pe < 20);
  check(d.ev_ebitda,      d.ev_ebitda < 15);
  check(d.fcf_yield,      d.fcf_yield > 4);
  check(d.debt_ebitda,    d.debt_ebitda < 3);
  check(d.margen_ebitda,  d.margen_ebitda > 15);
  check(d.roe,            d.roe > 15);
  check(d.revenue_growth, d.revenue_growth > 5);
  check(d.interest_cov,   d.interest_cov > 3);
  check(d.margen_neto,    d.margen_neto > 10);

  const ratio = total > 0 ? score / total : 0;
  let verdict, vcolor, vbg;
  if (ratio >= 0.65) {
    verdict = `Los fundamentales muestran una imagen sólida en ${score} de ${total} métricas analizadas. La empresa presenta características atractivas para el inversor a largo plazo: ${d.roe > 15 ? "alta rentabilidad sobre capital, " : ""}${d.margen_ebitda > 15 ? "buenos márgenes operativos, " : ""}${d.debt_ebitda < 3 ? "balance saneado" : ""}. Sin embargo, ningún análisis cuantitativo sustituye al estudio detallado del modelo de negocio, la ventaja competitiva y el equipo gestor.`;
    vcolor = GREEN; vbg = "#dcfce7";
  } else if (ratio >= 0.4) {
    verdict = `Los fundamentales presentan una imagen mixta: ${score} de ${total} métricas en zona positiva. La empresa tiene puntos fuertes pero también aspectos que requieren vigilancia antes de invertir. La valoración actual parece razonable aunque no una ganga evidente. Se recomienda profundizar en los factores que están penalizando las métricas más débiles.`;
    vcolor = YELLOW; vbg = "#fef3c7";
  } else if (total > 0) {
    verdict = `Varios indicadores fundamentales (${total - score} de ${total} en zona de alerta) muestran señales que requieren análisis detallado. Esto no significa que sea una mala inversión — muchas grandes empresas han pasado por periodos de debilidad fundamental — pero sí que se necesita una tesis de inversión muy clara y una convicción sólida antes de tomar posición.`;
    vcolor = RED; vbg = "#fee2e2";
  } else {
    verdict = "No hay suficientes datos disponibles para emitir un veredicto fundamentado. Verifica el ticker o consulta los informes oficiales de la empresa.";
    vcolor = "#64748b"; vbg = "#f1f5f9";
  }

  return (
    <div>
      {secciones.map((s, i) => (
        <div key={i} style={{ marginBottom:18 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:6 }}>{s.titulo}</div>
          <p style={{ fontSize:13, color:"#374151", lineHeight:1.8, margin:0 }}>
            {s.texto.split(/\*\*([^*]+)\*\*/).map((part, j) =>
              j % 2 === 1
                ? <strong key={j} style={{ color:"#0f172a" }}>{part}</strong>
                : <span key={j}>{part}</span>
            )}
          </p>
        </div>
      ))}

      <div style={{ marginTop:20, background:vbg, border:`1px solid ${vcolor}30`,
        borderRadius:8, padding:"14px 16px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:vcolor, textTransform:"uppercase",
          letterSpacing:".06em", marginBottom:8 }}>
          Veredicto Fundamental · {score}/{total} métricas positivas
        </div>
        <p style={{ fontSize:13, color:"#374151", lineHeight:1.75, margin:0 }}>{verdict}</p>
      </div>

      <div style={{ marginTop:12, background:"#f8fafc", border:"1px solid #e2e8f0",
        borderRadius:8, padding:"10px 14px", fontSize:12, color:"#64748b", lineHeight:1.6 }}>
        <strong>Metodología:</strong> Análisis basado en datos públicos de Alpha Vantage y Yahoo Finance.
        Los ratios se comparan con umbrales históricos generales — siempre compara con el sector específico.
        No constituye consejo de inversión. Verifica siempre con los informes oficiales (10-K, 20-F).
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Fundamentals({ initialSymbol = "" }) {
  const [query,   setQuery]   = useState(initialSymbol || "");
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState("");

  const analyze = useCallback(async (sym) => {
    const s = (sym || query).trim().toUpperCase();
    if (!s) return;
    setLoading(true); setError(""); setData(null);
    try {
      const r = await fetch(`${API_BASE}/fundamentals/${s}`);
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const d = await r.json();
      if (d.error && !d.name) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(`No se encontraron datos para "${s}". Prueba con el ticker (ej: AAPL, ITX.MC, ASML.AS).`);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    if (initialSymbol) { setQuery(initialSymbol); analyze(initialSymbol); }
  }, [initialSymbol]);

  const d = data;

  return (
    <div style={{ background:"#f8fafc", minHeight:"100vh", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes spin   { to { transform:rotate(360deg) } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fade { animation: fadeIn .35s ease forwards; }
      `}</style>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        <div style={{ marginBottom:24 }}>
          <h1 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:"#0f172a" }}>Análisis Fundamental</h1>
          <div style={{ fontSize:13, color:"#64748b" }}>
            Datos de Alpha Vantage · Ratios, márgenes, balance y análisis profesional
          </div>
        </div>

        <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:12,
          padding:20, marginBottom:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#475569", marginBottom:10 }}>
            Introduce el ticker de la empresa
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>e.key==="Enter" && analyze()}
              placeholder="Ej: AAPL, NVDA, ITX.MC, ASML.AS, SAN.MC..."
              style={{ flex:1, padding:"10px 14px", border:"1px solid #e2e8f0", borderRadius:8,
                fontSize:14, fontFamily:"inherit", outline:"none", color:"#0f172a", background:"#f8fafc" }} />
            <button onClick={()=>analyze()} disabled={loading||!query.trim()} style={{
              padding:"10px 24px", background:loading?"#94a3b8":BLUE, color:"white",
              border:"none", borderRadius:8, fontSize:14, fontWeight:600,
              fontFamily:"inherit", cursor:loading?"not-allowed":"pointer",
              display:"flex", alignItems:"center", gap:8 }}>
              {loading
                ? <><div style={{ width:16, height:16, border:"2px solid white", borderTopColor:"transparent",
                    borderRadius:"50%", animation:"spin 1s linear infinite" }} /> Analizando...</>
                : "🔍 Analizar"}
            </button>
          </div>
          <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"#94a3b8", alignSelf:"center" }}>Rápido:</span>
            {EJEMPLOS.map(e => (
              <button key={e} onClick={()=>{ setQuery(e); analyze(e); }} style={{
                padding:"3px 10px", border:"1px solid #e2e8f0", borderRadius:20,
                background:"white", color:"#475569", fontSize:12, fontFamily:"inherit", cursor:"pointer" }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:8,
            padding:"12px 16px", color:RED, fontSize:13, marginBottom:16 }}>⚠ {error}</div>
        )}

        {loading && (
          <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:10, padding:50, textAlign:"center" }}>
            <div style={{ width:36, height:36, border:"3px solid #e2e8f0", borderTopColor:BLUE,
              borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 16px" }} />
            <div style={{ fontSize:15, fontWeight:600, color:"#0f172a", marginBottom:4 }}>Obteniendo datos de {query}...</div>
            <div style={{ fontSize:13, color:"#64748b" }}>Alpha Vantage · Ratios · Balance · Analistas</div>
          </div>
        )}

        {!loading && d && (
          <div className="fade">

            {/* Cabecera empresa */}
            <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:10,
              padding:"18px 20px", marginBottom:14, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                <div>
                  <h2 style={{ margin:"0 0 6px", fontSize:22, fontWeight:700, color:"#0f172a" }}>{d.name || d.symbol}</h2>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <span style={{ ...MONO, fontSize:12, background:"#eff6ff", color:BLUE,
                      padding:"2px 10px", borderRadius:20, fontWeight:600 }}>{d.symbol}</span>
                    {d.sector   && <span style={{ fontSize:12, background:"#f1f5f9", color:"#475569", padding:"2px 10px", borderRadius:20 }}>{d.sector}</span>}
                    {d.industry && <span style={{ fontSize:12, background:"#f1f5f9", color:"#64748b", padding:"2px 10px", borderRadius:20 }}>{d.industry}</span>}
                    {d.country  && <span style={{ fontSize:12, color:"#94a3b8" }}>{d.country}</span>}
                  </div>
                  {d.description && (
                    <p style={{ margin:"10px 0 0", fontSize:12, color:"#64748b", lineHeight:1.6, maxWidth:650 }}>
                      {d.description}
                    </p>
                  )}
                  {(d.ceo || d.website) && (
                    <div style={{ display:"flex", gap:16, marginTop:8, flexWrap:"wrap" }}>
                      {d.ceo     && <span style={{ fontSize:12, color:"#64748b" }}>👤 CEO: <strong>{d.ceo}</strong></span>}
                      {d.website && <a href={d.website} target="_blank" rel="noreferrer"
                        style={{ fontSize:12, color:BLUE }}>🌐 {d.website.replace("https://","")}</a>}
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right" }}>
                  {d.price && (
                    <div style={{ ...MONO, fontSize:28, fontWeight:700, color:"#0f172a" }}>
                      {n(d.price)} <span style={{ fontSize:13, color:"#64748b" }}>{d.currency}</span>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:16, justifyContent:"flex-end", marginTop:6, flexWrap:"wrap" }}>
                    {d.mktcap_fmt && <div><div style={{ fontSize:10, color:"#94a3b8" }}>Mkt Cap</div><div style={{ ...MONO, fontSize:14, fontWeight:600 }}>{d.mktcap_fmt}</div></div>}
                    {d.ev_fmt     && <div><div style={{ fontSize:10, color:"#94a3b8" }}>EV</div><div style={{ ...MONO, fontSize:14, fontWeight:600 }}>{d.ev_fmt}</div></div>}
                    {d.beta       && <div><div style={{ fontSize:10, color:"#94a3b8" }}>Beta</div><div style={{ ...MONO, fontSize:14, fontWeight:600 }}>{n(d.beta)}</div></div>}
                    {d.employees  && <div><div style={{ fontSize:10, color:"#94a3b8" }}>Empleados</div><div style={{ ...MONO, fontSize:14, fontWeight:600 }}>{Number(d.employees).toLocaleString("es-ES")}</div></div>}
                  </div>
                  {d.high_52w && d.low_52w && (
                    <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>
                      52w: {n(d.low_52w)} — {n(d.high_52w)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Verdict
              rec={d.rec_key} target={d.target_price} price={d.price}
              analysts={d.buy_analysts != null ? { buy: d.buy_analysts, hold: d.hold_analysts, sell: d.sell_analysts } : null}
            />

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:14 }}>

              <Card title="Valoración" accent={BLUE}>
                <MetricRow label="Forward P/E"  value={n(d.forward_pe)}  hint={HINTS.forward_pe}  signal={sig(d.forward_pe,  [15,30])} />
                <MetricRow label="Trailing P/E" value={n(d.trailing_pe)} hint={HINTS.trailing_pe} signal={sig(d.trailing_pe, [18,35])} />
                <MetricRow label="PEG Ratio"    value={n(d.peg_ratio)}   hint={HINTS.peg}         signal={sig(d.peg_ratio,   [1,2])} />
                <MetricRow label="EV/EBITDA"    value={n(d.ev_ebitda)}   hint={HINTS.ev_ebitda}   signal={sig(d.ev_ebitda,   [10,20])} />
                <MetricRow label="EV/Revenue"   value={n(d.ev_revenue)}                           signal={sig(d.ev_revenue,  [3,8])} />
                <MetricRow label="Price/Sales"  value={n(d.ps)}          hint={HINTS.ps}          signal={sig(d.ps,          [2,8])} />
                <MetricRow label="Price/Book"   value={n(d.pb)}          hint={HINTS.pb} />
                <MetricRow label="FCF Yield"    value={n(d.fcf_yield)}   unit="%" hint={HINTS.fcf_yield} signal={sig(d.fcf_yield, [4,2], true)} />
                {d.dividend_yield != null && <MetricRow label="Dividend Yield" value={n(d.dividend_yield)} unit="%" />}
              </Card>

              <Card title="Cuenta de resultados" accent={GREEN}>
                <MetricRow label="Revenue"          value={d.revenue_fmt || "N/D"} big />
                <MetricRow label="Crecimiento YoY"  value={d.revenue_growth != null ? pct(d.revenue_growth) : "N/D"}
                  hint={HINTS.revenue_growth} signal={sig(d.revenue_growth, [8,2], true)} />
                <MetricRow label="EBITDA"           value={d.ebitda_fmt || "N/D"} />
                <MetricRow label="Beneficio Neto"   value={d.net_income_fmt || "N/D"} />
                <MetricRow label="EPS"              value={n(d.eps)} />
                <MetricRow label="Crecimiento EPS"  value={d.eps_growth != null ? pct(d.eps_growth) : "N/D"} signal={sig(d.eps_growth, [8,2], true)} />
                <MetricRow label="Margen Bruto"     value={n(d.margen_bruto)}  unit="%" signal={sig(d.margen_bruto,  [25,15], true)} />
                <MetricRow label="Margen EBITDA"    value={n(d.margen_ebitda)} unit="%" hint={HINTS.margen_ebitda} signal={sig(d.margen_ebitda, [20,10], true)} />
                <MetricRow label="Margen Operativo" value={n(d.margen_op)}     unit="%" signal={sig(d.margen_op,     [15,8],  true)} />
                <MetricRow label="Margen Neto"      value={n(d.margen_neto)}   unit="%" signal={sig(d.margen_neto,   [10,5],  true)} />
                <MetricRow label="FCF"              value={d.fcf_fmt || "N/D"} />
              </Card>

              <Card title="Balance y solidez financiera" accent={YELLOW}>
                <MetricRow label="Caja"              value={d.cash_fmt || "N/D"} />
                <MetricRow label="Deuda Neta"        value={d.net_debt_fmt || "N/D"} />
                <MetricRow label="Deuda Neta/EBITDA" value={n(d.debt_ebitda)} unit="x" hint={HINTS.debt_ebitda} signal={sig(d.debt_ebitda, [2,4])} />
                <MetricRow label="Cobertura Intereses" value={n(d.interest_cov)} unit="x" hint={HINTS.interest_cov} signal={sig(d.interest_cov, [3,1.5], true)} />
                <MetricRow label="Ratio Corriente"  value={n(d.current_ratio)} unit="x" hint={HINTS.current_ratio} signal={sig(d.current_ratio, [1.5,1], true)} />
                <MetricRow label="ROE"              value={n(d.roe)} unit="%" hint={HINTS.roe}  signal={sig(d.roe, [15,10], true)} />
                <MetricRow label="ROA"              value={n(d.roa)} unit="%"                   signal={sig(d.roa, [8,4],   true)} />
                {d.roic != null && <MetricRow label="ROIC" value={n(d.roic)} unit="%" hint={HINTS.roic} signal={sig(d.roic, [15,8], true)} />}
                {d.payout_ratio != null && <MetricRow label="Payout Ratio" value={n(d.payout_ratio)} unit="%" signal={sig(d.payout_ratio, [50,80])} />}
              </Card>

              {(d.target_price || d.fwd_eps) && (
                <Card title="Estimaciones analistas" accent={PURPLE}>
                  {d.fwd_eps     && <MetricRow label="EPS estimado próx. año"     value={n(d.fwd_eps)} />}
                  {d.fwd_revenue && <MetricRow label="Revenue estimado próx. año" value={d.fwd_revenue} />}
                  {d.target_price && <MetricRow label="Precio objetivo consenso"  value={n(d.target_price)} unit={` ${d.currency||""}`} />}
                  {d.num_analysts && <MetricRow label="Nº analistas cubriendo"    value={d.num_analysts} />}
                </Card>
              )}
            </div>

            <Card title="Análisis profesional · Aurum Markets" accent="#6366f1">
              <AnalysisPro d={d} />
            </Card>

          </div>
        )}

        {!loading && !d && !error && (
          <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:10,
            padding:50, textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
            <div style={{ fontSize:16, fontWeight:600, color:"#0f172a", marginBottom:6 }}>
              Análisis fundamental profesional
            </div>
            <div style={{ fontSize:13, color:"#64748b", maxWidth:480, margin:"0 auto", lineHeight:1.7 }}>
              Introduce el ticker de cualquier empresa cotizada en NYSE o NASDAQ.
              El análisis cubre valoración, márgenes, balance, crecimiento, generación de caja y riesgos clave.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:24, flexWrap:"wrap" }}>
              {["Valoración · PEG · EV/EBITDA","Márgenes · ROE · ROIC","Deuda · Cobertura · Liquidez","Analistas · Precio objetivo","Riesgos · Veredicto profesional"].map((t,i) => (
                <div key={i} style={{ fontSize:12, color:BLUE, background:"#eff6ff",
                  padding:"5px 14px", borderRadius:20, fontWeight:500 }}>✓ {t}</div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop:16, fontSize:11, color:"#cbd5e1", textAlign:"center" }}>
          Datos: Alpha Vantage · 25 consultas/día (plan gratuito) · No constituye consejo de inversión
        </div>
      </div>
    </div>
  );
}