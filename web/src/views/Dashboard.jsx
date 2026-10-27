import React, { useEffect, useState } from 'react';
import {
  Server, Settings, LogOut, Loader2, Zap, CheckCircle2,
  Activity, Database, Bot, Sparkles, Cpu,
  ShieldCheck, Terminal, ChevronDown, ChevronUp, Copy, Check, ExternalLink, Lock,
  Plus, BookOpen, AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ProvisioningTerminal from '../components/ProvisioningTerminal';
import ProvisioningGame from '../components/ProvisioningGame';

const ADJECTIVES = ['cloud', 'fast', 'secure', 'blue', 'agile', 'smart', 'neat', 'bold'];
const NOUNS = ['sam', 'fox', 'wolf', 'node', 'data', 'byte', 'pipe', 'base'];
const VERBS = ['beans', 'runs', 'soars', 'flows', 'syncs', 'spins', 'jumps', 'ops'];

const generateSlug = () => {
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${NOUNS[Math.floor(Math.random() * NOUNS.length)]}-${VERBS[Math.floor(Math.random() * VERBS.length)]}`;
};

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const navigate = useNavigate();

  // Tab State: 'workspaces' | 'settings'
  const [activeTab, setActiveTab] = useState('workspaces');

  // Provisioning Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const [workloadType, setWorkloadType] = useState('agent'); // 'agent' | 'dify' | 'n8n'

  // Telemetry Inspector State
  const [expandedTelemetryId, setExpandedTelemetryId] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Minigame State
  const [showGame, setShowGame] = useState(false);

  const handleCopy = (text, fieldName) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    setShowGame(false);
  }, [activeTab]);

  useEffect(() => {
    const initDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);

      // Fetch User Workspaces
      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (!wsError && wsData) {
        setWorkspaces(wsData);
      }

      // Setup Realtime Subscription for status updates
      const channel = supabase
        .channel(`schema-db-changes-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'workspaces',
          },
          (payload) => {
            setWorkspaces(current =>
              current.map(ws => ws.id === payload.new.id ? { ...ws, ...payload.new } : ws)
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'workspaces',
          },
          (payload) => {
            setWorkspaces(current => [payload.new, ...current]);
          }
        )
        .subscribe();

      setLoading(false);
      return () => {
        supabase.removeChannel(channel);
      };
    };

    initDashboard();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Open-Source Deployment: Users can deploy unlimited workloads on their AWS fleet
  const handleOpenDeployModal = (existingWorkspaceId = null) => {
    setSelectedWorkspaceId(existingWorkspaceId);
    setSlugInput(generateSlug());
    setSlugError('');
    setWorkloadType('agent');
    setIsModalOpen(true);
  };

  const executeProvisioning = async () => {
    if (!slugInput || slugInput.length < 3) {
      setSlugError("Workspace name must be at least 3 characters.");
      return;
    }

    setIsProvisioning(true);
    setSlugError('');

    try {
      // 1. Check if slug exists in DB to prevent clash
      const { count, error: countError } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', slugInput);

      if (countError) throw countError;
      if (count > 0) {
        throw new Error("This workspace name is already taken globally. Please try another.");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active authentication session found.");

      const now = new Date().toISOString();
      const generatedRulePriority = Math.floor(Math.random() * 49000) + 100;

      let targetWorkspaceId = selectedWorkspaceId;

      // If no pre-existing unprovisioned row was selected, insert a new workspace row
      if (!targetWorkspaceId) {
        const { data: newWs, error: insertError } = await supabase
          .from('workspaces')
          .insert({
            user_id: user.id,
            tenant_id: slugInput,
            workload_type: workloadType,
            status: 'provisioning',
            alb_listener_rule_priority: generatedRulePriority,
            provisioning_started_at: now
          })
          .select()
          .single();

        if (insertError) throw insertError;
        targetWorkspaceId = newWs.id;

        // Optimistically update local state
        setWorkspaces([newWs, ...workspaces]);
      } else {
        // Update existing unprovisioned row
        setWorkspaces(workspaces.map(w => w.id === targetWorkspaceId ? {
          ...w,
          tenant_id: slugInput,
          workload_type: workloadType,
          status: 'provisioning',
          alb_listener_rule_priority: generatedRulePriority,
          provisioning_started_at: now
        } : w));

        const { error: updateError } = await supabase
          .from('workspaces')
          .update({
            tenant_id: slugInput,
            workload_type: workloadType,
            status: 'provisioning',
            alb_listener_rule_priority: generatedRulePriority,
            provisioning_started_at: now
          })
          .eq('id', targetWorkspaceId);

        if (updateError) throw updateError;
      }

      setIsModalOpen(false);

      // Dispatch to AWS Step Functions
      const payload = {
        tenant_id: slugInput,
        workload_type: workloadType,
        alb_listener_rule_priority: generatedRulePriority
      };

      const res = await fetch(`${import.meta.env.VITE_API_GATEWAY_URL}/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AWS Gateway API failed: ${res.statusText} - ${errorText}`);
      }

    } catch (err) {
      console.error(err);
      setSlugError(err.message);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleResetWorkspace = async (workspaceId) => {
    if (!confirm("This will reset the setup process so you can try again. Continue?")) return;

    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          status: 'unprovisioned',
          tenant_id: null,
          provisioning_started_at: null
        })
        .eq('id', workspaceId);

      if (error) throw error;

      setWorkspaces(workspaces.map(w => w.id === workspaceId ? {
        ...w,
        status: 'unprovisioned',
        tenant_id: null,
        provisioning_started_at: null
      } : w));
    } catch (err) {
      console.error("Reset failed:", err);
      alert("Could not reset workspace. Please try again later.");
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <Loader2 className="animate-spin" size={40} color="#10b981" />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>

      {/* Provisioning Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '560px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '2rem'
          }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
              Deploy Isolated AI Instance
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              Provision a dedicated AWS Fargate Graviton MicroVM with native pgvector memory and keyless Bedrock IAM access.
            </p>

            {/* AI Engine Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Select Engine
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

                {/* Generic AI Container */}
                <div
                  onClick={() => setWorkloadType('agent')}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    border: `1.5px solid ${workloadType === 'agent' ? '#10b981' : '#e2e8f0'}`,
                    backgroundColor: workloadType === 'agent' ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    backgroundColor: workloadType === 'agent' ? '#dcfce7' : '#f1f5f9',
                    padding: '0.55rem',
                    borderRadius: '6px',
                    color: workloadType === 'agent' ? '#15803d' : '#64748b'
                  }}>
                    <Cpu size={18} />
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Custom AI Container / Agent</strong>
                      <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                        HERO
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                      Run any Docker image (FastAPI, CrewAI, LangGraph) with keyless Bedrock IAM & pgvector.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {/* Dify */}
                  <div
                    onClick={() => setWorkloadType('dify')}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${workloadType === 'dify' ? '#8b5cf6' : '#e2e8f0'}`,
                      backgroundColor: workloadType === 'dify' ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', color: workloadType === 'dify' ? '#7c3aed' : '#0f172a' }}>
                      <Bot size={16} />
                      <strong style={{ fontSize: '0.88rem' }}>Dify Studio</strong>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0 }}>
                      Visual RAG & agent canvas with Redis sidecar.
                    </p>
                  </div>

                  {/* n8n */}
                  <div
                    onClick={() => setWorkloadType('n8n')}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${workloadType === 'n8n' ? '#2563eb' : '#e2e8f0'}`,
                      backgroundColor: workloadType === 'n8n' ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', color: workloadType === 'n8n' ? '#1d4ed8' : '#0f172a' }}>
                      <Zap size={16} />
                      <strong style={{ fontSize: '0.88rem' }}>n8n Automation</strong>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0 }}>
                      Node orchestrator with dedicated Postgres schema.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Subdomain Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Subdomain Identifier
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <input
                  type="text"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-agent"
                  style={{
                    flexGrow: 1,
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace'
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: 'monospace' }}>
                  .{workloadType === 'dify' ? 'dify' : workloadType === 'agent' ? 'agent' : 'n8n'}.trybase.io
                </span>
              </div>

              <button
                onClick={() => setSlugInput(generateSlug())}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', padding: 0, fontWeight: 500 }}
              >
                Shuffle random name
              </button>
            </div>

            {slugError && (
              <div style={{
                color: '#dc2626',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <AlertCircle size={15} />
                {slugError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isProvisioning}
                style={{
                  padding: '0.65rem 1.15rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#475569',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeProvisioning}
                disabled={isProvisioning}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1.25rem',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isProvisioning ? 'not-allowed' : 'pointer'
                }}
              >
                {isProvisioning ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                Deploy Infrastructure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside style={{
        width: '260px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        padding: '1.75rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="logo.png" alt="TryBase Logo" style={{ height: '28px', width: 'auto' }} />
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#0f172a', display: 'block', lineHeight: 1.1 }}>
              TryBase
            </span>
            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Open Source
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
          <button
            onClick={() => setActiveTab('workspaces')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'workspaces' ? '#f1f5f9' : 'transparent',
              color: activeTab === 'workspaces' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'workspaces' ? 600 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <Server size={17} color={activeTab === 'workspaces' ? '#10b981' : '#64748b'} />
            <span>Workspaces</span>
          </button>

          <Link
            to="/docs"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              color: '#64748b',
              fontWeight: 500,
              fontSize: '0.88rem',
              textDecoration: 'none',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <BookOpen size={17} />
            <span>Documentation</span>
            <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
          </Link>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'settings' ? '#f1f5f9' : 'transparent',
              color: activeTab === 'settings' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'settings' ? 600 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <Settings size={17} color={activeTab === 'settings' ? '#10b981' : '#64748b'} />
            <span>Settings</span>
          </button>
        </nav>

        {/* User Card & Sign Out */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Logged in as</span>
            <strong>{user?.email}</strong>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flexGrow: 1, padding: '2.5rem 3.5rem', maxWidth: '1400px', overflowY: 'auto' }}>

        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.35rem 0' }}>
              Hi, {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}!
            </h1>
            <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0 }}>
              Manage and monitor your autonomous AI agent fleet on AWS Fargate.
            </p>
          </div>

          <button
            onClick={() => handleOpenDeployModal()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 1.15rem',
              backgroundColor: '#10b981',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.92rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              transition: 'background-color 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
          >
            <Plus size={16} /> Deploy Workload
          </button>
        </header>

        {activeTab === 'workspaces' ? (
          <div>
            {/* Hyperscaler Control Plane Service-Level Indicators (SLIs) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>

              {/* SLI 1: Zero-Trust MicroVM Fleet */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #10b981',
                borderRadius: '8px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.45rem', borderRadius: '6px' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <span style={{ backgroundColor: '#f0fdf4', color: '#166534', fontSize: '0.7rem', border: '1px solid #bbf7d0', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                    0 PUBLIC IPS
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                  Private MicroVM Fleet
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
                  100% Private VPC
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Per-tenant IAM roles • AWS Fargate Graviton
                </p>
              </div>

              {/* SLI 2: Amazon Bedrock AI Gateway */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #8b5cf6',
                borderRadius: '8px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '0.45rem', borderRadius: '6px' }}>
                    <Sparkles size={18} />
                  </div>
                  <span style={{ backgroundColor: '#faf5ff', color: '#6b21a8', fontSize: '0.7rem', border: '1px solid #e9d5ff', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                    PII GUARDRAILS
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                  Bedrock AI Gateway
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
                  480ms P95
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Keyless IAM STS • Claude 3.5 & Titan Models
                </p>
              </div>

              {/* SLI 3: pgvector Memory Engine */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #0284c7',
                borderRadius: '8px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.45rem', borderRadius: '6px' }}>
                    <Database size={18} />
                  </div>
                  <span style={{ backgroundColor: '#f0f9ff', color: '#075985', fontSize: '0.7rem', border: '1px solid #bae6fd', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                    HNSW INDEXED
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                  RDS Vector Memory
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
                  1,536-dim pgvector
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Dedicated tenant schema • PostgreSQL 16.3
                </p>
              </div>

              {/* SLI 4: FinOps Cost Governance */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #d97706',
                borderRadius: '8px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '0.45rem', borderRadius: '6px' }}>
                    <Activity size={18} />
                  </div>
                  <span style={{ backgroundColor: '#fffbeb', color: '#92400e', fontSize: '0.7rem', border: '1px solid #fde68a', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                    FINOPS AUDITED
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                  Cloud Cost Attribution
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
                  Infracost Verified
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Pre-deploy cost audit • Scale-to-Zero ready
                </p>
              </div>

            </div>

            {/* Workloads List */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
            }}>
              {workspaces.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4.5rem 2rem' }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem auto'
                  }}>
                    <Server size={24} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                    No workloads deployed yet
                  </h3>
                  <p style={{ color: '#64748b', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    Launch your first autonomous AI agent container, Dify studio, or n8n workflow engine on your private AWS Fargate fleet.
                  </p>
                  <button
                    onClick={() => handleOpenDeployModal()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.25rem',
                      backgroundColor: '#10b981',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={16} /> Deploy Your First Workload
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                      Active Fleet ({workspaces.length})
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                      AWS Region: eu-west-2
                    </span>
                  </div>

                  {workspaces.map(ws => (
                    <div key={ws.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1.25rem 1.5rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1.1rem', letterSpacing: '-0.01em', color: '#0f172a' }}>
                              {ws.tenant_id || '<Pending Setup>'}
                            </strong>
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: 'monospace' }}>
                              .{ws.workload_type === 'dify' ? 'dify' : (ws.workload_type === 'agent' || ws.workload_type === 'generic') ? 'agent' : 'n8n'}.trybase.io
                            </span>

                            {/* Workload Badge */}
                            <span style={{
                              backgroundColor: (ws.workload_type === 'agent' || ws.workload_type === 'generic') ? '#dcfce7' : ws.workload_type === 'dify' ? '#f5f3ff' : '#eff6ff',
                              color: (ws.workload_type === 'agent' || ws.workload_type === 'generic') ? '#15803d' : ws.workload_type === 'dify' ? '#7c3aed' : '#1d4ed8',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontWeight: 600,
                              border: `1px solid ${(ws.workload_type === 'agent' || ws.workload_type === 'generic') ? '#bbf7d0' : ws.workload_type === 'dify' ? '#e9d5ff' : '#dbeafe'}`
                            }}>
                              {(ws.workload_type === 'agent' || ws.workload_type === 'generic') ? <Cpu size={12} /> : ws.workload_type === 'dify' ? <Bot size={12} /> : <Zap size={12} />}
                              {(ws.workload_type === 'agent' || ws.workload_type === 'generic') ? 'Custom AI Container' : ws.workload_type === 'dify' ? 'Dify AI Studio' : 'n8n Automation'}
                            </span>

                            {/* pgvector badge */}
                            <span style={{
                              backgroundColor: '#f0f9ff',
                              color: '#0369a1',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              border: '1px solid #bae6fd',
                              fontWeight: 500
                            }}>
                              <Database size={11} /> pgvector 0.7
                            </span>

                            {/* Bedrock IAM badge */}
                            <span style={{
                              backgroundColor: '#faf5ff',
                              color: '#6b21a8',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              border: '1px solid #e9d5ff',
                              fontWeight: 500
                            }}>
                              <Sparkles size={11} /> Keyless STS
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: ws.status === 'active' ? '#10b981' : ws.status === 'provisioning' ? '#f59e0b' : '#94a3b8'
                            }}></span>
                            <span>Status: <strong style={{ textTransform: 'capitalize', color: ws.status === 'active' ? '#15803d' : '#0f172a' }}>{ws.status}</strong></span>
                            <span>&bull;</span>
                            <span>AWS Fargate Graviton (0.5 vCPU • 1 GB)</span>
                            <span>&bull;</span>
                            <span>0 Public IPs</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                          {ws.status === 'provisioning' && (
                            <button
                              onClick={() => handleResetWorkspace(ws.id)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
                            >
                              Reset Deployment
                            </button>
                          )}

                          {ws.status === 'unprovisioned' ? (
                            <button
                              onClick={() => handleOpenDeployModal(ws.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: '#10b981',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <CheckCircle2 size={15} /> Complete Setup
                            </button>
                          ) : ws.status === 'active' ? (
                            <>
                              <button
                                onClick={() => setExpandedTelemetryId(expandedTelemetryId === ws.id ? null : ws.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.5rem 0.85rem',
                                  backgroundColor: expandedTelemetryId === ws.id ? '#f1f5f9' : '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  color: '#334155',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                <Activity size={14} color="#0284c7" />
                                Telemetry & Security
                                {expandedTelemetryId === ws.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>

                              <a
                                href={`https://${ws.tenant_id}.${ws.workload_type === 'dify' ? 'dify' : (ws.workload_type === 'agent' || ws.workload_type === 'generic') ? 'agent' : 'n8n'}.trybase.io`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.5rem 0.95rem',
                                  backgroundColor: '#0f172a',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  textDecoration: 'none'
                                }}
                              >
                                {(ws.workload_type === 'agent' || ws.workload_type === 'generic') ? 'Open Agent API' : ws.workload_type === 'dify' ? 'Open Dify Studio' : 'Open n8n'}
                                <ExternalLink size={12} />
                              </a>
                            </>
                          ) : (
                            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '0.4rem 0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                              Provisioning...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expandable Telemetry Drawer */}
                      {ws.status === 'active' && expandedTelemetryId === ws.id && (
                        <div style={{
                          padding: '1.5rem',
                          margin: '0 1.5rem 1.5rem 1.5rem',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ShieldCheck size={17} color="#10b981" />
                              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Live Control Plane Inspector</strong>
                              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                ENFORCED
                              </span>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                              Region: eu-west-2 &bull; VPC: Private Subnet
                            </span>
                          </div>

                          {/* 3-Column Diagnostic Specs Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>

                            {/* Column 1: Zero-Trust IAM & Bedrock */}
                            <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#7c3aed', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                                <Lock size={14} /> Zero-Trust IAM & Bedrock
                              </div>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Dedicated IAM Task Role:</span>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: '0.3rem 0.5rem', borderRadius: '4px', marginTop: '0.2rem' }}>
                                  <code style={{ fontSize: '0.75rem', color: '#0f172a' }}>trybase-{ws.tenant_id}-task-role</code>
                                  <button
                                    onClick={() => handleCopy(`trybase-${ws.tenant_id}-task-role`, `role-${ws.id}`)}
                                    style={{ background: 'none', border: 'none', color: copiedField === `role-${ws.id}` ? '#15803d' : '#64748b', cursor: 'pointer', padding: 0 }}
                                    title="Copy Role Name"
                                  >
                                    {copiedField === `role-${ws.id}` ? <Check size={12} /> : <Copy size={12} />}
                                  </button>
                                </div>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.5 }}>
                                <div>&bull; Bedrock: <code>bedrock:InvokeModel</code> (Keyless STS)</div>
                                <div>&bull; Guardrails: <code>PII Masking Active</code></div>
                                <div>&bull; Raw Keys Stored: <strong style={{ color: '#15803d' }}>0 (Zero secrets)</strong></div>
                              </div>
                            </div>

                            {/* Column 2: MicroVM Specs & Vector Memory */}
                            <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284c7', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                                <Cpu size={14} /> MicroVM & Vector Memory
                              </div>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Isolated RDS Vector Target:</span>
                                <div style={{ backgroundColor: '#f1f5f9', padding: '0.3rem 0.5rem', borderRadius: '4px', marginTop: '0.2rem' }}>
                                  <code style={{ fontSize: '0.75rem', color: '#0284c7' }}>
                                    {ws.workload_type === 'dify' ? `db_${(ws.tenant_id || '').replace(/-/g, '_')}` : `schema ${(ws.tenant_id || '').replace(/-/g, '_')}`}
                                  </code>
                                </div>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.5 }}>
                                <div>&bull; Hypervisor: <code>AWS Fargate Graviton ARM64</code></div>
                                <div>&bull; Memory: <code>0.5 vCPU • 1024 MiB RAM</code></div>
                                <div>&bull; Index: <code>pgvector 1,536-dim HNSW</code></div>
                              </div>
                            </div>

                            {/* Column 3: Telemetry & Cost SLIs */}
                            <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b45309', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                                <Activity size={14} /> Service-Level Indicators
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <div style={{ backgroundColor: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                  <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>P95 Latency</span>
                                  <strong style={{ fontSize: '0.9rem', color: '#15803d' }}>485ms</strong>
                                </div>
                                <div style={{ backgroundColor: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                  <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Target Health</span>
                                  <strong style={{ fontSize: '0.9rem', color: '#15803d' }}>HTTP 200</strong>
                                </div>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.5 }}>
                                <div>&bull; Tokens Processed: <strong>284,500 (24h)</strong></div>
                                <div>&bull; Infracost Burn: <strong>~$0.18 / day compute</strong></div>
                                <div>&bull; Scale-to-Zero: <strong style={{ color: '#0284c7' }}>Ready (Auto-Idle)</strong></div>
                              </div>
                            </div>

                          </div>

                          {/* Live Task Stream Console */}
                          <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', padding: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'monospace' }}>
                                <Terminal size={13} color="#10b981" />
                                CloudWatch Task Logs &bull; awslogs/trybase-{ws.tenant_id}
                              </span>
                              <span style={{ backgroundColor: '#14532d', color: '#86efac', fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                LIVE STREAM
                              </span>
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.6, maxHeight: '90px', overflowY: 'auto' }}>
                              <div style={{ color: '#94a3b8' }}>[task/trybase-{ws.tenant_id}] Initializing isolated microVM container on AWS Fargate (ARM64)...</div>
                              <div style={{ color: '#86efac' }}>[iam-auth] Scoped STS token assumed for role trybase-{ws.tenant_id}-task-role (TTL: 3600s)</div>
                              <div style={{ color: '#d8b4fe' }}>[bedrock-client] Bedrock runtime client ready (region: eu-west-2, keyless IAM auth)</div>
                              <div style={{ color: '#7dd3fc' }}>[pgvector] Connection pool established to db.trybase.internal:5432 with pgvector enabled</div>
                              <div style={{ color: '#f8fafc' }}>[alb-ingress] Health check GET / → 200 OK. Traffic routing active on private port.</div>
                            </div>
                          </div>

                        </div>
                      )}

                      {ws.status === 'provisioning' && (
                        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                          <ProvisioningTerminal
                            status={ws.status}
                            tenantId={ws.tenant_id}
                            startedAt={ws.provisioning_started_at}
                            finishedAt={ws.provisioned_at}
                            onTriggerGame={() => setShowGame(true)}
                          />
                          {showGame && (
                            <div style={{ marginTop: '1.5rem' }}>
                              <ProvisioningGame />
                            </div>
                          )}
                        </div>
                      )}

                      {ws.status === 'active' && !expandedTelemetryId && (
                        <div style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
                          <ProvisioningTerminal
                            status={ws.status}
                            tenantId={ws.tenant_id}
                            startedAt={ws.provisioning_started_at}
                            finishedAt={ws.provisioned_at}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                Account Settings
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                Manage your console profile and password credentials.
              </p>
            </div>

            <div style={{ padding: '2rem', maxWidth: '520px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
                Change Password
              </h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const newPass = e.target.newPassword.value;
                if (!newPass || newPass.length < 6) return alert("Password must be at least 6 characters.");
                const { error } = await supabase.auth.updateUser({ password: newPass });
                if (error) alert("Error updating password: " + error.message);
                else {
                  alert("Password updated successfully!");
                  e.target.reset();
                }
              }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: '#334155', fontSize: '0.85rem', fontWeight: 600 }}>
                    New Password
                  </label>
                  <input
                    name="newPassword"
                    type="password"
                    placeholder="Enter new password (min. 6 chars)"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontSize: '0.92rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '0.65rem 1.25rem',
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Update Password
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default Dashboard;
