import { notificationRecipientStatus as recipientStatus, notificationSubscriptionHealth as subscriptionHealth } from './notification-status';

describe('notification status', () => {
  const ran = { lastRunAt: '2026-10-12T10:00:00Z' };

  it('keeps whether a recipient is active apart from its health', () => {
    expect(recipientStatus(ran, false, true, true)).toEqual({ active: false, health: 'OK', problem: null, detail: null });
    expect(recipientStatus(ran, true, true, true)).toEqual({ active: true, health: 'OK', problem: null, detail: null });
  });

  it('reads no run yet as not run', () => {
    expect(recipientStatus(null, true, true, true).health).toBe('NOT_RUN');
  });

  it('names the problem of an error: a deleted user first, then an invalid schedule, then the last run', () => {
    expect(recipientStatus({ ...ran, lastError: 'boom' }, true, false, false).problem).toBe('USER_DELETED');
    expect(recipientStatus({ ...ran, lastError: 'boom' }, true, true, false).problem).toBe('INVALID_SCHEDULE');
    expect(recipientStatus({ ...ran, lastError: '[NotificationNode]: boom' }, true, true, true))
      .toEqual({ active: true, health: 'ERROR', problem: 'RUN_FAILED', detail: 'boom' });
  });

  it('marks a subscription with an error when any recipient failed', () => {
    expect(subscriptionHealth([ran, { ...ran, lastError: 'boom' }], true)).toBe('ERROR');
  });

  it('marks a subscription not run until a recipient has run, ok afterwards', () => {
    expect(subscriptionHealth([null, {}], true)).toBe('NOT_RUN');
    expect(subscriptionHealth([null, ran], true)).toBe('OK');
  });

  it('has no health without deployment or recipients', () => {
    expect(subscriptionHealth([{ ...ran, lastError: 'boom' }], false)).toBeNull();
    expect(subscriptionHealth([], true)).toBeNull();
  });
});
