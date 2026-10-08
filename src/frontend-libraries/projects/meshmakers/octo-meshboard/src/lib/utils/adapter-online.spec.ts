import { ADAPTER_ONLINE_FIXTURE } from './adapter-online.fixtures';
import { isAdapterAtRest, isAdapterExpectedToRun, isAdapterOnline, summarizeAdapterOnline } from './adapter-online';

describe('adapter online rule', () => {
  it('summarizes the shared fixture', () => {
    expect(summarizeAdapterOnline(ADAPTER_ONLINE_FIXTURE)).toEqual({ online: 2, expected: 4, total: 6, resting: 1, offline: 1 });
  });

  it('online = connected, regardless of case', () => {
    expect(isAdapterOnline({ communicationState: 'online' })).toBe(true);
    expect(isAdapterOnline({ communicationState: 'OFFLINE' })).toBe(false);
    expect(isAdapterOnline({})).toBe(false);
  });

  it.each([
    ['DEPLOYED', 'OFFLINE', true],
    ['PENDING', 'OFFLINE', true],
    ['ERROR', 'OFFLINE', true],
    ['UNDEPLOYED', 'ONLINE', true],
    ['DISABLED', 'OFFLINE', true],
    ['DISABLED', 'UNREGISTERED', false],
    ['UNDEPLOYED', 'OFFLINE', false],
    ['UNDEPLOYED', 'UNREGISTERED', false],
  ])('deployment %s + communication %s → expected to run: %s', (deploymentState, communicationState, expected) => {
    expect(isAdapterExpectedToRun({ deploymentState, communicationState })).toBe(expected);
  });

  it('every online adapter is expected to run', () => {
    for (const adapter of ADAPTER_ONLINE_FIXTURE.filter(isAdapterOnline)) {
      expect(isAdapterExpectedToRun(adapter)).toBe(true);
    }
  });

  it('at rest = a known non-running lifecycle state', () => {
    expect(isAdapterAtRest({ lifecycleState: 'HIBERNATED' })).toBe(true);
    expect(isAdapterAtRest({ lifecycleState: 'RUNNING' })).toBe(false);
    expect(isAdapterAtRest({ lifecycleState: null })).toBe(false);
  });
});
