import { InjectionToken, Provider, Signal } from '@angular/core';
import { COCKPIT_WIDGET_MESSAGES, CockpitWidgetMessagesSource } from './cockpit-messages';

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

/** Query parameters of a {@link CockpitRouteLinkTarget}. */
export type CockpitLinkQueryParams = Readonly<Record<string, string | number | boolean>>;

/**
 * A link straight to an application route (AB#5622), for host providers whose findings point at
 * their own pages, e.g. a pre-filtered list: `{ kind: 'route', path: 'documents', queryParams: {
 * checkTier: '2' } }`. Navigates through the Angular Router (`routerLink` + `queryParams`).
 *
 * `path` is a URL path or router commands (`['/', tenantId, 'documents']`). Absolute paths are
 * used as they are; relative ones resolve against the route that renders the board. The host's
 * `CockpitLinkResolver` sees route targets too and may return a rewritten path (e.g. prefixed
 * with the tenant root); `null` there keeps `path` — the query parameters always come from the
 * target.
 */
export interface CockpitRouteLinkTarget {
  kind: 'route';
  path: string | readonly string[];
  queryParams?: CockpitLinkQueryParams;
}

/**
 * What a finding or KPI links to — semantic targets, so the library holds no application routes.
 * The host maps them to its own URLs (`CockpitLinkResolver`); `route` targets carry the route
 * themselves.
 */
export type CockpitLinkTarget =
  | { kind: 'adapter'; rtId: string }
  | { kind: 'adapters' }
  | { kind: 'pool'; rtId: string }
  | { kind: 'pools' }
  | { kind: 'dataFlows' }
  | { kind: 'ckModels' }
  | { kind: 'tenantSettings' }
  | { kind: 'secretsReEntry' }
  | CockpitRouteLinkTarget;

/** A link target resolved for `routerLink` (path or commands) and `queryParams`. */
export interface CockpitResolvedLink {
  path: string | string[];
  queryParams?: CockpitLinkQueryParams;
}

/** Maps a link target to an application URL. */
export interface CockpitLinkResolver {
  /**
   * Router URL of the target for the tenant (e.g. `/acme/communication/adapters`), or `null` when
   * the host has no page for it — the link chip is then left out. For `route` targets `null`
   * means "use the target's path as it is".
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

/** What a recent item points at (drives the row glyph). */
export type CockpitRecentItemKind = 'page' | 'entity' | 'board';

/** One row of the "Recent items" widget, already checked by the host for the viewer. */
export interface CockpitRecentItem {
  /** Stable key (e.g. the router URL without query). */
  key: string;
  kind: CockpitRecentItemKind;
  /** What the viewer opened, e.g. "Mesh Adapter". */
  label: string;
  /** What it is, e.g. "MeshBoard" or "Integration › Adapters". */
  kindLabel: string;
  /** Epoch milliseconds of the last visit (shown as relative time). */
  lastVisitedAt: number;
  /** Real href of the link, so middle-click, Cmd/Ctrl-click and the context menu work. */
  href: string;
}

/**
 * The viewer's recently opened places — a per-user history the board does not store. The host
 * owns it (the Refinery Studio: the same history as the empty Cmd+K palette), re-checks every
 * entry against what the viewer may still open and decides how an entry opens.
 */
export interface CockpitRecentItemsSource {
  /** Changes whenever the history changes; the widget then re-reads {@link items}. */
  readonly revision?: Signal<unknown>;
  /** Most recently opened first, at most `limit`, only entries the viewer may still open. */
  items(limit: number): Promise<CockpitRecentItem[]>;
  /** Opens an entry on a plain left click (modified clicks are left to the browser). */
  open(item: CockpitRecentItem): void | Promise<void>;
  /** Optional: opens the host's command palette, offered as "⌘K shows the same list". */
  openPalette?(): void;
  /** Label of the palette shortcut, e.g. "⌘K" or "Ctrl K" (default "Ctrl K"). */
  readonly paletteShortcut?: string;
}

/** The host's recent items; without it the "Recent items" widget says "Not available" and collapses. */
export const COCKPIT_RECENT_ITEMS = new InjectionToken<CockpitRecentItemsSource>('COCKPIT_RECENT_ITEMS');

/** The host services in one call (`providers: [...provideCockpitWidgetHost({...})]`). */
export interface CockpitWidgetHost {
  access?: () => CockpitViewerAccess;
  links?: () => CockpitLinkResolver;
  explain?: () => CockpitExplainHandler;
  recents?: () => CockpitRecentItemsSource;
  /** Translated widget texts (AB#5622), fixed or as a signal that follows the language. */
  messages?: () => CockpitWidgetMessagesSource;
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
  if (host.recents) {
    providers.push({ provide: COCKPIT_RECENT_ITEMS, useFactory: host.recents });
  }
  if (host.messages) {
    providers.push({ provide: COCKPIT_WIDGET_MESSAGES, useFactory: host.messages });
  }
  return providers;
}
