import React, { useState } from 'react';
import { Loader2, ArrowRight, BookOpen } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
      padding: '2rem 1rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img 
          src="/logo.png" 
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
        maxWidth: '420px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        padding: '2rem'
      }}>
        
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
        <a 
          href="https://github.com/rgayan12/trybase/tree/main/docs" 
          target="_blank" 
          rel="noreferrer"
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
          <BookOpen size={15} /> Documentation on GitHub
        </a>
        <span>•</span>
        <span>Apache 2.0 Open Source</span>
      </div>

    </div>
  );
};

export default Auth;
