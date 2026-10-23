/*
 * Public API Surface of shared-auth/dash0
 *
 * Opt-in secondary entry point (AB#7327): reports the signed-in user and the current tenant to Dash0 browser
 * monitoring. Import from '@meshmakers/shared-auth/dash0' only in apps that use '@dash0/sdk-web' (optional
 * peer dependency of this package).
 */
export * from './dash0-session-identity';
