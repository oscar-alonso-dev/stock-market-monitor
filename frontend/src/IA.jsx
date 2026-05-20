export default function IA() {
  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <iframe 
        src="/generador-prompt.html"
        style={{
          width: '100%',
          height: 'calc(100vh - 120px)',
          border: 'none',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
        title="Generador de Prompt - Equity Research"
      />
    </div>
  );
}
