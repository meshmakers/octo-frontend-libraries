import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CkModelService, TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { CockpitContextService } from './cockpit-context.service';
import { COCKPIT_LINK_RESOLVER, CockpitLinkResolver, provideCockpitWidgetHost } from './cockpit-host';
import {
  COCKPIT_WIDGET_MESSAGES,
  CockpitWidgetMessages,
  DEFAULT_COCKPIT_WIDGET_MESSAGES,
  formatCockpitMessage,
  injectCockpitWidgetMessages,
  resolveCockpitWidgetMessages
} from './cockpit-messages';

describe('cockpit widget messages (AB#5622)', () => {
  it('keeps the English default for missing, undefined and null members', () => {
    const resolved = resolveCockpitWidgetMessages({ severityError: 'Fehler', severityWarning: undefined }, null, { severityInfo: null as unknown as string });
    expect(resolved.severityError).toBe('Fehler');
    expect(resolved.severityWarning).toBe('Warning');
    expect(resolved.severityInfo).toBe('Info');
    expect(resolveCockpitWidgetMessages()).toEqual(DEFAULT_COCKPIT_WIDGET_MESSAGES);
  });

  it('lets later layers win', () => {
    expect(resolveCockpitWidgetMessages({ loading: 'Lädt…' }, { loading: 'Chargement…' }).loading).toBe('Chargement…');
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(formatCockpitMessage('and {count} more', { count: 3 })).toBe('and 3 more');
    expect(formatCockpitMessage('{a} of {b}', { a: 'x' })).toBe('x of {b}');
  });

  it('follows a signal on the token and lets the widget input win', () => {
    const language = signal<Partial<CockpitWidgetMessages>>({ loading: 'Lädt…' });
    const input = signal<Partial<CockpitWidgetMessages> | null>(null);
    TestBed.configureTestingModule({ providers: [provideCockpitWidgetHost({ messages: () => language })] });
    const texts = runInInjectionContext(TestBed.inject(Injector), () => injectCockpitWidgetMessages(() => input()));
    expect(texts().loading).toBe('Lädt…');
    language.set({ loading: 'Loading (en-GB)…' });
    expect(texts().loading).toBe('Loading (en-GB)…');
    input.set({ loading: 'Own' });
    expect(texts().loading).toBe('Own');
    expect(TestBed.inject(COCKPIT_WIDGET_MESSAGES)).toBe(language);
  });
});

describe('CockpitContextService link targets (AB#5622)', () => {
  function setup(resolver?: CockpitLinkResolver): CockpitContextService {
    TestBed.configureTestingModule({
      providers: [
        { provide: CkModelService, useValue: {} },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve('acme') },
        ...(resolver ? [{ provide: COCKPIT_LINK_RESOLVER, useValue: resolver }] : [])
      ]
    });
    return TestBed.inject(CockpitContextService);
  }

  it('keeps semantic targets on the host resolver (null drops them)', () => {
    const context = setup({ resolve: target => target.kind === 'adapters' ? '/acme/communication/adapters' : null });
    expect(context.resolveLinkTarget({ kind: 'adapters' }, 'acme')).toEqual({ path: '/acme/communication/adapters' });
    expect(context.resolveLinkTarget({ kind: 'pools' }, 'acme')).toBeNull();
    expect(context.resolveLink({ kind: 'adapters' }, 'acme')).toBe('/acme/communication/adapters');
  });

  it('resolves route targets without a resolver, keeping path and query parameters', () => {
    const context = setup();
    const target = { kind: 'route' as const, path: ['/', 'acme', 'de', 'documents'], queryParams: { checkTier: '2', view: 'all' } };
    expect(context.resolveLinkTarget(target, 'acme')).toEqual({ path: ['/', 'acme', 'de', 'documents'], queryParams: { checkTier: '2', view: 'all' } });
    expect(context.resolveLink(target, 'acme')).toBe('/acme/de/documents?checkTier=2&view=all');
    expect(context.resolveLinkTarget({ kind: 'route', path: 'inbox' }, 'acme')).toEqual({ path: 'inbox' });
    expect(context.resolveLinkTarget({ kind: 'route', path: [] }, 'acme')).toBeNull();
    // Semantic targets still need a resolver.
    expect(context.resolveLinkTarget({ kind: 'adapters' }, 'acme')).toBeNull();
  });

  it('lets the host rewrite a route path; the query parameters stay', () => {
    const context = setup({ resolve: (target, tenantId) => target.kind === 'route' && typeof target.path === 'string' ? `/${tenantId}/de/${target.path}` : null });
    expect(context.resolveLinkTarget({ kind: 'route', path: 'todos', queryParams: { mine: 1 } }, 'acme')).toEqual({ path: '/acme/de/todos', queryParams: { mine: 1 } });
    // A resolver that does not know route targets (returns null) keeps the path.
    expect(context.resolveLinkTarget({ kind: 'route', path: ['/', 'x'] }, 'acme')).toEqual({ path: ['/', 'x'] });
  });

  it('drops route targets that would leave the app (scheme or protocol-relative path)', () => {
    const context = setup();
    for (const path of ['//evil.example/x', '/\\evil.example', 'https://evil.example', ' javascript:alert(1)', ['/', '/evil.example', 'x'], ['https://evil.example']]) {
      expect(context.resolveLinkTarget({ kind: 'route', path }, 'acme')).toBeNull();
      expect(context.resolveLink({ kind: 'route', path }, 'acme')).toBeNull();
    }
    // A colon further into an in-app path is fine.
    expect(context.resolveLinkTarget({ kind: 'route', path: '/acme/x:y' }, 'acme')).toEqual({ path: '/acme/x:y' });
    expect(context.resolveLinkTarget({ kind: 'route', path: 'documents' }, 'acme')).toEqual({ path: 'documents' });
  });

  it('survives a throwing resolver', () => {
    const context = setup({ resolve: () => { throw new Error('boom'); } });
    expect(context.resolveLinkTarget({ kind: 'adapters' }, 'acme')).toBeNull();
    expect(context.resolveLinkTarget({ kind: 'route', path: '/a' }, 'acme')).toEqual({ path: '/a' });
  });
});
