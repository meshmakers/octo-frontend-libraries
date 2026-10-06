import { AdapterOnlineFields } from './adapter-online';

/**
 * One tenant as every adapter counter sees it (Home KPI, Integration overview chip and filter,
 * pool detail). The expected answer for all of them: 2 online of 4 expected to run, 1 resting,
 * 1 offline, 2 not expected.
 */
export const ADAPTER_ONLINE_FIXTURE: (AdapterOnlineFields & { rtId: string; name: string })[] = [
  { rtId: 'a-mesh', name: 'mesh-adapter', communicationState: 'ONLINE', deploymentState: 'DEPLOYED', lifecycleState: 'RUNNING' },
  // Edge / locally run: no Helm deployment, online.
  { rtId: 'a-edge', name: 'edge-adapter', communicationState: 'ONLINE', deploymentState: 'UNDEPLOYED', lifecycleState: 'RUNNING' },
  // On-demand at rest.
  { rtId: 'a-plc', name: 'edge-plc-07', communicationState: 'OFFLINE', deploymentState: 'DEPLOYED', lifecycleState: 'HIBERNATED' },
  // Failed deployment: expected to run, offline.
  { rtId: 'a-fin', name: 'finapi-adapter', communicationState: 'OFFLINE', deploymentState: 'ERROR', lifecycleState: 'RUNNING' },
  // Not expected: undeployed and never connected / offline.
  { rtId: 'a-loose', name: 'local-dev', communicationState: 'UNREGISTERED', deploymentState: 'UNDEPLOYED', lifecycleState: 'RUNNING' },
  { rtId: 'a-old', name: 'retired', communicationState: 'OFFLINE', deploymentState: 'UNDEPLOYED', lifecycleState: 'RUNNING' },
];
