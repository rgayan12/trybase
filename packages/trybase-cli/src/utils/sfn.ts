import { SFNClient, ListStateMachinesCommand } from '@aws-sdk/client-sfn';
import { loadConfig } from '../config.js';

export async function resolveStepFunctionArn(region?: string): Promise<string> {
  const config = loadConfig();
  const targetRegion = region || process.env.AWS_REGION || config.region || 'eu-west-2';

  if (process.env.TRYBASE_SFN_ARN) {
    return process.env.TRYBASE_SFN_ARN;
  }

  const client = new SFNClient({ region: targetRegion });
  try {
    const res = await client.send(new ListStateMachinesCommand({ maxResults: 50 }));
    const match = res.stateMachines?.find(
      (sm) => sm.name?.includes('provision') || sm.name?.includes('trybase')
    );
    if (match?.stateMachineArn) {
      return match.stateMachineArn;
    }
  } catch {
    // Fall through to error
  }

  throw new Error(
    `Could not automatically locate the TryBase provisioning Step Function in region ${targetRegion}. Set TRYBASE_SFN_ARN or deploy fleet infrastructure.`
  );
}
