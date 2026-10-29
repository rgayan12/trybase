export type WorkloadArchetype = 
  | 'laravel' 
  | 'django' 
  | 'n8n' 
  | 'agent' 
  | 'openclaw'
  | 'bedrock-agent'
  | 'dify' 
  | 'custom';

export type WorkloadStatus = 
  | 'PROVISIONING' 
  | 'HEALTHY' 
  | 'DEGRADED' 
  | 'UNHEALTHY' 
  | 'STOPPED' 
  | 'FAILED';

export interface WorkloadResources {
  cpu: number;      // e.g. 256, 512, 1024, 2048
  memory: number;   // e.g. 512, 1024, 2048, 4096
}

export interface WorkloadMetrics {
  cpuUtilizationPercent: number;
  memoryUtilizationPercent: number;
  p95LatencyMs: number;
  requestCount24h: number;
}

export interface Workload {
  tenantId: string;
  organizationId?: string;
  subdomain: string;
  archetype: WorkloadArchetype;
  status: WorkloadStatus;
  endpointUrl: string;
  imageTag: string;
  resources: WorkloadResources;
  metrics?: WorkloadMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface FleetWorkloadSpec {
  name: string;
  subdomain: string;
  archetype: WorkloadArchetype;
  imageTag?: string;
  cpu?: number;
  memory?: number;
  secrets?: Record<string, string>;
}

export interface DeployFleetInput {
  organizationId: string;
  workloads: FleetWorkloadSpec[];
}

export interface DeployFleetResult {
  organizationId: string;
  deployedWorkloads: Array<{
    name: string;
    subdomain: string;
    archetype: WorkloadArchetype;
    status: string;
    endpointUrl: string;
  }>;
  status: string;
  message: string;
}

export interface DeployWorkloadInput {
  tenantId: string;
  subdomain: string;
  archetype: WorkloadArchetype;
  imageTag?: string;
  cpu?: number;
  memory?: number;
  secrets?: Record<string, string>;
}

export interface ScaleWorkloadInput {
  tenantId: string;
  cpu: number;
  memory: number;
}

export interface LogEvent {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  stream: string;
}

export interface BackupResult {
  tenantId: string;
  backupId: string;
  s3Uri: string;
  sizeBytes: number;
  createdAt: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
}

export interface MigrationResult {
  tenantId: string;
  command: string;
  exitCode: number;
  output: string;
  durationMs: number;
  appliedMigrations: string[];
}

export interface ExecCommandInput {
  tenantId: string;
  command: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface ExecCommandResult {
  tenantId: string;
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timestamp: string;
}

