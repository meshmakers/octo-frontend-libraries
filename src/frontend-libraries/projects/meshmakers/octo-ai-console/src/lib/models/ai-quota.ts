/**
 * Severity of a quota warning. `Warning` fires at 80% of the daily-tokens cap,
 * `Critical` fires at 100%. Mirrors the C# discriminator string.
 */
export type AiQuotaSeverity = 'Warning' | 'Critical';

/**
 * Payload pushed by the adapter's `OnQuotaWarningAsync` SignalR callback.
 * Broadcast to every connection for the tenant when the daily-tokens budget
 * crosses 80% or 100%. UI renders a banner with the embedded numbers.
 */
export interface AiQuotaWarningDto {
  readonly severity: AiQuotaSeverity;
  readonly thresholdPercent: number;
  readonly tokensConsumed: number;
  readonly tokensPerDayCap: number;
  readonly at: string;
}
