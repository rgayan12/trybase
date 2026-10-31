-- Migration: 20260428000000_create_organizations_and_workloads.sql
-- Description: Evolve single-tenant workspaces into an Organization & Multi-Workload Fleet architecture

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    plan_tier VARCHAR(50) DEFAULT 'pro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Organization Memberships table (for team access)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE (org_id, user_id)
);

-- 3. Workloads table (multiple workloads per organization: n8n, dify, bedrock-agent, openclaw, custom)
CREATE TABLE IF NOT EXISTS workloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    archetype VARCHAR(50) NOT NULL DEFAULT 'n8n', -- 'n8n', 'dify', 'openclaw', 'bedrock-agent', 'custom'
    subdomain VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'unprovisioned', -- 'unprovisioned', 'provisioning', 'active', 'suspended', 'failed'
    database_schema VARCHAR(100),
    cpu INTEGER DEFAULT 256,
    memory INTEGER DEFAULT 512,
    task_arn VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE (org_id, slug)
);

-- 4. API Keys table (scoped organization access for Developer CLI & MCP Agents)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL, -- e.g. "tb_live_..."
    key_hash VARCHAR(255) NOT NULL, -- SHA-256 hash of secret token
    scopes TEXT[] DEFAULT ARRAY['fleet:read', 'fleet:deploy', 'workloads:exec', 'secrets:push'],
    created_by UUID REFERENCES auth.users(id),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Organizations
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = organizations.id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their organization"
  ON organizations FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- RLS Policies for Organization Members
CREATE POLICY "Members can view memberships in their organization"
  ON organization_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organizations AS o
      WHERE o.id = organization_members.org_id
        AND o.owner_id = auth.uid()
    )
  );

-- RLS Policies for Workloads
CREATE POLICY "Users can view workloads of their organizations"
  ON workloads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organizations AS o
      WHERE o.id = workloads.org_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM organization_members AS m
          WHERE m.org_id = o.id AND m.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admins and owners can modify workloads"
  ON workloads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organizations AS o
      WHERE o.id = workloads.org_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM organization_members AS m
          WHERE m.org_id = o.id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
        )
      )
    )
  );

-- RLS Policies for API Keys
CREATE POLICY "Users can view API keys for their organizations"
  ON api_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organizations AS o
      WHERE o.id = api_keys.org_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM organization_members AS m
          WHERE m.org_id = o.id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
        )
      )
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_workloads_org_id ON workloads(org_id);
CREATE INDEX IF NOT EXISTS idx_workloads_subdomain ON workloads(subdomain);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
