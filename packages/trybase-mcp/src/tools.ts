import { InfrastructureProvider } from './provider.js';

export const TOOLS = [
  {
    name: 'trybase_list_workloads',
    description: 'List all running tenant workloads across the TryBase cluster with health status, archetypes (laravel, django, n8n, agent, dify), resource allocations, and real-time metrics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'trybase_deploy_workload',
    description: 'Dispatch asynchronous Step Functions provisioning to spin up an isolated tenant Firecracker microVM with dedicated PostgreSQL schema and Anti-Leak secret isolation.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Unique identifier for the tenant (e.g. acme-corp, my-app)',
        },
        subdomain: {
          type: 'string',
          description: 'Subdomain for the tenant route (e.g. acme -> https://acme.trybase.io)',
        },
        archetype: {
          type: 'string',
          enum: ['laravel', 'django', 'n8n', 'agent', 'dify', 'custom'],
          description: 'Application framework archetype',
        },
        imageTag: {
          type: 'string',
          description: 'Optional container image tag from ECR or Docker Hub',
        },
        cpu: {
          type: 'number',
          description: 'vCPU units (256, 512, 1024, 2048)',
          default: 512,
        },
        memory: {
          type: 'number',
          description: 'RAM in megabytes (512, 1024, 2048, 4096)',
          default: 1024,
        },
        secrets: {
          type: 'object',
          description: 'Key-value map of initial environment secrets (written to AWS Secrets Manager)',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['tenantId', 'subdomain', 'archetype'],
    },
  },
  {
    name: 'trybase_get_container_logs',
    description: 'Fetch recent stdout and stderr log events from CloudWatch Logs for a tenant container, with optional regex/text filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID to fetch logs for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log entries to retrieve (default: 50)',
          default: 50,
        },
        filter: {
          type: 'string',
          description: 'Optional text pattern to filter logs (e.g. "ERROR", "OOM", "500")',
        },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'trybase_scale_workload',
    description: 'Dynamically scale container CPU and memory allocation with zero-downtime rolling deployment.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID to scale',
        },
        cpu: {
          type: 'number',
          description: 'New vCPU units (256, 512, 1024, 2048, 4096)',
        },
        memory: {
          type: 'number',
          description: 'New RAM in megabytes (512, 1024, 2048, 4096, 8192)',
        },
      },
      required: ['tenantId', 'cpu', 'memory'],
    },
  },
  {
    name: 'trybase_restart_workload',
    description: 'Restart an unhealthy or stalled tenant container service with force-new-deployment and verify healthcheck.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID to restart',
        },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'trybase_create_backup',
    description: 'Trigger an on-demand S3 logical backup (pg_dump) of the tenant isolated PostgreSQL database schema.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID to backup',
        },
        label: {
          type: 'string',
          description: 'Optional human-readable label or description for the snapshot',
        },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'trybase_set_secrets',
    description: 'Push encrypted secrets directly to a tenant dedicated AWS Secrets Manager vault without writing to disk or .env files.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID to update secrets for',
        },
        secrets: {
          type: 'object',
          description: 'Key-value map of secret strings to store',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['tenantId', 'secrets'],
    },
  },
  {
    name: 'trybase_run_migration',
    description: 'Run an isolated schema migration (php artisan migrate / python manage.py migrate) in an ephemeral container task scoped to schema_<tenant_id>.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID whose database schema should be migrated',
        },
        command: {
          type: 'string',
          description: 'Optional custom migration command (defaults to archetype native command)',
        },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'trybase_exec_command',
    description: 'Execute an interactive shell command inside the tenant isolated microVM sandbox and return stdout, stderr, and exit code.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID whose sandbox container should execute the command',
        },
        command: {
          type: 'string',
          description: 'Shell command to execute (e.g. "ls -la", "pytest", "npm test", "python script.py")',
        },
        cwd: {
          type: 'string',
          description: 'Optional working directory inside the container (default: /workspace or /var/www/html)',
        },
        timeoutMs: {
          type: 'number',
          description: 'Maximum time to wait in milliseconds (default: 30000)',
          default: 30000,
        },
      },
      required: ['tenantId', 'command'],
    },
  },
];

export const PROMPTS = [
  {
    name: 'trybase_autonomous_sre',
    description: 'Analyze TryBase cluster health, diagnose degraded workloads, take preventative backups, scale resources to heal OOM conditions, and report status.',
    arguments: [
      {
        name: 'targetTenant',
        description: 'Optional specific tenant ID to investigate (leave blank to audit entire cluster)',
        required: false,
      },
    ],
  },
  {
    name: 'trybase_fleet_deploy',
    description: 'Orchestrate a rolling deployment and schema migration across a fleet of tenants in canary rings.',
    arguments: [
      {
        name: 'imageTag',
        description: 'New container image tag to deploy across the fleet',
        required: true,
      },
    ],
  },
];

export async function handleToolCall(
  provider: InfrastructureProvider,
  name: string,
  args: any
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'trybase_list_workloads': {
        const workloads = await provider.listWorkloads();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(workloads, null, 2),
            },
          ],
        };
      }

      case 'trybase_deploy_workload': {
        const res = await provider.deployWorkload({
          tenantId: args.tenantId,
          subdomain: args.subdomain,
          archetype: args.archetype,
          imageTag: args.imageTag,
          cpu: args.cpu,
          memory: args.memory,
          secrets: args.secrets,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      case 'trybase_get_container_logs': {
        const logs = await provider.getLogs(args.tenantId, args.limit, args.filter);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(logs, null, 2),
            },
          ],
        };
      }

      case 'trybase_scale_workload': {
        const res = await provider.scaleWorkload({
          tenantId: args.tenantId,
          cpu: args.cpu,
          memory: args.memory,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      case 'trybase_restart_workload': {
        const res = await provider.restartWorkload(args.tenantId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      case 'trybase_create_backup': {
        const res = await provider.createBackup(args.tenantId, args.label);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      case 'trybase_set_secrets': {
        const res = await provider.setSecrets(args.tenantId, args.secrets);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      case 'trybase_run_migration': {
        const res = await provider.runMigration(args.tenantId, args.command);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      case 'trybase_exec_command': {
        const res = await provider.execCommand({
          tenantId: args.tenantId,
          command: args.command,
          cwd: args.cwd,
          timeoutMs: args.timeoutMs,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      default:
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Tool execution failed: ${error?.message || String(error)}`,
        },
      ],
    };
  }
}
