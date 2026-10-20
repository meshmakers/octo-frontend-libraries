export type NotificationHealth = 'OK' | 'NOT_RUN' | 'ERROR';

export type NotificationRecipientProblem = 'USER_DELETED' | 'INVALID_SCHEDULE' | 'RUN_FAILED';

export interface NotificationRecipientStatus {
  active: boolean;
  health: NotificationHealth;
  problem: NotificationRecipientProblem | null;
  detail: string | null;
}

export interface NotificationDeliveryStateSnapshot {
  lastRunAt?: unknown;
  lastSentAt?: unknown;
  lastError?: string | null;
}

export function notificationErrorText(lastError: string | null | undefined): string | null {
  return lastError?.replace(/^\[[^\]]*\]:\s*/, '') || null;
}

export function notificationRecipientStatus(state: NotificationDeliveryStateSnapshot | null | undefined,
  subscriptionDeployed: boolean, userExists: boolean, scheduleValid: boolean): NotificationRecipientStatus {
  const active = subscriptionDeployed;
  if (!userExists) return { active, health: 'ERROR', problem: 'USER_DELETED', detail: null };
  if (!scheduleValid) return { active, health: 'ERROR', problem: 'INVALID_SCHEDULE', detail: null };
  if (state?.lastError) return { active, health: 'ERROR', problem: 'RUN_FAILED', detail: notificationErrorText(state.lastError) };
  return { active, health: state?.lastRunAt ? 'OK' : 'NOT_RUN', problem: null, detail: null };
}

export function notificationSubscriptionHealth(states: readonly (NotificationDeliveryStateSnapshot | null | undefined)[],
  deployed: boolean): NotificationHealth | null {
  if (!deployed || states.length === 0) return null;
  if (states.some(state => state?.lastError)) return 'ERROR';
  return states.every(state => !state?.lastRunAt) ? 'NOT_RUN' : 'OK';
}
