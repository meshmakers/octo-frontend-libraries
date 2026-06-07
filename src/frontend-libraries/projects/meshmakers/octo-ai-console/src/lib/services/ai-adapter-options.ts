import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import { AiAdapterClientService } from './ai-adapter-client.service';
import { AiSessionStreamService } from './ai-session-stream.service';

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
 * Minimal subset of the `@microsoft/signalr` `HubConnection` surface the library
 * exercises. The interface stays in the public API so host apps can supply
 * either the real SignalR connection (Refinery Studio, bastion CLI), a test
 * mock, or no factory at all — in which case {@link AiSessionStreamService}
 * falls back to REST-only backfill (Phase-1 stub behaviour). Keeping the type
 * structural lets the library stay agnostic of the `@microsoft/signalr` major
 * version line the host has installed.
 */
export interface AiHubConnectionLike {
  on(methodName: string, handler: (payload: unknown) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  invoke<T = unknown>(methodName: string, ...args: unknown[]): Promise<T>;
  onreconnected(handler: (connectionId?: string) => void): void;
}

/**
 * Builds a hub connection against the resolved URL. Return null when streaming
 * is not wired in this deployment yet — the stream service then quietly skips
 * the live channel and behaves exactly like the Phase-1 stub.
 */
export type AiSessionStreamConnectionFactory =
  (hubUrl: string) => AiHubConnectionLike | null;

/**
 * Optional DI token a host application provides to enable the live SignalR
 * channel on {@link AiSessionStreamService}. When absent, the service degrades
 * to REST-only backfill.
 */
export const AI_SESSION_STREAM_CONNECTION_FACTORY =
  new InjectionToken<AiSessionStreamConnectionFactory>(
    'mm-octo-ai-console.session-stream-connection-factory',
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
  // Provide AiAdapterClientService + AiSessionStreamService alongside the
  // options token. Both services drop `providedIn: 'root'` (6d0e7daf) because
  // the options they read are route-scoped — a host with multiple tenants
  // composes the provider with the right tenant id per route, and root-
  // singleton services would freeze the first route's options. Bundling the
  // services into the same provider chain means a host's `providers: [
  // provideOctoAiConsole({...}) ]` is enough; no manual listing required.
  return makeEnvironmentProviders([
    { provide: AI_ADAPTER_OPTIONS, useValue: options },
    AiAdapterClientService,
    AiSessionStreamService,
  ]);
}
