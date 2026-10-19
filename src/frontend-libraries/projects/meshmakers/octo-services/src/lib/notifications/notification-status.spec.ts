import { notificationPreferenceStatus as preferenceStatus, notificationSubscriptionHealth as subscriptionHealth } from './notification-status';

describe('notification status', () => {
  const ran = { lastRunAt: '2026-10-12T10:00:00Z' };

  it('reads a preference of an undeployed subscription as paused, whatever its state', () => {
    expect(preferenceStatus({ ...ran, lastError: 'boom' }, false)).toBe('PAUSED');
  });

  it('reads a recorded error as failing, before running and healthy', () => {
    expect(preferenceStatus({ ...ran, lastError: 'boom', runningSince: '2026-10-12T10:01:00Z' }, true)).toBe('FAILING');
  });

  it('reads a held lease as running, a sent mail as healthy and no run as waiting', () => {
    expect(preferenceStatus({ runningSince: '2026-10-12T10:01:00Z' }, true)).toBe('RUNNING');
    expect(preferenceStatus({ ...ran, lastSentAt: '2026-10-12T10:00:00Z' }, true)).toBe('HEALTHY');
    expect(preferenceStatus(null, true)).toBe('WAITING');
  });

  it('reads a schedule the server never runs as not scheduled, unless the subscription is paused anyway', () => {
    expect(preferenceStatus(ran, true, true, false)).toBe('NOT_SCHEDULED');
    expect(preferenceStatus(ran, false, true, false)).toBe('PAUSED');
  });

  it('reads a run without any mail yet as watching', () => {
    expect(preferenceStatus(ran, true)).toBe('WATCHING');
  });

  it('reads a recipient whose user is gone as user deleted, before anything else', () => {
    expect(preferenceStatus({ ...ran, lastError: 'No recipients found' }, false, false)).toBe('USER_DELETED');
  });

  it('marks a subscription failing when any recipient failed', () => {
    expect(subscriptionHealth([ran, { ...ran, lastError: 'boom' }], true)).toBe('FAILING');
  });

  it('marks a subscription waiting until a recipient has run, healthy afterwards', () => {
    expect(subscriptionHealth([null, {}], true)).toBe('WAITING');
    expect(subscriptionHealth([null, ran], true)).toBe('HEALTHY');
  });

  it('has no health without deployment or recipients', () => {
    expect(subscriptionHealth([{ ...ran, lastError: 'boom' }], false)).toBe('N/A');
    expect(subscriptionHealth([], true)).toBe('N/A');
  });
});
