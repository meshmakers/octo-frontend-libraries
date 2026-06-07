import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';

/**
 * Configuration the host application supplies via {@link provideOctoAiConsole}.
 * Every field is required so the library never falls back to a hard-coded URL or
 * tenant id — host apps that wire the library through their own DI container can
 * surface placeholders explicitly instead.
 */
export interface AiAdapterOptions {
  /**
   * Absolute base URL of the AI Adapter REST API, e.g. `https://ai.acme.cloud`.
   * Must NOT include a trailing slash. The library appends
   * `/{tenantId}/v1/sessions...` itself.
   */
  readonly baseUrl: string;

  /**
   * Tenant whose sessions the host wants to surface. The library renders the
   * tenant id into every REST URL. Host apps that have multiple tenants must
   * compose the provider with the tenant id from their routing context.
   */
  readonly tenantId: string;

  /**
   * SignalR hub path, relative to the base URL, e.g. `/hubs/ai`. Used by
   * `AiSessionStreamService` to connect when a host calls
   * `streamSession(sessionId)`.
   */
  readonly hubPath: string;
}

/**
 * DI token the services in this library read at construction time.
 * Provided by {@link provideOctoAiConsole}.
 */
export const AI_ADAPTER_OPTIONS = new InjectionToken<AiAdapterOptions>(
  'mm-octo-ai-console.adapter-options',
);

/**
 * Composable provider that surfaces the library's adapter configuration to the
 * Angular DI container. Host applications call this once in `app.config.ts`:
 *
 * ```ts
 * providers: [
 *   provideOctoAiConsole({
 *     baseUrl: 'https://ai.acme.cloud',
 *     tenantId: 'acme',
 *     hubPath: '/hubs/ai',
 *   }),
 * ]
 * ```
 */
export function provideOctoAiConsole(
  options: AiAdapterOptions,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AI_ADAPTER_OPTIONS, useValue: options },
  ]);
}
