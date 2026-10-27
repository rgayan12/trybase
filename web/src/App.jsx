import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Auth from './views/Auth';
import Dashboard from './views/Dashboard';
import Docs from './views/Docs';
import { Loader2 } from 'lucide-react';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Realtime auth listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
        color: '#10b981'
      }}>
        <Loader2 className="animate-spin" size={36} />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Core Auth & Dashboard Flow */}
        <Route path="/" element={session ? <Dashboard /> : <Auth />} />
        <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/" replace />} />

        {/* Embedded Laravel-Style Documentation (Markdown Loaded Live from /docs) */}
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/*" element={<Docs />} />

        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
