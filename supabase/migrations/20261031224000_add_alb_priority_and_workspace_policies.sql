-- Migration: 20261031224000_add_alb_priority_and_workspace_policies.sql
-- Description: Add alb_listener_rule_priority and provisioned_at to workspaces, and configure full RLS policies

-- 1. Add missing columns to workspaces table
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS alb_listener_rule_priority INTEGER;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP WITH TIME ZONE;

-- 2. Index for fast priority lookup
CREATE INDEX IF NOT EXISTS idx_workspaces_alb_priority ON workspaces(alb_listener_rule_priority);

-- 3. Row Level Security: Allow users to create, update, and delete their own workspaces
DROP POLICY IF EXISTS "Users can insert their own workspaces" ON workspaces;
CREATE POLICY "Users can insert their own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own workspaces" ON workspaces;
CREATE POLICY "Users can update their own workspaces"
  ON workspaces FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own workspaces" ON workspaces;
CREATE POLICY "Users can delete their own workspaces"
  ON workspaces FOR DELETE
  USING (auth.uid() = user_id);
