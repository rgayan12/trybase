import React, { useState } from 'react';
import { Loader2, ArrowRight, BookOpen, Info, ExternalLink, Sparkles } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode');
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigate = useNavigate();

  const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    !import.meta.env.VITE_SUPABASE_URL.includes('your-project')
  );

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isLogin) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
        navigate('/');
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
            }
          },
        });
        if (signUpError) throw signUpError;

        // If email confirmation is required by Supabase project settings
        if (data?.user && !data.session) {
          setSuccessMessage('Account created! Please check your email to confirm your account, then sign in.');
          setIsLogin(true);
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '5rem 1rem 2rem 1rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>

      {/* Top Navigation Bar */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img
            src="https://trybase.io/logo.png"
            alt="TryBase Logo"
            style={{ height: '28px', width: 'auto' }}
          />
          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
            TryBase
          </span>
          <span style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', color: '#475569', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
            v1.0.0
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <Link
            to="/docs/getting-started"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#0f172a',
              textDecoration: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              transition: 'all 0.15s ease'
            }}
          >
            <BookOpen size={15} color="#2563eb" />
            <span>Documentation</span>
          </Link>

          <a
            href="https://github.com/rgayan12/trybase"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#475569',
              textDecoration: 'none',
              padding: '0.45rem 0.65rem'
            }}
          >
            <span>GitHub</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </header>

      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <img
          src="https://trybase.io/logo.png"
          alt="TryBase Logo"
          style={{ height: '44px', width: 'auto', marginBottom: '1rem' }}
        />
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          margin: '0 0 0.35rem 0'
        }}>
          TryBase Console
        </h1>
        <p style={{
          fontSize: '0.92rem',
          color: '#64748b',
          margin: 0
        }}>
          {isLogin
            ? 'Sign in to manage your autonomous AI agent fleet'
            : 'Create an administrator account for your private cluster'}
        </p>
      </div>

      {/* Auth Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        padding: '2rem'
      }}>

        {/* First-Time Setup Callout when Supabase is not yet configured */}
        {!hasSupabaseConfig && (
          <div style={{
            padding: '1rem 1.1rem',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e40af' }}>
              <Info size={16} />
              <span>First-time setup detected</span>
            </div>
            <p style={{ margin: '0 0 0.85rem 0', color: '#1e3a8a', lineHeight: 1.45, fontSize: '0.82rem' }}>
              You don't need Supabase keys to read the docs! The entire documentation suite is available offline locally.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link
                to="/docs/getting-started"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textDecoration: 'none'
                }}
              >
                <BookOpen size={14} /> Open Getting Started Guide →
              </Link>
              <Link
                to="/docs"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  backgroundColor: '#ffffff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textDecoration: 'none'
                }}
              >
                All Docs
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '1.5rem',
            fontSize: '0.88rem'
          }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #dcfce7',
            borderRadius: '8px',
            color: '#15803d',
            marginBottom: '1.5rem',
            fontSize: '0.88rem'
          }}>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!isLogin && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.4rem'
              }}>
                Full Name
              </label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.92rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.4rem'
            }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="admin@yourdomain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.92rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155'
              }}>
                Password
              </label>
            </div>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.92rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
              transition: 'background-color 0.15s ease'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#059669')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#10b981')}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: '0.88rem',
          color: '#64748b'
        }}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccessMessage(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0
            }}
          >
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </div>

      </div>

      {/* Footer Navigation */}
      <div style={{
        marginTop: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        fontSize: '0.85rem',
        color: '#64748b'
      }}>
        <Link
          to="/docs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#64748b',
            textDecoration: 'none'
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#0f172a')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
        >
          <BookOpen size={15} /> Documentation
        </Link>
        <span>•</span>
        <span>Apache 2.0 Open Source</span>
      </div>

    </div>
  );
};

export default Auth;
