import { InjectionToken, Provider } from '@angular/core';

/**
 * Host services of the cockpit widgets (AB#5558). The widgets live in this library and know
 * nothing about the application that embeds the MeshBoard; the host provides who the viewer is,
 * where a finding links to and whether "✦ Explain" exists, through these tokens
 * (`provideCockpitWidgetHost`). Every token is optional: without a host the widgets still render,
 * but role-gated content stays hidden and findings carry no links.
 */

/** Role names the cockpit widgets check (the OctoMesh identity roles). */
export const COCKPIT_ROLES = {
  AdminPanelManagement: 'AdminPanelManagement',
  CommunicationManagement: 'CommunicationManagement',
  TenantManagement: 'TenantManagement'
} as const;

/** Who is looking at the board. */
export interface CockpitViewerAccess {
  /** True when the signed-in user has the role (e.g. `CommunicationManagement`). */
  isInRole(role: string): boolean | Promise<boolean>;
  /**
   * True when the viewer works with the platform (the host's "builder" roles). Viewers who are not
   * get a quiet "Not available" instead of role requirements, and the board collapses cockpit
   * widgets that have nothing for them. Omitted = not a builder.
   */
  isBuilder?(): boolean | Promise<boolean>;
}

/**
 * The viewer's roles. Without it every role check fails — a provider or KPI that needs a role is
 * never run, so a board embedded in an app without this token shows no builder findings.
 */
export const COCKPIT_VIEWER_ACCESS = new InjectionToken<CockpitViewerAccess>('COCKPIT_VIEWER_ACCESS');

/**
 * What a finding or KPI links to — semantic targets, so the library holds no application routes.
 * The host maps them to its own URLs (`CockpitLinkResolver`).
 */
export type CockpitLinkTarget =
  | { kind: 'adapter'; rtId: string }
  | { kind: 'adapters' }
  | { kind: 'pool'; rtId: string }
  | { kind: 'pools' }
  | { kind: 'dataFlows' }
  | { kind: 'ckModels' }
  | { kind: 'tenantSettings' }
  | { kind: 'secretsReEntry' };

/** Maps a link target to an application URL. */
export interface CockpitLinkResolver {
  /**
   * Router URL of the target for the tenant (e.g. `/acme/communication/adapters`), or `null` when
   * the host has no page for it — the link chip is then left out.
   */
  resolve(target: CockpitLinkTarget, tenantId: string): string | null;
}

/** The host's link resolver; without it findings and KPI tiles carry no links. */
export const COCKPIT_LINK_RESOLVER = new InjectionToken<CockpitLinkResolver>('COCKPIT_LINK_RESOLVER');

/** What "✦ Explain" hands to the host's assistant. */
export interface CockpitExplainTarget {
  /** Human readable name of the object or finding. */
  label: string;
  /** Runtime id, when the finding is about one entity. */
  rtId?: string;
  /** CK type id of that entity. */
  ckTypeId?: string;
  /** Composer prefill, e.g. "Why is the adapter "plc-07" offline?". */
  prompt?: string;
}

/** The host's assistant entry point. */
export interface CockpitExplainHandler {
  /** False hides every "✦ Explain" button (the assistant is disabled). */
  readonly enabled: boolean;
  explain(target: CockpitExplainTarget): void;
}

/** Optional: without it the attention list shows no "✦ Explain" buttons. */
export const COCKPIT_EXPLAIN_HANDLER = new InjectionToken<CockpitExplainHandler>('COCKPIT_EXPLAIN_HANDLER');

/** The host services in one call (`providers: [...provideCockpitWidgetHost({...})]`). */
export interface CockpitWidgetHost {
  access?: () => CockpitViewerAccess;
  links?: () => CockpitLinkResolver;
  explain?: () => CockpitExplainHandler;
}

/**
 * Provides the host services of the cockpit widgets. The factories run in an injection context,
 * so they may `inject()` the application's services:
 *
 * ```ts
 * provideCockpitWidgetHost({
 *   access: () => { const auth = inject(AuthorizeService); return { isInRole: r => auth.isInRole(r) }; },
 *   links: () => new StudioCockpitLinks()
 * })
 * ```
 */
export function provideCockpitWidgetHost(host: CockpitWidgetHost): Provider[] {
  const providers: Provider[] = [];
  if (host.access) {
    providers.push({ provide: COCKPIT_VIEWER_ACCESS, useFactory: host.access });
  }
  if (host.links) {
    providers.push({ provide: COCKPIT_LINK_RESOLVER, useFactory: host.links });
  }
  if (host.explain) {
    providers.push({ provide: COCKPIT_EXPLAIN_HANDLER, useFactory: host.explain });
  }
  return providers;
}
