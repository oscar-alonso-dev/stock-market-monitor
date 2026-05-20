import { useState } from 'react';
import StockDashboard from './StockDashboard';
import Portfolio from './Portfolio';
import Home from './Home';
import Funds from './Funds';
import Market from './Market';
import Currency from './Currency';
import Fundamentals from './Fundamentals';
import IA from './IA';

function App() {
  const [view, setView] = useState<'home' | 'dashboard' | 'market' | 'portfolio' | 'funds' | 'currency' | 'fundamentals' | 'ia'>('home');
  const [analyzeSymbol,      setAnalyzeSymbol]      = useState<string | null>(null);
  const [fundamentalsSymbol, setFundamentalsSymbol] = useState<string>("");

  const handleAnalyze = (symbol: string) => {
    setAnalyzeSymbol(symbol);
    setView('dashboard');
  };

  const handleFundamentals = (symbol: string) => {
    setFundamentalsSymbol(symbol);
    setView('fundamentals');
  };

  const handleNavigate = (v: string) => setView(v as any);

  const NAV = [
    { key: 'home',         label: 'Inicio'        },
    { key: 'market',       label: 'Mercado'       },
    { key: 'dashboard',    label: 'Análisis'      },
    { key: 'funds',        label: 'Fondos'        },
    { key: 'fundamentals', label: 'Fundamentales' },
    { key: 'portfolio',    label: 'Portfolio'     },
    { key: 'currency',     label: 'Divisas'       },
    { key: 'ia',           label: 'IA'            },
  ];

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:.9} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        body { background: #f8fafc; font-family: 'Inter', sans-serif; color: #0f172a; }
        input::placeholder { color: #94a3b8; }
        input:focus { outline: none; }
        select { appearance: none; }
        a { text-decoration: none; }
        button { cursor: pointer; }
        option { background: white; color: #0f172a; }
      `}</style>

      <nav style={{
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        height: "54px",
        position: "sticky",
        top: 0,
        zIndex: 300,
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
      }}>
        <div onClick={() => setView('home')} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", marginRight: "32px" }}>
          <div style={{
            width: "32px", height: "32px",
            background: "linear-gradient(135deg, #f59e0b, #b45309)",
            borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(245,158,11,.3)",
          }}>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "11px", fontWeight: 600, color: "#fff" }}>AU</span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "15px", fontWeight: 600, color: "#0f172a", letterSpacing: "0.06em" }}>AURUM</span>
        </div>

        <div style={{ display: "flex", height: "100%", gap: "2px" }}>
          {NAV.map(v => (
            <button key={v.key} onClick={() => setView(v.key as any)} style={{
              background: "transparent",
              border: "none",
              borderBottom: view === v.key ? "2px solid #3b82f6" : "2px solid transparent",
              padding: "0 14px",
              color: view === v.key ? "#3b82f6" : "#64748b",
              fontSize: "13px",
              fontFamily: "'Inter', sans-serif",
              fontWeight: view === v.key ? 600 : 400,
              transition: "all .15s",
              height: "100%",
            }}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#16a34a", animation: "blink 2s infinite" }} />
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "10px", color: "#94a3b8", letterSpacing: "0.08em" }}>LIVE · 30s</span>
        </div>
      </nav>

      <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 54px)" }}>
        {view === 'home'         && <Home onNavigate={handleNavigate} />}
        {view === 'market'       && <Market onAnalyze={handleAnalyze} />}
        {view === 'dashboard'    && <StockDashboard initialSymbol={analyzeSymbol} />}
        {view === 'funds'        && <Funds />}
        {view === 'fundamentals' && <Fundamentals initialSymbol={fundamentalsSymbol} />}
        {view === 'portfolio'    && <Portfolio />}
        {view === 'currency'     && <Currency />}
        {view === 'ia'           && <IA />}
      </div>
    </div>
  );
}

export default App;
