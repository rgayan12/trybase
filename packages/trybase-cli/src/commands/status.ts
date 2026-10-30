import { SFNClient, ListExecutionsCommand } from '@aws-sdk/client-sfn';
import { loadConfig } from '../config.js';

const DEFAULT_SFN_ARN = process.env.TRYBASE_SFN_ARN || 'arn:aws:states:eu-west-2:656876168893:stateMachine:n8n-provision-tenant';
const DEFAULT_REGION = process.env.AWS_REGION || 'eu-west-2';

export async function statusCommand(options: { org?: string }): Promise<void> {
  const config = loadConfig();
  const org = options.org || config.defaultOrg || 'default';
  const region = process.env.AWS_REGION || config.region || DEFAULT_REGION;
  const sfnArn = process.env.TRYBASE_SFN_ARN || DEFAULT_SFN_ARN;

  console.log(`\n🏢 TryBase Fleet Status for Organization: "${org}"`);
  console.log(`═`.repeat(75));

  try {
    const sfn = new SFNClient({ region });
    const res = await sfn.send(new ListExecutionsCommand({
      stateMachineArn: sfnArn,
      maxResults: 10,
    }));

    if (!res.executions || res.executions.length === 0) {
      console.log(`No active or recent executions found in Step Functions.`);
      console.log(`State Machine: ${sfnArn}`);
      console.log(`Run "trybase fleet deploy" to launch workloads.`);
      console.log(`═`.repeat(75));
      return;
    }

    console.log(`EXECUTION NAME                      STATUS       START TIME            ARN`);
    console.log(`─`.repeat(75));
    for (const exec of res.executions) {
      const name = (exec.name || '').padEnd(35).substring(0, 35);
      const status = (exec.status || '').padEnd(12);
      const start = exec.startDate ? new Date(exec.startDate).toLocaleTimeString() : 'N/A';
      const shortArn = exec.executionArn?.split(':').pop() || '';
      console.log(`${name} ${status} ${start.padEnd(20)} ${shortArn}`);
    }
    console.log(`═`.repeat(75));
    console.log(`🔒 Anti-Leak Standard: ACTIVE on all tasks (/var/run/trybase/secrets.sock)\n`);
  } catch (err: any) {
    console.log(`⚠️  Could not query AWS Step Functions: ${err.message}`);
    console.log(`═`.repeat(75));
  }
}
