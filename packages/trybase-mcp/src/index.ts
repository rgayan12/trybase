#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  InfrastructureProvider,
  MockInfrastructureProvider,
  AWSInfrastructureProvider,
} from './provider.js';
import { TOOLS, PROMPTS, handleToolCall } from './tools.js';

async function main() {
  // Determine execution mode (mock vs AWS)
  const mode = process.env.TRYBASE_MODE || (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID ? 'aws' : 'mock');
  
  const provider: InfrastructureProvider = mode === 'aws'
    ? new AWSInfrastructureProvider()
    : new MockInfrastructureProvider();

  console.error(`🚀 [TryBase MCP] Initializing server in '${mode.toUpperCase()}' mode...`);

  const server = new Server(
    {
      name: '@trybase/mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // 1. Tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // 2. Tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(provider, name, args || {});
  });

  // 3. Prompt listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: PROMPTS };
  });

  // 4. Prompt retrieval
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'trybase_autonomous_sre') {
      const target = args?.targetTenant ? `specifically focusing on tenant '${args.targetTenant}'` : 'auditing the entire cluster';
      return {
        description: 'Autonomous SRE Incident Diagnosis & Self-Healing Workflow',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are the TryBase Autonomous SRE. Your mission is ${target}:

1. Run 'trybase_list_workloads' to inspect all active tenants, memory consumption, and health status.
2. If any tenant is in DEGRADED or UNHEALTHY status (or memory exceeds 80%), investigate immediately.
3. Call 'trybase_get_container_logs' for that tenant with filter "ERROR" or "OOM" to find root cause.
4. Safeguard data by taking a preventative snapshot with 'trybase_create_backup'.
5. Autonomously remediate the resource constraint by calling 'trybase_scale_workload' (e.g. increase RAM from 1024MB to 2048MB).
6. Verify resolution by checking workload status or calling 'trybase_restart_workload'.
7. Provide a concise post-incident summary with root cause and actions taken.`,
            },
          },
        ],
      };
    }

    if (name === 'trybase_fleet_deploy') {
      const tag = args?.imageTag || 'latest';
      return {
        description: 'Multi-Tenant Fleet Migration and Rolling Deployment Workflow',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are deploying container image tag '${tag}' across the TryBase multi-tenant fleet:

1. List all running workloads using 'trybase_list_workloads'.
2. Select Ring 0 (canary / internal tenant).
3. Run database migrations on Ring 0 using 'trybase_run_migration'.
4. If migration succeeds on Ring 0, proceed to Ring 1 (customer fleet).
5. For each tenant, execute 'trybase_run_migration' followed by verified health checking.
6. If any individual tenant migration encounters an error, halt that tenant, preserve blast-radius isolation, and report.`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('✅ [TryBase MCP] Server connected to stdio transport and ready for tool invocations.');
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
