export type NotificationPreferenceStatus =
  'HEALTHY' | 'WATCHING' | 'WAITING' | 'RUNNING' | 'FAILING' | 'PAUSED' | 'USER_DELETED' | 'NOT_SCHEDULED';

export type NotificationSubscriptionHealth = 'HEALTHY' | 'WAITING' | 'FAILING' | 'N/A';

export interface NotificationDeliveryStateSnapshot {
  lastRunAt?: unknown;
  lastSentAt?: unknown;
  lastError?: string | null;
  runningSince?: unknown;
}

export function notificationPreferenceStatus(state: NotificationDeliveryStateSnapshot | null | undefined,
  subscriptionDeployed: boolean | null | undefined, userExists = true, schedulable = true): NotificationPreferenceStatus {
  if (!userExists) return 'USER_DELETED';
  if (subscriptionDeployed === false) return 'PAUSED';
  if (!schedulable) return 'NOT_SCHEDULED';
  if (state?.lastError) return 'FAILING';
  if (state?.runningSince) return 'RUNNING';
  if (!state?.lastRunAt) return 'WAITING';
  return state.lastSentAt ? 'HEALTHY' : 'WATCHING';
}

export function notificationSubscriptionHealth(states: readonly (NotificationDeliveryStateSnapshot | null | undefined)[],
  deployed: boolean): NotificationSubscriptionHealth {
  if (!deployed || states.length === 0) return 'N/A';
  if (states.some(state => state?.lastError)) return 'FAILING';
  return states.every(state => !state?.lastRunAt) ? 'WAITING' : 'HEALTHY';
}

export function notificationErrorText(lastError: string | null | undefined): string | null {
  return lastError?.replace(/^\[[^\]]*\]:\s*/, '') || null;
}
