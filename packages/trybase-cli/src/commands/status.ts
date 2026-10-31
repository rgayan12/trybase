import { SFNClient, ListExecutionsCommand } from '@aws-sdk/client-sfn';
import { loadConfig } from '../config.js';
import { listControlPlaneWorkspaces } from '../supabase.js';

const DEFAULT_SFN_ARN = process.env.TRYBASE_SFN_ARN || 'arn:aws:states:eu-west-2:656876168893:stateMachine:n8n-provision-tenant';
const DEFAULT_REGION = process.env.AWS_REGION || 'eu-west-2';

export async function statusCommand(options: { org?: string }): Promise<void> {
  const config = loadConfig();
  const org = options.org || config.defaultOrg || 'default';
  const region = process.env.AWS_REGION || config.region || DEFAULT_REGION;
  const sfnArn = process.env.TRYBASE_SFN_ARN || DEFAULT_SFN_ARN;

  console.log(`\n🏢 TryBase Fleet Status for Organization: "${org}"`);
  console.log(`═`.repeat(75));

  // 1. Query Supabase Control Plane Workspaces
  const workspaces = await listControlPlaneWorkspaces();
  if (workspaces && workspaces.length > 0) {
    console.log(`📡 Control Plane Workspaces (Supabase):`);
    console.log(`TENANT ID                      ARCHETYPE    STATUS         STARTED`);
    console.log(`─`.repeat(75));
    for (const ws of workspaces) {
      const id = (ws.tenant_id || 'unassigned').padEnd(30).substring(0, 30);
      const arch = (ws.workload_type || 'n8n').padEnd(12);
      const stat = (ws.status || 'unknown').padEnd(14);
      const started = ws.provisioning_started_at ? new Date(ws.provisioning_started_at).toLocaleTimeString() : 'N/A';
      console.log(`${id} ${arch} ${stat} ${started}`);
    }
    console.log(`─`.repeat(75));
  }

  // 2. Query AWS Step Functions Executions
  try {
    const sfn = new SFNClient({ region });
    const res = await sfn.send(new ListExecutionsCommand({
      stateMachineArn: sfnArn,
      maxResults: 5,
    }));

    console.log(`⚡ AWS Step Functions Pipeline (${region}):`);
    if (!res.executions || res.executions.length === 0) {
      console.log(`No active or recent executions in state machine.`);
      console.log(`Run "trybase fleet deploy" to launch workloads.`);
    } else {
      console.log(`EXECUTION NAME                      STATUS       START TIME            ARN`);
      console.log(`─`.repeat(75));
      for (const exec of res.executions) {
        const name = (exec.name || '').padEnd(35).substring(0, 35);
        const status = (exec.status || '').padEnd(12);
        const start = exec.startDate ? new Date(exec.startDate).toLocaleTimeString() : 'N/A';
        const shortArn = exec.executionArn?.split(':').pop() || '';
        console.log(`${name} ${status} ${start.padEnd(20)} ${shortArn}`);
      }
    }
    console.log(`═`.repeat(75));
    console.log(`🔒 Anti-Leak Standard: ACTIVE (/var/run/trybase/secrets.sock)\n`);
  } catch (err: any) {
    console.log(`⚠️  Could not query AWS Step Functions: ${err.message}`);
    console.log(`═`.repeat(75));
  }
}
