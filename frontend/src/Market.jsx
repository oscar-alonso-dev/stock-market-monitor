import { useState } from "react";
import { API_BASE } from "./config.js";

export default function Market() {
  const [search, setSearch] = useState("");
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);

  const buscarAccion = () => {
    if (!search.trim()) return;
    
    setLoading(true);
    fetch(`${API_BASE}/stocks/${search.toUpperCase()}/quote`)
      .then(r => r.json())
      .then(data => {
        setStockData(data);
        setLoading(false);
      })
      .catch(() => {
        setStockData(null);
        setLoading(false);
      });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') buscarAccion();
  };

  return (
    <div style={{ background: "#fff", minHeight: "calc(100vh - 54px)", padding: "40px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a", marginBottom: "32px" }}>
          Buscar Acción
        </h1>

        {/* BUSCADOR */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "40px" }}>
          <input
            type="text"
            placeholder="Escribe el ticker: AAPL, MSFT, GOOGL, SAN.MC, TEF.MC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{
              flex: 1,
              padding: "16px 20px",
              fontSize: "16px",
              border: "2px solid #e2e8f0",
              borderRadius: "12px",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
          <button
            onClick={buscarAccion}
            disabled={loading}
            style={{
              padding: "16px 32px",
              fontSize: "16px",
              fontWeight: 600,
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {/* RESULTADOS */}
        {stockData && (
          <div style={{ 
            background: "#f8fafc", 
            border: "1px solid #e2e8f0", 
            borderRadius: "16px", 
            padding: "32px" 
          }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", marginBottom: "24px" }}>
              {stockData.symbol}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
                  Precio Actual
                </div>
                <div style={{ fontSize: "36px", fontWeight: 700, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${stockData.current_price?.toFixed(2) || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
                  Cambio
                </div>
                <div style={{ 
                  fontSize: "28px", 
                  fontWeight: 700, 
                  color: (stockData.change || 0) >= 0 ? "#16a34a" : "#dc2626",
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  {(stockData.change || 0) >= 0 ? "+" : ""}{stockData.change?.toFixed(2) || "—"}
                  {" "}
                  ({(stockData.change_percent || 0) >= 0 ? "+" : ""}{stockData.change_percent?.toFixed(2) || "—"}%)
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
                  Máximo Hoy
                </div>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${stockData.high?.toFixed(2) || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
                  Mínimo Hoy
                </div>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${stockData.low?.toFixed(2) || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
                  Apertura
                </div>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${stockData.open?.toFixed(2) || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
                  Cierre Anterior
                </div>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${stockData.previous_close?.toFixed(2) || "—"}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* INSTRUCCIONES */}
        {!stockData && !loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
            <div style={{ fontSize: "16px", marginBottom: "8px" }}>
              Busca cualquier acción del mundo
            </div>
            <div style={{ fontSize: "14px" }}>
              Ejemplos: AAPL, MSFT, GOOGL, TSLA, SAN.MC, BBVA.MC
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
