import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import {
  Loader2, Code2, Eye, Copy, Check, AlertCircle,
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, X, Download, Move
} from 'lucide-react';

// Pre-sanitizer for Mermaid diagrams to automatically guard against common syntax issues:
// 1. Unquoted parentheses or comparison operators inside edge labels (e.g. |Target Healthy (HTTP 200)| -> |"Target Healthy (HTTP 200)"|)
// 2. Trailing carriage returns
export function sanitizeMermaid(code) {
  if (!code) return '';
  return code
    .replace(/\r\n/g, '\n')
    // Auto-quote edge labels: -->|label| or ---|label|---
    .replace(/\|([^"|\n\r]+)\|/g, (match, label) => {
      const trimmed = label.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return match;
      }
      if (/[()><=;,]/.test(trimmed)) {
        return `|"${trimmed}"|`;
      }
      return match;
    });
}

// Initialize mermaid with quiet error handling and clean light theme
try {
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
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

  if (typeof mermaid.setParseErrorHandler === 'function') {
    mermaid.setParseErrorHandler(() => {});
  }
} catch (e) {
  console.warn('Mermaid initialization warning:', e);
}

export default function Mermaid({ chart }) {
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastRenderIdRef = useRef('');

  // Embedded Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Fullscreen Modal state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsZoom, setFsZoom] = useState(1);
  const [fsPan, setFsPan] = useState({ x: 0, y: 0 });
  const [isFsDragging, setIsFsDragging] = useState(false);
  const [fsDragStart, setFsDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const renderChart = async () => {
      if (!chart || !chart.trim()) {
        if (isMounted) setLoading(false);
        return;
      }

      // Generate a fresh unique ID for this render invocation
      const renderId = `mmd_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      lastRenderIdRef.current = renderId;

      try {
        // Pass 1: Try with auto-sanitized chart
        const sanitized = sanitizeMermaid(chart.trim());
        const { svg } = await mermaid.render(renderId, sanitized);
        if (isMounted) {
          setSvgHtml(svg);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Sanitized Mermaid render failed, trying raw fallback:', err);
        const errElem = document.getElementById(renderId) || document.getElementById('d' + renderId);
        if (errElem) errElem.remove();

        try {
          // Pass 2: Fallback with raw chart
          const fallbackId = `mmd_fb_${Math.random().toString(36).substring(2, 9)}`;
          lastRenderIdRef.current = fallbackId;
          const { svg } = await mermaid.render(fallbackId, chart.trim());
          if (isMounted) {
            setSvgHtml(svg);
            setError(null);
            setLoading(false);
          }
        } catch (fallbackErr) {
          console.error('Mermaid render final failure:', fallbackErr);
          const fbElem = document.getElementById(renderId) || document.getElementById('d' + renderId);
          if (fbElem) fbElem.remove();

          if (isMounted) {
            setError(fallbackErr.message || err.message || 'Failed to render Mermaid diagram');
            setLoading(false);
          }
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
      const currId = lastRenderIdRef.current;
      if (currId) {
        const elem = document.getElementById(currId) || document.getElementById('d' + currId);
        if (elem) elem.remove();
      }
    };
  }, [chart]);

  // Lock body scroll and handle Escape key when in fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      } else if (e.key === '+' || e.key === '=') {
        setFsZoom(prev => Math.min(prev + 0.2, 4.0));
      } else if (e.key === '-') {
        setFsZoom(prev => Math.max(prev - 0.2, 0.3));
      } else if (e.key === '0') {
        setFsZoom(1);
        setFsPan({ x: 0, y: 0 });
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-diagram-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Embedded Mouse Drag
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Fullscreen Mouse Drag
  const handleFsMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsFsDragging(true);
    setFsDragStart({ x: e.clientX - fsPan.x, y: e.clientY - fsPan.y });
  };

  const handleFsMouseMove = (e) => {
    if (!isFsDragging) return;
    setFsPan({ x: e.clientX - fsDragStart.x, y: e.clientY - fsDragStart.y });
  };

  const handleFsMouseUp = () => {
    setIsFsDragging(false);
  };

  const handleFsWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setFsZoom(prev => Math.min(Math.max(0.3, prev + delta), 4.0));
  };

  // If there's an error or user toggled raw code view
  if (error || showRaw) {
    return (
      <div style={{
        margin: '1.5rem 0',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        overflow: 'hidden'
      }}>
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.78rem'
          }}>
            <AlertCircle size={14} />
            <span>Diagram syntax error: {error}</span>
          </div>
        )}
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

  const isEmbeddedTransformed = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

  return (
    <>
      {/* Embedded Diagram Card */}
      <div style={{
        margin: '2rem 0',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        {/* Card Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Architecture Diagram
            </span>
            {isEmbeddedTransformed && (
              <span style={{
                fontSize: '0.68rem',
                color: '#3b82f6',
                backgroundColor: '#eff6ff',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                border: '1px solid #bfdbfe'
              }}>
                {Math.round(zoom * 100)}% (drag to pan)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Zoom Controls */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
                style={{
                  padding: '3px 6px',
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                style={{
                  padding: '2px 5px',
                  background: 'none',
                  border: 'none',
                  color: '#334155',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }}
                title="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom(prev => Math.min(2.5, prev + 0.2))}
                style={{
                  padding: '3px 6px',
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              {isEmbeddedTransformed && (
                <button
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                  style={{
                    padding: '3px 6px',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    borderLeft: '1px solid #e2e8f0'
                  }}
                  title="Reset position and zoom"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>

            {/* Fullscreen Expand Button */}
            <button
              onClick={() => {
                setFsZoom(1);
                setFsPan({ x: 0, y: 0 });
                setIsFullscreen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                color: '#1e293b',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600
              }}
              title="Open full screen lightbox (pan & zoom)"
            >
              <Maximize2 size={12} color="#2563eb" />
              <span>Full Screen</span>
            </button>

            {/* Source Button */}
            <button
              onClick={() => setShowRaw(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.72rem',
                padding: '0.25rem'
              }}
              title="View Mermaid source code"
            >
              <Code2 size={13} />
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'none',
                border: 'none',
                color: copied ? '#10b981' : '#64748b',
                cursor: 'pointer',
                fontSize: '0.72rem',
                padding: '0.25rem'
              }}
              title="Copy diagram code"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Embedded Diagram Canvas */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            padding: '1.75rem',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: loading ? '140px' : 'auto',
            cursor: isDragging ? 'grabbing' : isEmbeddedTransformed ? 'grab' : 'default',
            position: 'relative'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
              <Loader2 className="animate-spin" size={18} color="#10b981" />
              <span>Rendering diagram...</span>
            </div>
          ) : (
            <div
              dangerouslySetInnerHTML={{ __html: svgHtml }}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                userSelect: 'none'
              }}
              className="mermaid-svg-container"
            />
          )}
        </div>
      </div>

      {/* Fullscreen Interactive Lightbox Modal */}
      {isFullscreen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Fullscreen Top Header Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgba(30, 41, 59, 0.85)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                color: '#60a5fa',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                <Move size={12} />
                <span>Interactive Lightbox</span>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Click and drag to pan • Scroll to zoom
              </span>
            </div>

            {/* Right Action Dock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Fullscreen Zoom Pill */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '8px',
                padding: '3px',
                border: '1px solid rgba(255, 255, 255, 0.12)'
              }}>
                <button
                  onClick={() => setFsZoom(prev => Math.max(0.3, prev - 0.2))}
                  style={{
                    padding: '4px 8px',
                    background: 'none',
                    border: 'none',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={() => { setFsZoom(1); setFsPan({ x: 0, y: 0 }); }}
                  style={{
                    padding: '2px 8px',
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    minWidth: '45px'
                  }}
                  title="Reset to 100% (0)"
                >
                  {Math.round(fsZoom * 100)}%
                </button>
                <button
                  onClick={() => setFsZoom(prev => Math.min(4.0, prev + 0.2))}
                  style={{
                    padding: '4px 8px',
                    background: 'none',
                    border: 'none',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Zoom In (+)"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => { setFsZoom(1); setFsPan({ x: 0, y: 0 }); }}
                  style={{
                    padding: '4px 8px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  title="Reset position and zoom"
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              {/* Download SVG */}
              <button
                onClick={handleDownloadSvg}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500
                }}
                title="Download SVG file"
              >
                <Download size={13} />
                <span>Download SVG</span>
              </button>

              {/* Copy Source */}
              <button
                onClick={handleCopy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  color: copied ? '#34d399' : '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500
                }}
                title="Copy Mermaid source code"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsFullscreen(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
                title="Close lightbox (Esc)"
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Interactive Canvas */}
          <div
            onMouseDown={handleFsMouseDown}
            onMouseMove={handleFsMouseMove}
            onMouseUp={handleFsMouseUp}
            onWheel={handleFsWheel}
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              cursor: isFsDragging ? 'grabbing' : 'grab',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              userSelect: 'none'
            }}
          >
            {/* SVG Content on White Card Plate for Optimal Contrast */}
            <div
              style={{
                transform: `translate(${fsPan.x}px, ${fsPan.y}px) scale(${fsZoom})`,
                transformOrigin: 'center center',
                transition: isFsDragging ? 'none' : 'transform 0.12s ease-out',
                backgroundColor: '#ffffff',
                padding: '2.5rem',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                maxWidth: '92vw',
                maxHeight: '85vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'visible'
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: svgHtml }}
                style={{ display: 'flex', justifyContent: 'center' }}
                className="mermaid-svg-container"
              />
            </div>

            {/* Bottom Keyboard Hint */}
            <div style={{
              position: 'absolute',
              bottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              color: '#94a3b8',
              fontSize: '0.72rem',
              pointerEvents: 'none'
            }}>
              <span>Drag to Pan</span>
              <span>•</span>
              <span>Scroll to Zoom</span>
              <span>•</span>
              <span>Press <kbd style={{ padding: '0.1rem 0.3rem', backgroundColor: '#334155', borderRadius: '3px', color: '#f8fafc' }}>Esc</kbd> to exit</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
