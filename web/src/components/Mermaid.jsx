import React, { useEffect, useState, useId } from 'react';
import mermaid from 'mermaid';
import { Loader2, Code2, Eye, Copy, Check } from 'lucide-react';

// Initialize mermaid with a calm light theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  themeVariables: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    primaryColor: '#eff6ff',
    primaryTextColor: '#1e3a8a',
    primaryBorderColor: '#93c5fd',
    lineColor: '#64748b',
    secondaryColor: '#f0fdf4',
    tertiaryColor: '#f8fafc',
    background: '#ffffff',
    mainBkg: '#ffffff',
    nodeBorder: '#cbd5e1',
    clusterBkg: '#f8fafc',
    clusterBorder: '#e2e8f0',
    titleColor: '#0f172a',
    edgeLabelBackground: '#ffffff',
    actorBorder: '#93c5fd',
    actorBkg: '#eff6ff',
    actorTextColor: '#1e3a8a',
    signalColor: '#64748b',
    signalTextColor: '#334155',
    labelBoxBkgColor: '#f8fafc',
    labelBoxBorderColor: '#cbd5e1',
    labelTextColor: '#0f172a'
  }
});

export default function Mermaid({ chart }) {
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `mmd-${rawId}`;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const renderChart = async () => {
      if (!chart || !chart.trim()) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const cleanChart = chart.trim();
        const { svg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setSvgHtml(svg);
          setLoading(false);
        }
      } catch (err) {
        console.error('Mermaid render failure:', err);
        const errorElem = document.getElementById(id) || document.getElementById('d' + id);
        if (errorElem) errorElem.remove();

        if (isMounted) {
          setError(err.message || 'Failed to render Mermaid diagram');
          setLoading(false);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
      const errorElem = document.getElementById(id) || document.getElementById('d' + id);
      if (errorElem) errorElem.remove();
    };
  }, [chart, id]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error || showRaw) {
    return (
      <div style={{
        margin: '1.5rem 0',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          backgroundColor: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.75rem',
          color: '#64748b'
        }}>
          <span>MERMAID SOURCE</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!error && (
              <button
                onClick={() => setShowRaw(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                <Eye size={12} /> View Diagram
              </button>
            )}
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'none',
                border: 'none',
                color: copied ? '#10b981' : '#64748b',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <pre style={{
          margin: 0,
          padding: '1rem',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          color: '#0f172a',
          overflowX: 'auto',
          lineHeight: 1.5
        }}>
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  return (
    <div style={{
      margin: '2rem 0',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.74rem',
        color: '#64748b'
      }}>
        <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Architecture Diagram
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowRaw(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '0.74rem'
            }}
            title="View Mermaid source code"
          >
            <Code2 size={13} /> Source
          </button>
          <button
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'none',
              border: 'none',
              color: copied ? '#10b981' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.74rem'
            }}
            title="Copy diagram code"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      <div style={{
        padding: '1.75rem',
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: loading ? '140px' : 'auto'
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
            <Loader2 className="animate-spin" size={18} color="#10b981" />
            <span>Rendering diagram...</span>
          </div>
        ) : (
          <div 
            dangerouslySetInnerHTML={{ __html: svgHtml }} 
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            className="mermaid-svg-container"
          />
        )}
      </div>
    </div>
  );
}
