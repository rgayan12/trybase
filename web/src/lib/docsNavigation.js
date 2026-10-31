import { 
  BookOpen, Shield, Zap, Layers, Lock, Cpu, Cloud, Database, 
  Bot, Terminal, Activity, FileText, CheckCircle2, GitBranch, Key, RefreshCw, Server
} from 'lucide-react';

export const DOCS_NAV = [
  {
    group: 'Prologue',
    items: [
      { id: 'prologue/manifesto', title: 'Architecture Manifesto', path: 'prologue/manifesto.md', icon: BookOpen },
      { id: 'prologue/virtual-single-tenancy', title: 'Virtual Single-Tenancy', path: 'prologue/virtual-single-tenancy.md', icon: Server },
      { id: 'prologue/anti-leak-standard', title: 'The Anti-Leak Standard', path: 'prologue/anti-leak-standard.md', icon: Shield },
      { id: 'prologue/comparative-analysis', title: 'TryBase vs Traditional PaaS', path: 'prologue/comparative-analysis.md', icon: Layers }
    ]
  },
  {
    group: 'Getting Started',
    items: [
      { id: 'getting-started/installation', title: 'Installation & Prerequisites', path: 'getting-started/installation.md', icon: Terminal },
      { id: 'getting-started/configuration', title: 'Environment Configuration', path: 'getting-started/configuration.md', icon: FileText },
      { id: 'getting-started/finops-audit', title: 'Pre-Deploy FinOps Audit', path: 'getting-started/finops-audit.md', icon: Activity },
      { id: 'getting-started/deployment', title: 'Fleet Deployment', path: 'getting-started/deployment.md', icon: Zap },
      { id: 'getting-started/quickstart', title: 'Quickstart: First Workload', path: 'getting-started/quickstart.md', icon: CheckCircle2 }
    ]
  },
  {
    group: 'Core Architecture',
    items: [
      { id: 'architecture/topology', title: 'Hyperscaler Topology', path: 'architecture/topology.md', icon: Layers },
      { id: 'architecture/networking', title: 'Private VPC & Network Boundaries', path: 'architecture/networking.md', icon: Cloud },
      { id: 'architecture/fargate-microvms', title: 'Fargate Graviton MicroVMs', path: 'architecture/fargate-microvms.md', icon: Cpu },
      { id: 'architecture/alb-routing', title: 'ALB & Wildcard TLS Ingress', path: 'architecture/alb-routing.md', icon: Cloud },
      { id: 'architecture/pgvector', title: 'Vector Memory & pgvector', path: 'architecture/pgvector.md', icon: Database },
      { id: 'architecture/redis-sidecar', title: 'In-Task Redis Sidecar Pattern', path: 'architecture/redis-sidecar.md', icon: RefreshCw }
    ]
  },
  {
    group: 'Security & Zero-Trust',
    items: [
      { id: 'security/keyless-sts', title: 'Keyless STS Authentication', path: 'security/keyless-sts.md', icon: Lock },
      { id: 'security/unix-sockets', title: 'Unix Sockets & SO_PEERCRED', path: 'security/unix-sockets.md', icon: Shield },
      { id: 'security/rds-iam-auth', title: 'Passwordless RDS IAM Auth', path: 'security/rds-iam-auth.md', icon: Key },
      { id: 'security/database-isolation', title: 'Scoped Tenant DB Isolation', path: 'security/database-isolation.md', icon: Database },
      { id: 'security/iam-task-roles', title: 'Per-Tenant IAM Task Roles', path: 'security/iam-task-roles.md', icon: Shield }
    ]
  },
  {
    group: 'Workload Adapters',
    items: [
      { id: 'adapters/specification', title: 'Adapter Specification', path: 'adapters/specification.md', icon: FileText },
      { id: 'adapters/python-agent', title: 'Custom Agent: Python & FastAPI', path: 'adapters/python-agent.md', icon: Bot },
      { id: 'adapters/typescript-agent', title: 'Custom Agent: TypeScript & Node', path: 'adapters/typescript-agent.md', icon: Terminal },
      { id: 'adapters/dify', title: 'Adapter: Dify AI Studio', path: 'adapters/dify.md', icon: Bot },
      { id: 'adapters/n8n', title: 'Adapter: n8n Automation', path: 'adapters/n8n.md', icon: Zap },
      { id: 'adapters/authoring', title: 'Authoring a New Adapter', path: 'adapters/authoring.md', icon: GitBranch }
    ]
  },
  {
    group: 'FinOps & Governance',
    items: [
      { id: 'finops/infracost', title: 'Infracost Auditing', path: 'finops/infracost.md', icon: Activity },
      { id: 'finops/run-rate', title: 'Baseline Cloud Run-Rate', path: 'finops/run-rate.md', icon: Activity },
      { id: 'finops/scale-to-zero', title: 'Scale-to-Zero Architecture', path: 'finops/scale-to-zero.md', icon: RefreshCw }
    ]
  },
  {
    group: 'Operations & Control Plane',
    items: [
      { id: 'control-plane/fleet-manifest', title: 'Declarative Fleet Manifests', path: 'control-plane/fleet-manifest.md', icon: Layers },
      { id: 'control-plane/api', title: 'Provisioning REST API', path: 'control-plane/api.md', icon: Server },
      { id: 'control-plane/step-functions', title: 'Step Functions Orchestrator', path: 'control-plane/step-functions.md', icon: Layers },
      { id: 'control-plane/database', title: 'Database Schema & Realtime', path: 'control-plane/database.md', icon: Database },
      { id: 'control-plane/cli', title: 'Makefile & CLI Cheatsheet', path: 'control-plane/cli.md', icon: Terminal }
    ]
  }
];

// Helper to get flat list for next/previous navigation
export const ALL_DOC_ITEMS = DOCS_NAV.flatMap(group => 
  group.items.map(item => ({ ...item, group: group.group }))
);

export const getAdjacentDocs = (currentId) => {
  const index = ALL_DOC_ITEMS.findIndex(item => item.id === currentId);
  if (index === -1) {
    return { prev: null, next: ALL_DOC_ITEMS[0] };
  }
  return {
    prev: index > 0 ? ALL_DOC_ITEMS[index - 1] : null,
    next: index < ALL_DOC_ITEMS.length - 1 ? ALL_DOC_ITEMS[index + 1] : null
  };
};
