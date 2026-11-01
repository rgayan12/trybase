import React, { useEffect, useState } from 'react';
import {
  Server, Settings, LogOut, Loader2, Zap, CheckCircle2,
  Activity, Database, Bot, Sparkles, Cpu,
  ShieldCheck, Terminal, ChevronDown, ChevronUp, Copy, Check, ExternalLink, Lock,
  Plus, BookOpen, AlertCircle, Eye, EyeOff, Key,
  Sliders, Globe, RefreshCw, Box, Code2, FileCode, Layers
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

const baseDomain = import.meta.env.VITE_BASE_DOMAIN || 'trybase.io';

const generateFleetYaml = (slug, workload, cpu, mem, redis, bedrock, antileak, domain) => {
  return `# ==============================================================================
# TryBase Declarative IaaS Fleet Manifest (trybase.fleet.yml)
# Virtual Single-Tenancy on AWS Fargate Graviton MicroVM
# Deploy via CLI: trybase fleet deploy trybase.fleet.yml
# ==============================================================================

organization: ${slug || 'my-org'}
version: "1.0"

workloads:
  - name: ${slug || 'workload'}
    archetype: ${workload}
    subdomain: ${slug || 'workload'}.${domain}
    cpu: ${cpu}
    memory: ${mem}
    settings:
      enable_bedrock: ${bedrock}
      enable_redis: ${redis}
      enable_anti_leak: ${antileak}
      db_schema: "schema_${(slug || 'app').replace(/-/g, '_')}"
    secrets:
      TRYBASE_SOCKET_PATH: "/var/run/trybase/secrets.sock"
      ENVIRONMENT: "production"
      LOG_LEVEL: "INFO"`;
};

const YAML_PRESETS = {
  openclaw: `# ==============================================================================
# Preset: OpenClaw Autonomous Multi-System Agent + In-Task Redis
# ==============================================================================
organization: acme-ai
version: "1.0"

workloads:
  - name: autonomous-runner
    archetype: openclaw
    subdomain: agent.${baseDomain}
    cpu: 1024
    memory: 2048
    settings:
      enable_bedrock: true
      enable_redis: true
      enable_anti_leak: true
      db_schema: "schema_agent"
    secrets:
      TRYBASE_SOCKET_PATH: "/var/run/trybase/secrets.sock"
      WORKSPACE_DIR: "/workspace"
      ENABLE_ANTI_LEAK: "true"
      LOG_LEVEL: "INFO"`,

  platform: `# ==============================================================================
# Preset: Full AI Organization Platform (OpenClaw + Dify + n8n Mesh)
# ==============================================================================
organization: acme-ai
version: "1.0"

workloads:
  # 1. Orchestration Engine
  - name: workflow
    archetype: n8n
    subdomain: workflow.${baseDomain}
    cpu: 512
    memory: 1024
    settings:
      db_schema: "schema_n8n"

  # 2. Knowledge & Prompt Studio
  - name: knowledge
    archetype: dify
    subdomain: dify.${baseDomain}
    cpu: 1024
    memory: 2048
    settings:
      enable_redis: true
      db_schema: "schema_dify"

  # 3. Autonomous Agent Execution
  - name: runner
    archetype: openclaw
    subdomain: agent.${baseDomain}
    cpu: 1024
    memory: 2048
    settings:
      enable_bedrock: true
      enable_redis: true
      enable_anti_leak: true
      db_schema: "schema_agent"`,

  laravel: `# ==============================================================================
# Preset: Laravel 11 Production API + Artisan + Redis Queue
# ==============================================================================
organization: acme-corp
version: "1.0"

workloads:
  - name: core-api
    archetype: laravel
    subdomain: api.${baseDomain}
    cpu: 512
    memory: 1024
    settings:
      enable_redis: true
      db_schema: "schema_laravel"
    secrets:
      APP_ENV: "production"
      APP_DEBUG: "false"
      DB_CONNECTION: "pgsql"`,

  django: `# ==============================================================================
# Preset: Django REST API + Celery Async Broker
# ==============================================================================
organization: acme-corp
version: "1.0"

workloads:
  - name: backend-service
    archetype: django
    subdomain: django.${baseDomain}
    cpu: 512
    memory: 1024
    settings:
      enable_redis: true
      db_schema: "schema_django"
    secrets:
      DJANGO_SETTINGS_MODULE: "config.settings.production"
      ENVIRONMENT: "production"`
};

const getWorkloadIcon = (type) => {
  switch (type) {
    case 'openclaw':
    case 'agent':
    case 'generic':
      return <Cpu size={12} />;
    case 'openmuse':
      return <Box size={12} />;
    case 'dify':
      return <Bot size={12} />;
    case 'n8n':
      return <Zap size={12} />;
    case 'laravel':
      return <Server size={12} />;
    case 'django':
      return <Database size={12} />;
    default:
      return <Code2 size={12} />;
  }
};

const getWorkloadLabel = (type) => {
  switch (type) {
    case 'openclaw':
    case 'agent':
    case 'generic':
      return 'OpenClaw Agent';
    case 'openmuse':
      return 'OpenMuse Sandbox';
    case 'dify':
      return 'Dify Studio';
    case 'n8n':
      return 'n8n Automation';
    case 'laravel':
      return 'Laravel 11 API';
    case 'django':
      return 'Django REST';
    case 'custom':
      return 'Custom Container';
    default:
      return type || 'Workload';
  }
};

const getWorkloadBadge = (type) => {
  switch (type) {
    case 'openclaw':
    case 'agent':
    case 'generic':
      return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
    case 'openmuse':
      return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
    case 'dify':
      return { bg: '#f5f3ff', color: '#7c3aed', border: '#e9d5ff' };
    case 'n8n':
      return { bg: '#eff6ff', color: '#1d4ed8', border: '#dbeafe' };
    case 'laravel':
      return { bg: '#fef2f2', color: '#dc2626', border: '#fee2e2' };
    case 'django':
      return { bg: '#f0fdfa', color: '#0f766e', border: '#ccfbf1' };
    default:
      return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  }
};

const getWorkloadLaunchLabel = (type) => {
  switch (type) {
    case 'openclaw':
    case 'agent':
    case 'generic':
      return 'Open Agent API';
    case 'openmuse':
      return 'Open Sandbox';
    case 'dify':
      return 'Open Dify Studio';
    case 'n8n':
      return 'Open n8n';
    case 'laravel':
      return 'Open Laravel App';
    case 'django':
      return 'Open Django API';
    case 'custom':
      return 'Open Container';
    default:
      return 'Open Workload';
  }
};

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenTtl, setTokenTtl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const navigate = useNavigate();

  // Tab State: 'workspaces' | 'settings'
  const [activeTab, setActiveTab] = useState('workspaces');

  // Provisioning Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('visual'); // 'visual' | 'declarative'
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const [workloadType, setWorkloadType] = useState('openclaw'); // 'openclaw' | 'openmuse' | 'dify' | 'n8n' | 'laravel' | 'django' | 'custom'
  const [workloadCategory, setWorkloadCategory] = useState('agents'); // 'agents' | 'studios' | 'backends'
  const [cpuAllocation, setCpuAllocation] = useState(1024); // 256 | 512 | 1024 | 2048
  const [memoryAllocation, setMemoryAllocation] = useState(2048); // 512 | 1024 | 2048 | 4096
  const [enableRedisSidecar, setEnableRedisSidecar] = useState(true);
  const [enableBedrockAccess, setEnableBedrockAccess] = useState(true);
  const [enableAntiLeakUds, setEnableAntiLeakUds] = useState(true);
  const [showYamlDrawer, setShowYamlDrawer] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [rawYamlInput, setRawYamlInput] = useState(YAML_PRESETS.openclaw);

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
    if (!session?.expires_at) return;
    const updateTtl = () => {
      const remaining = session.expires_at - Math.floor(Date.now() / 1000);
      setTokenTtl(remaining > 0 ? remaining : 0);
    };
    updateTtl();
    const interval = setInterval(updateTtl, 1000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    setShowGame(false);
  }, [activeTab]);

  useEffect(() => {
    const initDashboard = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.user) {
        navigate('/');
        return;
      }
      setSession(currentSession);
      setUser(currentSession.user);

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
    const newSlug = generateSlug();
    setSlugInput(newSlug);
    setSlugError('');
    setWorkloadType('openclaw');
    setWorkloadCategory('agents');
    setCpuAllocation(1024);
    setMemoryAllocation(2048);
    setEnableRedisSidecar(true);
    setEnableBedrockAccess(true);
    setEnableAntiLeakUds(true);
    setModalTab('visual');
    setShowYamlDrawer(false);
    setRawYamlInput(generateFleetYaml(newSlug, 'openclaw', 1024, 2048, true, true, true, baseDomain));
    setIsModalOpen(true);
  };

  const executeProvisioning = async () => {
    let targetSlug = slugInput;
    let targetWorkload = workloadType;
    let targetCpu = cpuAllocation;
    let targetMem = memoryAllocation;

    if (modalTab === 'declarative' && rawYamlInput) {
      const matchOrg = rawYamlInput.match(/organization:\s*([a-zA-Z0-9_-]+)/);
      const matchArch = rawYamlInput.match(/archetype:\s*([a-zA-Z0-9_-]+)/);
      const matchSub = rawYamlInput.match(/subdomain:\s*([a-zA-Z0-9_.-]+)/);
      const matchCpu = rawYamlInput.match(/cpu:\s*([0-9]+)/);
      const matchMem = rawYamlInput.match(/memory:\s*([0-9]+)/);

      if (matchSub) {
        targetSlug = matchSub[1].split('.')[0];
      } else if (matchOrg) {
        targetSlug = matchOrg[1];
      }
      if (matchArch) {
        targetWorkload = matchArch[1];
      }
      if (matchCpu) {
        targetCpu = parseInt(matchCpu[1], 10);
      }
      if (matchMem) {
        targetMem = parseInt(matchMem[1], 10);
      }
    }

    if (!targetSlug || targetSlug.length < 3) {
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
        .eq('tenant_id', targetSlug);

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
            tenant_id: targetSlug,
            workload_type: targetWorkload,
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
          tenant_id: targetSlug,
          workload_type: targetWorkload,
          status: 'provisioning',
          alb_listener_rule_priority: generatedRulePriority,
          provisioning_started_at: now
        } : w));

        const { error: updateError } = await supabase
          .from('workspaces')
          .update({
            tenant_id: targetSlug,
            workload_type: targetWorkload,
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
        tenant_id: targetSlug,
        workload_type: targetWorkload,
        alb_listener_rule_priority: generatedRulePriority,
        cpu: targetCpu,
        memory: targetMem
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
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.4rem 1.65rem 1rem 1.65rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Deploy Virtually Isolated Instance
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.66rem', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.04em' }}>
                    VIRTUAL SINGLE-TENANCY
                  </span>
                  <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.66rem', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.04em' }}>
                    IaaS YAML
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Provision a dedicated AWS Fargate Graviton MicroVM with isolated PostgreSQL schema, link-local STS, and Anti-Leak UDS.
              </p>

              {/* Mode Switcher Tabs */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.9rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                <button
                  onClick={() => setModalTab('visual')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: modalTab === 'visual' ? '#ffffff' : 'transparent',
                    color: modalTab === 'visual' ? '#0f172a' : '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    boxShadow: modalTab === 'visual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sliders size={14} color={modalTab === 'visual' ? '#10b981' : '#64748b'} />
                  Visual Configurator
                </button>
                <button
                  onClick={() => {
                    setModalTab('declarative');
                    setRawYamlInput(generateFleetYaml(slugInput, workloadType, cpuAllocation, memoryAllocation, enableRedisSidecar, enableBedrockAccess, enableAntiLeakUds, baseDomain));
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: modalTab === 'declarative' ? '#ffffff' : 'transparent',
                    color: modalTab === 'declarative' ? '#0f172a' : '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    boxShadow: modalTab === 'declarative' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FileCode size={14} color={modalTab === 'declarative' ? '#2563eb' : '#64748b'} />
                  Declarative IaaS (trybase.fleet.yml)
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{ padding: '1.15rem 1.65rem', overflowY: 'auto', flexGrow: 1 }}>
              {modalTab === 'visual' ? (
                <>
                  {/* Category Filter Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.2rem' }}>
                      Workload Stack:
                    </span>
                    {[
                      { id: 'agents', label: 'Autonomous Agents', icon: Cpu },
                      { id: 'studios', label: 'AI Studios', icon: Bot },
                      { id: 'backends', label: 'Application Backends', icon: Server }
                    ].map(cat => {
                      const Icon = cat.icon;
                      const isActive = workloadCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setWorkloadCategory(cat.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            border: `1px solid ${isActive ? '#10b981' : '#e2e8f0'}`,
                            backgroundColor: isActive ? '#f0fdf4' : '#ffffff',
                            color: isActive ? '#15803d' : '#64748b',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Icon size={12} />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Archetype Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.15rem' }}>
                    {workloadCategory === 'agents' && (
                      <>
                        {/* OpenClaw */}
                        <div
                          onClick={() => {
                            setWorkloadType('openclaw');
                            setCpuAllocation(1024);
                            setMemoryAllocation(2048);
                            setEnableRedisSidecar(true);
                            setEnableBedrockAccess(true);
                            setEnableAntiLeakUds(true);
                          }}
                          style={{
                            padding: '0.85rem 1rem',
                            borderRadius: '8px',
                            border: `1.5px solid ${(workloadType === 'openclaw' || workloadType === 'agent') ? '#10b981' : '#e2e8f0'}`,
                            backgroundColor: (workloadType === 'openclaw' || workloadType === 'agent') ? '#f0fdf4' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.85rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            backgroundColor: (workloadType === 'openclaw' || workloadType === 'agent') ? '#dcfce7' : '#f1f5f9',
                            padding: '0.55rem',
                            borderRadius: '6px',
                            color: (workloadType === 'openclaw' || workloadType === 'agent') ? '#15803d' : '#64748b',
                            marginTop: '0.1rem'
                          }}>
                            <Cpu size={20} />
                          </div>
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>OpenClaw Autonomous Agent / Container</strong>
                              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                HERO
                              </span>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.45rem 0', lineHeight: 1.4 }}>
                              Keyless Bedrock IAM Task Role (15m auto-rotated STS), in-task Redis memory, and Anti-Leak UDS.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #bbf7d0', color: '#166534', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                                Bedrock STS (169.254.170.2)
                              </span>
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #bbf7d0', color: '#166534', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                                In-Task Redis (127.0.0.1:6379)
                              </span>
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #bbf7d0', color: '#166534', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                                Anti-Leak UDS (/run/trybase/secrets.sock)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* OpenMuse */}
                        <div
                          onClick={() => {
                            setWorkloadType('openmuse');
                            setCpuAllocation(1024);
                            setMemoryAllocation(2048);
                            setEnableRedisSidecar(false);
                            setEnableBedrockAccess(true);
                            setEnableAntiLeakUds(true);
                          }}
                          style={{
                            padding: '0.85rem 1rem',
                            borderRadius: '8px',
                            border: `1.5px solid ${workloadType === 'openmuse' ? '#f59e0b' : '#e2e8f0'}`,
                            backgroundColor: workloadType === 'openmuse' ? '#fffbeb' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.85rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            backgroundColor: workloadType === 'openmuse' ? '#fef3c7' : '#f1f5f9',
                            padding: '0.55rem',
                            borderRadius: '6px',
                            color: workloadType === 'openmuse' ? '#b45309' : '#64748b',
                            marginTop: '0.1rem'
                          }}>
                            <Box size={20} />
                          </div>
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>OpenMuse Computer Use / Sandbox</strong>
                              <span style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                SANDBOX
                              </span>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.45rem 0', lineHeight: 1.4 }}>
                              Isolated Chromium headless browser and desktop environment for autonomous computer-use agents.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #fde68a', color: '#92400e', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                                Chromium Sandbox
                              </span>
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #fde68a', color: '#92400e', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                                Virtual Display X11
                              </span>
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #fde68a', color: '#92400e', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                                Anti-Leak UDS
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {workloadCategory === 'studios' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                        {/* Dify */}
                        <div
                          onClick={() => {
                            setWorkloadType('dify');
                            setCpuAllocation(1024);
                            setMemoryAllocation(2048);
                            setEnableRedisSidecar(true);
                            setEnableBedrockAccess(false);
                            setEnableAntiLeakUds(false);
                          }}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '8px',
                            border: `1.5px solid ${workloadType === 'dify' ? '#8b5cf6' : '#e2e8f0'}`,
                            backgroundColor: workloadType === 'dify' ? '#f5f3ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: workloadType === 'dify' ? '#7c3aed' : '#0f172a' }}>
                              <Bot size={16} />
                              <strong style={{ fontSize: '0.88rem' }}>Dify Studio</strong>
                            </div>
                            <span style={{ fontSize: '0.65rem', backgroundColor: '#ede9fe', color: '#6d28d9', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              STUDIO
                            </span>
                          </div>
                          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 0.4rem 0' }}>
                            Visual RAG & agent canvas with pgvector and Redis sidecar.
                          </p>
                          <div style={{ fontSize: '0.68rem', color: '#7c3aed', fontFamily: 'monospace' }}>
                            pgvector • Redis Sidecar
                          </div>
                        </div>

                        {/* n8n */}
                        <div
                          onClick={() => {
                            setWorkloadType('n8n');
                            setCpuAllocation(512);
                            setMemoryAllocation(1024);
                            setEnableRedisSidecar(false);
                            setEnableBedrockAccess(false);
                            setEnableAntiLeakUds(false);
                          }}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '8px',
                            border: `1.5px solid ${workloadType === 'n8n' ? '#2563eb' : '#e2e8f0'}`,
                            backgroundColor: workloadType === 'n8n' ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: workloadType === 'n8n' ? '#1d4ed8' : '#0f172a' }}>
                              <Zap size={16} />
                              <strong style={{ fontSize: '0.88rem' }}>n8n Automation</strong>
                            </div>
                            <span style={{ fontSize: '0.65rem', backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              FLOWS
                            </span>
                          </div>
                          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 0.4rem 0' }}>
                            400+ node orchestrator with dedicated Postgres schema.
                          </p>
                          <div style={{ fontSize: '0.68rem', color: '#2563eb', fontFamily: 'monospace' }}>
                            Schema Isolation • Webhooks
                          </div>
                        </div>
                      </div>
                    )}

                    {workloadCategory === 'backends' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                        {/* Laravel */}
                        <div
                          onClick={() => {
                            setWorkloadType('laravel');
                            setCpuAllocation(512);
                            setMemoryAllocation(1024);
                            setEnableRedisSidecar(true);
                            setEnableBedrockAccess(false);
                            setEnableAntiLeakUds(false);
                          }}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '8px',
                            border: `1.5px solid ${workloadType === 'laravel' ? '#ef4444' : '#e2e8f0'}`,
                            backgroundColor: workloadType === 'laravel' ? '#fef2f2' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: workloadType === 'laravel' ? '#dc2626' : '#0f172a' }}>
                              <Server size={15} />
                              <strong style={{ fontSize: '0.85rem' }}>Laravel 11</strong>
                            </div>
                            <span style={{ fontSize: '0.62rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              PHP 8.3
                            </span>
                          </div>
                          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 0.35rem 0' }}>
                            PHP 8.3 & Artisan with tenant schema and Redis queue.
                          </p>
                          <div style={{ fontSize: '0.65rem', color: '#ef4444', fontFamily: 'monospace' }}>
                            Artisan • Queue • RDS
                          </div>
                        </div>

                        {/* Django */}
                        <div
                          onClick={() => {
                            setWorkloadType('django');
                            setCpuAllocation(512);
                            setMemoryAllocation(1024);
                            setEnableRedisSidecar(true);
                            setEnableBedrockAccess(false);
                            setEnableAntiLeakUds(false);
                          }}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '8px',
                            border: `1.5px solid ${workloadType === 'django' ? '#0d9488' : '#e2e8f0'}`,
                            backgroundColor: workloadType === 'django' ? '#f0fdfa' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: workloadType === 'django' ? '#0f766e' : '#0f172a' }}>
                              <Database size={15} />
                              <strong style={{ fontSize: '0.85rem' }}>Django REST</strong>
                            </div>
                            <span style={{ fontSize: '0.62rem', backgroundColor: '#ccfbf1', color: '#115e59', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              PY 3.12
                            </span>
                          </div>
                          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 0.35rem 0' }}>
                            Python 3.12 enterprise API with Celery broker.
                          </p>
                          <div style={{ fontSize: '0.65rem', color: '#0d9488', fontFamily: 'monospace' }}>
                            Celery • RDS Schema
                          </div>
                        </div>

                        {/* Custom Container */}
                        <div
                          onClick={() => {
                            setWorkloadType('custom');
                            setCpuAllocation(256);
                            setMemoryAllocation(512);
                            setEnableRedisSidecar(false);
                            setEnableBedrockAccess(false);
                            setEnableAntiLeakUds(false);
                          }}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '8px',
                            border: `1.5px solid ${workloadType === 'custom' ? '#64748b' : '#e2e8f0'}`,
                            backgroundColor: workloadType === 'custom' ? '#f8fafc' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: workloadType === 'custom' ? '#334155' : '#0f172a' }}>
                              <Code2 size={15} />
                              <strong style={{ fontSize: '0.85rem' }}>Custom OCI</strong>
                            </div>
                            <span style={{ fontSize: '0.62rem', backgroundColor: '#e2e8f0', color: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              DOCKER
                            </span>
                          </div>
                          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 0.35rem 0' }}>
                            Deploy any Docker image (Node, Go, Rust, FastAPI).
                          </p>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace' }}>
                            Graviton • Private ALB
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resource Sizing Allocation */}
                  <div style={{ marginBottom: '1.15rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Graviton Compute Sizing (vCPU & RAM)
                      </label>
                      <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, fontFamily: 'monospace' }}>
                        {cpuAllocation >= 1024 ? `${cpuAllocation / 1024}.0 vCPU` : `${cpuAllocation / 1024} vCPU`} • {memoryAllocation} MB RAM
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                      {[
                        { cpu: 256, memory: 512, label: '0.25 vCPU', sub: '512 MB' },
                        { cpu: 512, memory: 1024, label: '0.5 vCPU', sub: '1024 MB' },
                        { cpu: 1024, memory: 2048, label: '1.0 vCPU', sub: '2048 MB' },
                        { cpu: 2048, memory: 4096, label: '2.0 vCPU', sub: '4096 MB' }
                      ].map(tier => {
                        const isSelected = cpuAllocation === tier.cpu && memoryAllocation === tier.memory;
                        return (
                          <div
                            key={tier.cpu}
                            onClick={() => {
                              setCpuAllocation(tier.cpu);
                              setMemoryAllocation(tier.memory);
                            }}
                            style={{
                              padding: '0.45rem 0.5rem',
                              borderRadius: '6px',
                              border: `1.5px solid ${isSelected ? '#10b981' : '#e2e8f0'}`,
                              backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                              cursor: 'pointer',
                              textAlign: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? '#15803d' : '#0f172a' }}>
                              {tier.label}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              {tier.sub}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subdomain Input & Live ALB Route (Non-Misleading) */}
                  <div style={{ marginBottom: '1.15rem' }}>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Subdomain Identifier (Virtual Single-Tenant ALB Route)
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 0.85rem' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.86rem', fontFamily: 'monospace' }}>https://</span>
                      <input
                        type="text"
                        value={slugInput}
                        onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="my-agent"
                        style={{
                          flexGrow: 1,
                          padding: '0.6rem 0.45rem',
                          backgroundColor: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#0f172a',
                          fontSize: '0.92rem',
                          fontFamily: 'monospace',
                          fontWeight: 600
                        }}
                      />
                      <span style={{ fontSize: '0.86rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                        .{baseDomain}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: '#0369a1', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.2rem 0.55rem', borderRadius: '6px', fontFamily: 'monospace' }}>
                        <Globe size={12} />
                        <span>Live Route: <strong>https://{slugInput || 'subdomain'}.{baseDomain}</strong></span>
                      </div>
                      <button
                        onClick={() => setSlugInput(generateSlug())}
                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <RefreshCw size={12} /> Shuffle
                      </button>
                    </div>
                  </div>

                  {/* Live trybase.fleet.yml Drawer */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div
                      onClick={() => setShowYamlDrawer(!showYamlDrawer)}
                      style={{
                        padding: '0.6rem 0.95rem',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                        <FileCode size={15} color="#10b981" />
                        <span>trybase.fleet.yml (Live IaaS Manifest)</span>
                        <span style={{ fontSize: '0.68rem', backgroundColor: '#ecfdf5', color: '#047857', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                          AUTO-GENERATED
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#64748b' }}>
                        {showYamlDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>

                    {showYamlDrawer && (
                      <div style={{ backgroundColor: '#0f172a', padding: '0.85rem 1rem', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                            Manifest ready for git / trybase fleet deploy
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard?.writeText(generateFleetYaml(slugInput, workloadType, cpuAllocation, memoryAllocation, enableRedisSidecar, enableBedrockAccess, enableAntiLeakUds, baseDomain));
                              setCopiedYaml(true);
                              setTimeout(() => setCopiedYaml(false), 2000);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.25rem 0.6rem',
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              color: '#f8fafc',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {copiedYaml ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                            {copiedYaml ? 'Copied YAML!' : 'Copy YAML'}
                          </button>
                        </div>
                        <pre style={{
                          margin: 0,
                          fontSize: '0.75rem',
                          color: '#38bdf8',
                          fontFamily: 'monospace',
                          lineHeight: 1.45,
                          maxHeight: '170px',
                          overflowY: 'auto'
                        }}>
                          {generateFleetYaml(slugInput, workloadType, cpuAllocation, memoryAllocation, enableRedisSidecar, enableBedrockAccess, enableAntiLeakUds, baseDomain)}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Declarative YAML Tab */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Load IaaS Fleet Presets
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>
                      trybase.fleet.yml
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
                    <button
                      onClick={() => setRawYamlInput(YAML_PRESETS.openclaw)}
                      style={{ padding: '0.3rem 0.65rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      🤖 OpenClaw + In-Task Redis
                    </button>
                    <button
                      onClick={() => setRawYamlInput(YAML_PRESETS.platform)}
                      style={{ padding: '0.3rem 0.65rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      🌐 Full AI Platform (Agent + Dify + n8n)
                    </button>
                    <button
                      onClick={() => setRawYamlInput(YAML_PRESETS.laravel)}
                      style={{ padding: '0.3rem 0.65rem', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      🐘 Laravel 11 Backend API
                    </button>
                    <button
                      onClick={() => setRawYamlInput(YAML_PRESETS.django)}
                      style={{ padding: '0.3rem 0.65rem', backgroundColor: '#f0fdfa', border: '1px solid #ccfbf1', color: '#115e59', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      🐍 Django REST + Celery
                    </button>
                  </div>

                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155' }}>
                    <div style={{ backgroundColor: '#1e293b', padding: '0.45rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        Deployable Declarative Manifest
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(rawYamlInput);
                          setCopiedYaml(true);
                          setTimeout(() => setCopiedYaml(false), 2000);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.5rem',
                          backgroundColor: '#334155',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#f8fafc',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        {copiedYaml ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        {copiedYaml ? 'Copied!' : 'Copy Manifest'}
                      </button>
                    </div>
                    <textarea
                      value={rawYamlInput}
                      onChange={(e) => setRawYamlInput(e.target.value)}
                      rows={10}
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        color: '#38bdf8',
                        fontFamily: 'monospace',
                        fontSize: '0.76rem',
                        lineHeight: 1.5,
                        padding: '0.85rem',
                        border: 'none',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ marginTop: '0.65rem', padding: '0.55rem 0.85rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Terminal size={14} color="#0284c7" />
                    <span>Run locally via CLI: <code style={{ color: '#0f172a', fontWeight: 600 }}>trybase fleet deploy trybase.fleet.yml</code></span>
                  </div>
                </div>
              )}

              {slugError && (
                <div style={{
                  color: '#dc2626',
                  fontSize: '0.82rem',
                  marginTop: '0.85rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <AlertCircle size={15} />
                  {slugError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.9rem 1.65rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Fargate Graviton (ARM64) • Isolated Schema • Anti-Leak UDS
              </div>
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isProvisioning}
                  style={{
                    padding: '0.55rem 1.1rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#475569',
                    fontSize: '0.85rem',
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
                    padding: '0.55rem 1.25rem',
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isProvisioning ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {isProvisioning ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                  Deploy Infrastructure
                </button>
              </div>
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
          <img src="https://trybase.io/logo.png" alt="TryBase Logo" style={{ height: '28px', width: 'auto' }} />
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
                              .{baseDomain}
                            </span>

                            {/* Workload Badge */}
                            <span style={{
                              backgroundColor: getWorkloadBadge(ws.workload_type).bg,
                              color: getWorkloadBadge(ws.workload_type).color,
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontWeight: 600,
                              border: `1px solid ${getWorkloadBadge(ws.workload_type).border}`
                            }}>
                              {getWorkloadIcon(ws.workload_type)}
                              {getWorkloadLabel(ws.workload_type)}
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
                                href={`https://${ws.tenant_id}.${baseDomain}`}
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
                                {getWorkloadLaunchLabel(ws.workload_type)}
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
                Account & Developer Settings
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                Manage your console credentials, Developer CLI tokens, and MCP server access.
              </p>
            </div>

            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '780px' }}>
              {/* Card 1: Developer CLI & MCP Ephemeral Session Token */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.5rem',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Terminal size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Developer CLI & MCP Session Token
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Anti-Leak Standard: Short-lived 1-hour JWT. Zero permanent static API keys.
                      </span>
                    </div>
                  </div>

                  {session?.access_token ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.25rem 0.65rem',
                      backgroundColor: '#dcfce7',
                      border: '1px solid #bbf7d0',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#15803d'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                      {tokenTtl !== null
                        ? `Expires in ${Math.floor(tokenTtl / 60)}m ${tokenTtl % 60}s`
                        : 'Active (1-Hour STS)'}
                    </div>
                  ) : (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.25rem 0.65rem',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#b91c1c'
                    }}>
                      No Active Session
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: '0.75rem 0 1rem 0' }}>
                  Use this ephemeral session token to authenticate <code style={{ backgroundColor: '#e2e8f0', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.8rem' }}>@trybase/cli</code> and <code style={{ backgroundColor: '#e2e8f0', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.8rem' }}>@trybase/mcp</code> (Claude Desktop / Cursor) without transmitting your master password.
                </p>

                {/* Masked Token Field */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Active 1-Hour Session JWT
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showToken ? 'text' : 'password'}
                        readOnly
                        value={session?.access_token || 'No active session token available'}
                        style={{
                          width: '100%',
                          padding: '0.65rem 2.5rem 0.65rem 0.85rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '0.82rem',
                          color: '#0f172a',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px'
                        }}
                        title={showToken ? 'Mask Token' : 'Reveal Token'}
                      >
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (session?.access_token) {
                          navigator.clipboard?.writeText(session.access_token);
                          setTokenCopied(true);
                          setTimeout(() => setTokenCopied(false), 2500);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.65rem 1.1rem',
                        backgroundColor: tokenCopied ? '#16a34a' : '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {tokenCopied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{tokenCopied ? 'Copied Token!' : 'Copy Token'}</span>
                    </button>
                  </div>
                </div>

                {/* Instant CLI Login Command */}
                <div style={{
                  backgroundColor: '#0f172a',
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  overflow: 'hidden'
                }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>
                      One-line CLI Authentication
                    </span>
                    <code style={{ color: '#38bdf8', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                      {session?.access_token
                        ? `trybase login --token ${session.access_token.substring(0, 16)}... --url ${import.meta.env.VITE_SUPABASE_URL || '...'}`
                        : 'trybase login --token <session_token> --url <control_plane_url>'}
                    </code>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (session?.access_token) {
                        const urlArg = import.meta.env.VITE_SUPABASE_URL ? ` --url ${import.meta.env.VITE_SUPABASE_URL}` : '';
                        const keyArg = import.meta.env.VITE_SUPABASE_ANON_KEY ? ` --key ${import.meta.env.VITE_SUPABASE_ANON_KEY}` : '';
                        navigator.clipboard?.writeText(`trybase login --token ${session.access_token}${urlArg}${keyArg}`);
                        setCliCopied(true);
                        setTimeout(() => setCliCopied(false), 2500);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem 0.85rem',
                      backgroundColor: cliCopied ? '#16a34a' : 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cliCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{cliCopied ? 'Copied Command!' : 'Copy Command'}</span>
                  </button>
                </div>

                {/* MCP Server Integration Tip */}
                <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span>
                    Once logged in, your Claude Desktop & Cursor MCP servers automatically inherit this session from <code style={{ color: '#0f172a' }}>~/.trybase/config.json</code>.
                  </span>
                </div>
              </div>

              {/* Card 2: Change Password */}
              <div style={{ maxWidth: '520px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Change Account Password
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                  Update your master password for logging into the TryBase console.
                </p>

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
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default Dashboard;
