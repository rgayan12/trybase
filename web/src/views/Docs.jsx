import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, BookOpen, Star, ChevronRight, ChevronLeft, ExternalLink,
  Copy, Check, Menu, X, ArrowUpRight, Info, AlertTriangle,
  Sparkles, AlertCircle, ArrowLeft, Terminal
} from 'lucide-react';

const GithubIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DOCS_NAV, ALL_DOC_ITEMS, getAdjacentDocs } from '../lib/docsNavigation';
import { getDocContent } from '../lib/docsLoader';
import Mermaid from '../components/Mermaid';

// Custom Markdown Code Block with Copy Button
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  if (language === 'mermaid') {
    return <Mermaid chart={codeText} />;
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isInline = inline || (!match && !codeText.includes('\n'));

  if (isInline) {
    return (
      <code style={{
        backgroundColor: '#f1f5f9',
        color: '#0f172a',
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        fontSize: '0.85em',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        border: '1px solid #e2e8f0'
      }} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div style={{
      position: 'relative',
      margin: '1.5rem 0',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #1e293b',
      backgroundColor: '#0f172a'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        fontSize: '0.75rem',
        color: '#94a3b8',
        fontFamily: 'monospace'
      }}>
        <span>{language ? language.toUpperCase() : 'CODE'}</span>
        <button
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            background: 'none',
            border: 'none',
            color: copied ? '#34d399' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.75rem'
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '1.25rem',
        overflowX: 'auto',
        color: '#f8fafc',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.86rem',
        lineHeight: 1.6
      }}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
};

// Custom Blockquote / GitHub Callout Component
const Blockquote = ({ children }) => {
  // Extract text content to detect GitHub Alert syntax: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT]
  const childrenArray = React.Children.toArray(children);
  const pElement = childrenArray.find(c => c && typeof c === 'object' && c.props && c.props.children);

  let alertType = null;
  let cleanChildren = children;

  if (pElement) {
    const rawText = Array.isArray(pElement.props.children)
      ? pElement.props.children.map(x => typeof x === 'string' ? x : '').join('')
      : String(pElement.props.children || '');

    if (rawText.includes('[!NOTE]')) alertType = 'note';
    else if (rawText.includes('[!TIP]')) alertType = 'tip';
    else if (rawText.includes('[!WARNING]')) alertType = 'warning';
    else if (rawText.includes('[!IMPORTANT]')) alertType = 'important';
    else if (rawText.includes('[!CAUTION]')) alertType = 'caution';

    if (alertType) {
      cleanChildren = childrenArray.map(c => {
        if (c === pElement) {
          const newChildren = React.Children.map(pElement.props.children, child => {
            if (typeof child === 'string') {
              return child.replace(/\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/i, '');
            }
            return child;
          });
          return React.cloneElement(pElement, { key: pElement.key }, newChildren);
        }
        return c;
      });
    }
  }

  if (alertType) {
    const styles = {
      note: { border: '#3b82f6', bg: '#eff6ff', text: '#1e40af', icon: <Info size={17} color="#2563eb" />, label: 'NOTE' },
      tip: { border: '#10b981', bg: '#f0fdf4', text: '#15803d', icon: <Sparkles size={17} color="#059669" />, label: 'TIP' },
      warning: { border: '#f59e0b', bg: '#fffbeb', text: '#b45309', icon: <AlertTriangle size={17} color="#d97706" />, label: 'WARNING' },
      important: { border: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', icon: <AlertCircle size={17} color="#7c3aed" />, label: 'IMPORTANT' },
      caution: { border: '#ef4444', bg: '#fef2f2', text: '#b91c1c', icon: <AlertTriangle size={17} color="#dc2626" />, label: 'CAUTION' }
    }[alertType];

    return (
      <div style={{
        margin: '1.5rem 0',
        padding: '1rem 1.25rem',
        backgroundColor: styles.bg,
        borderLeft: `4px solid ${styles.border}`,
        borderRadius: '0 8px 8px 0',
        fontSize: '0.92rem',
        color: '#334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: styles.text, fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.4rem' }}>
          {styles.icon}
          <span>{styles.label}</span>
        </div>
        <div style={{ margin: 0, lineHeight: 1.6 }}>
          {cleanChildren}
        </div>
      </div>
    );
  }

  return (
    <blockquote style={{
      margin: '1.5rem 0',
      padding: '0.75rem 1.25rem',
      backgroundColor: '#f8fafc',
      borderLeft: '4px solid #cbd5e1',
      color: '#475569',
      fontStyle: 'italic'
    }}>
      {children}
    </blockquote>
  );
};

export default function Docs() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active doc item from path
  const currentPathId = useMemo(() => {
    const raw = location.pathname.replace(/^\/docs\/?/, '');
    if (!raw || raw === '') return 'prologue/manifesto';
    return raw.replace(/\.md$/, '');
  }, [location.pathname]);

  const activeDocItem = useMemo(() => {
    return ALL_DOC_ITEMS.find(item => item.id === currentPathId) || ALL_DOC_ITEMS[0];
  }, [currentPathId]);

  // Load raw markdown directly from file
  const markdownContent = useMemo(() => {
    return getDocContent(activeDocItem.path) || '# Document not found\n\nThis article is being updated.';
  }, [activeDocItem]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Extract headings for "On This Page" right sidebar
  const headings = useMemo(() => {
    if (!markdownContent) return [];
    const lines = markdownContent.split('\n');
    const matched = [];
    lines.forEach(line => {
      const h2Match = /^##\s+(.+)$/.exec(line);
      const h3Match = /^###\s+(.+)$/.exec(line);
      if (h2Match) {
        matched.push({ level: 2, text: h2Match[1].replace(/[*_`]/g, ''), id: h2Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-') });
      } else if (h3Match) {
        matched.push({ level: 3, text: h3Match[1].replace(/[*_`]/g, ''), id: h3Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-') });
      }
    });
    return matched;
  }, [markdownContent]);

  const { prev, next } = useMemo(() => getAdjacentDocs(activeDocItem.id), [activeDocItem]);

  const filteredNavigation = useMemo(() => {
    if (!searchQuery.trim()) return DOCS_NAV;
    const q = searchQuery.toLowerCase();
    return DOCS_NAV.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.title.toLowerCase().includes(q) || group.group.toLowerCase().includes(q)
      )
    })).filter(group => group.items.length > 0);
  }, [searchQuery]);

  // Scroll to top on document change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  }, [activeDocItem]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* Top Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 1.5rem',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#334155'
            }}
            className="mobile-docs-burger"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src="https://trybase.io/logo.png" alt="TryBase Logo" style={{ height: '28px', width: 'auto' }} />
            <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: '#0f172a' }}>
              TryBase
            </span>
            <span style={{
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              border: '1px solid #dbeafe',
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              DOCS
            </span>
          </Link>
        </div>

        {/* Global Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          padding: '0.45rem 0.85rem',
          border: '1px solid #cbd5e1',
          width: '320px',
          maxWidth: '40vw'
        }}>
          <Search size={15} color="#64748b" style={{ marginRight: '0.5rem' }} />
          <input
            type="text"
            placeholder="Search documentation... (/ to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.85rem',
              color: '#0f172a',
              width: '100%'
            }}
          />
        </div>

        {/* Right Header Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <a
            href="https://github.com/rgayan12/trybase"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <GithubIcon size={15} /> GitHub
          </a>

          <Link
            to="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.95rem',
              backgroundColor: '#10b981',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background-color 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
          >
            Console <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main 3-Column Documentation Grid */}
      <div style={{
        display: 'flex',
        flex: 1,
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%'
      }}>

        {/* Left Sidebar Navigation (Laravel Style) */}
        <aside style={{
          width: '280px',
          borderRight: '1px solid #e2e8f0',
          padding: '2rem 1.25rem',
          backgroundColor: '#fafafa',
          overflowY: 'auto',
          height: 'calc(100vh - 64px)',
          position: 'sticky',
          top: '64px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem'
        }}>
          {filteredNavigation.map((group, gIdx) => (
            <div key={gIdx}>
              <h4 style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#64748b',
                marginBottom: '0.55rem',
                paddingLeft: '0.5rem'
              }}>
                {group.group}
              </h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeDocItem.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(`/docs/${item.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: isActive ? '#ecfdf5' : 'transparent',
                        color: isActive ? '#059669' : '#475569',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => !isActive && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                      onMouseOut={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Icon size={15} color={isActive ? '#10b981' : '#94a3b8'} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}

          <div style={{ marginTop: 'auto', padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.2rem' }}>
              Apache 2.0 Open Source
            </span>
            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
              100% data sovereignty on your private AWS fleet.
            </p>
          </div>
        </aside>

        {/* Center Main Prose Reader */}
        <main style={{
          flex: 1,
          padding: '2.5rem 3.5rem',
          maxWidth: '880px',
          overflowY: 'auto',
          lineHeight: 1.7
        }}>

          {/* Breadcrumbs & GitHub Link */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: '#64748b',
            marginBottom: '1.75rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Docs</span>
              <ChevronRight size={13} />
              <span>{activeDocItem.group}</span>
              <ChevronRight size={13} />
              <span style={{ color: '#0f172a', fontWeight: 600 }}>{activeDocItem.title}</span>
            </div>

            <a
              href={`https://github.com/rgayan12/trybase/blob/main/docs/${activeDocItem.path}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: '#64748b',
                textDecoration: 'none',
                fontSize: '0.8rem'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#0f172a')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
            >
              <GithubIcon size={13} /> Edit on GitHub
            </a>
          </div>

          {/* Render Markdown Content Directly from File */}
          <article className="prose" style={{ color: '#334155', fontSize: '0.98rem' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
                blockquote: Blockquote,
                h1: ({ children }) => (
                  <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: '1.25rem', lineHeight: 1.2 }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => {
                  const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  return (
                    <h2 id={id} style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', marginTop: '2.5rem', marginBottom: '0.85rem', scrollMarginTop: '80px' }}>
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  return (
                    <h3 id={id} style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '2rem', marginBottom: '0.65rem', scrollMarginTop: '80px' }}>
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p style={{ marginBottom: '1.25rem', lineHeight: 1.7, color: '#334155' }}>
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul style={{ paddingLeft: '1.4rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ paddingLeft: '1.4rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {children}
                  </ol>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', margin: '1.75rem 0', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#0f172a', fontWeight: 700 }}>
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => (
                  <tbody style={{ color: '#334155' }}>
                    {children}
                  </tbody>
                ),
                tr: ({ children }) => (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {children}
                  </tr>
                ),
                th: ({ children }) => (
                  <th style={{ padding: '0.75rem 1rem' }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{ padding: '0.75rem 1rem' }}>{children}</td>
                ),
                img: ({ src, alt }) => {
                  // Resolve relative asset paths from docs/
                  let resolvedSrc = src;
                  if (src && (src.includes('banner.png') || src.includes('trybase-banner'))) {
                    resolvedSrc = '/logo.png'; // or banner
                  } else if (src && src.includes('logo.png')) {
                    resolvedSrc = '/logo.png';
                  }
                  return (
                    <img
                      src={resolvedSrc}
                      alt={alt || 'Documentation graphic'}
                      style={{ maxWidth: '100%', borderRadius: '8px', margin: '1.5rem 0' }}
                    />
                  );
                },
                a: ({ href, children }) => {
                  // Check if it's an internal doc link like ./anti-leak-standard.md or ../security/keyless-sts.md
                  const isInternal = href && (href.startsWith('./') || href.startsWith('../') || href.endsWith('.md'));
                  if (isInternal) {
                    const cleanHref = href.replace(/\.md$/, '').replace(/^\.\.\//, '').replace(/^\.\//, '');
                    return (
                      <Link to={`/docs/${cleanHref}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                        {children}
                      </Link>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                      {children}
                    </a>
                  );
                }
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          </article>

          {/* Previous / Next Article Navigation (Laravel Style) */}
          <div style={{
            marginTop: '3.5rem',
            paddingTop: '2rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {prev ? (
              <button
                onClick={() => navigate(`/docs/${prev.id}`)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ChevronLeft size={13} /> Previous
                </span>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                  {prev.title}
                </span>
              </button>
            ) : <div />}

            {next && (
              <button
                onClick={() => navigate(`/docs/${next.id}`)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'right',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  marginLeft: 'auto'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.backgroundColor = '#f0fdf4';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                <span style={{ fontSize: '0.72rem', color: '#10b981', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Next <ChevronRight size={13} />
                </span>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                  {next.title}
                </span>
              </button>
            )}
          </div>

        </main>

        {/* Right Sidebar: "On This Page" Table of Contents */}
        <aside style={{
          width: '240px',
          padding: '2.5rem 1.25rem',
          position: 'sticky',
          top: '64px',
          height: 'calc(100vh - 64px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {headings.length > 0 && (
            <div>
              <h5 style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#64748b',
                marginBottom: '0.75rem'
              }}>
                On this page
              </h5>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                {headings.map((h, i) => (
                  <a
                    key={i}
                    href={`#${h.id}`}
                    style={{
                      color: '#64748b',
                      textDecoration: 'none',
                      paddingLeft: h.level === 3 ? '0.75rem' : '0',
                      lineHeight: 1.4,
                      transition: 'color 0.15s ease'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = '#0f172a')}
                    onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
            <a
              href="https://github.com/rgayan12/trybase"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                color: '#64748b',
                textDecoration: 'none'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#0f172a')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
            >
              <Star size={13} fill="#eab308" color="#eab308" /> Star on GitHub
            </a>
          </div>
        </aside>

      </div>
    </div>
  );
}
