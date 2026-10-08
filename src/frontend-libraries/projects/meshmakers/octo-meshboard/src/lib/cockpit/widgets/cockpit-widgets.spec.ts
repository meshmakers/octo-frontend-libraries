import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, throwError } from 'rxjs';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { AttentionListWidgetConfig, CockpitKpiWidgetConfig } from '../../models/meshboard.models';
import { AttentionFinding } from '../attention/attention.models';
import { AttentionState, CockpitAttentionService } from '../attention/attention.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { CockpitContextService } from '../cockpit-context.service';
import { CockpitLinkTarget } from '../cockpit-host';
import { COCKPIT_WIDGET_MESSAGES, CockpitWidgetMessages } from '../cockpit-messages';
import { CockpitKpiResult, CockpitKpiService } from '../kpi/cockpit-kpi.service';
import { AttentionListConfigDialogComponent } from './attention-list-config-dialog.component';
import { AttentionListWidgetComponent } from './attention-list-widget.component';
import { CockpitKpiConfigDialogComponent } from './cockpit-kpi-config-dialog.component';
import { COCKPIT_KPI_SLOW_LOADING_MS, CockpitKpiWidgetComponent, kpiKindOf } from './cockpit-kpi-widget.component';

const base = { id: 'w1', title: 'Needs attention', col: 1, row: 1, colSpan: 6, rowSpan: 1, dataSource: { type: 'static' as const } };

const finding = (id: string, severity: AttentionFinding['severity'], extra: Partial<AttentionFinding> = {}): AttentionFinding => ({
  id, severity, title: `${id} title`, text: `${id} text`, links: [], ...extra
});

describe('cockpit widgets', () => {
  const state$ = new BehaviorSubject<AttentionState>({ findings: [], loading: true, visibleProviders: 1 });
  const kpi$ = new BehaviorSubject<CockpitKpiResult>({ state: 'loading' });
  const attention = { state: vi.fn(() => state$.asObservable()), availableProviders: vi.fn() };
  const kpiService = { kpi: vi.fn(() => kpi$.asObservable()) };
  const resolveLink = (target: { kind: string; rtId?: string }, tenantId: string) =>
    target.kind === 'secretsReEntry' || target.kind === 'route' ? null : `/${tenantId}/${target.kind}${target.rtId ? '/' + target.rtId : ''}`;
  const context = {
    tenantId: vi.fn().mockResolvedValue('acme'),
    resolveLink: vi.fn(resolveLink),
    resolveLinkTarget: vi.fn((target: CockpitLinkTarget, tenantId: string) => {
      if (target.kind === 'route') {
        return { path: typeof target.path === 'string' ? target.path : [...target.path], queryParams: target.queryParams };
      }
      const url = resolveLink(target, tenantId);
      return url ? { path: url } : null;
    }),
    explainEnabled: true,
    explain: vi.fn(),
    isBuilder: vi.fn().mockResolvedValue(true)
  };
  const boardState = { setWidgetHiddenForViewer: vi.fn(), setWidgetContentHeight: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    context.explainEnabled = true;
    context.isBuilder.mockResolvedValue(true);
    state$.next({ findings: [], loading: true, visibleProviders: 1 });
    kpi$.next({ state: 'loading' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CockpitAttentionService, useValue: attention },
        { provide: CockpitKpiService, useValue: kpiService },
        { provide: CockpitContextService, useValue: context },
        { provide: MeshBoardStateService, useValue: boardState }
      ]
    });
  });

  async function renderAttention(config: Partial<AttentionListWidgetConfig> = {}) {
    const fixture = TestBed.createComponent(AttentionListWidgetComponent);
    fixture.componentRef.setInput('config', { ...base, type: 'attentionList', ...config });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  describe('AttentionListWidgetComponent', () => {
    it('runs the configured providers for the current tenant', async () => {
      await renderAttention({ providerIds: ['adapters'] });
      expect(attention.state).toHaveBeenCalledWith({ tenantId: 'acme' }, ['adapters']);
    });

    it('says "Checking…" while providers run, then "All clear"', async () => {
      const fixture = await renderAttention();
      expect(fixture.nativeElement.querySelector('[data-state="loading"]')).toBeTruthy();
      state$.next({ findings: [], loading: false, visibleProviders: 2 });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-state="clear"]').textContent).toContain('Nothing needs attention');
    });

    it('centres the lone "All clear" message in the tile and lays findings out as a list (AB#5622)', async () => {
      const fixture = await renderAttention();
      state$.next({ findings: [], loading: false, visibleProviders: 2 });
      fixture.detectChanges();
      const container: HTMLElement = fixture.nativeElement.querySelector('.attention-widget');
      expect(container.classList).toContain('message-only');
      expect(container.getAttribute('data-layout')).toBe('message');
      state$.next({ findings: [finding('adapters:error', 'error')], loading: false, visibleProviders: 2 });
      fixture.detectChanges();
      expect(container.classList).not.toContain('message-only');
      expect(container.getAttribute('data-layout')).toBe('list');
    });

    it('never claims "all clear" when no check is available; builders see why and the widget stays', async () => {
      state$.next({ findings: [], loading: false, visibleProviders: 0 });
      const fixture = await renderAttention();
      expect(fixture.nativeElement.querySelector('[data-state="unavailable"]').textContent).toContain('No health checks are available for your role');
      expect(boardState.setWidgetHiddenForViewer).toHaveBeenLastCalledWith('w1', false);
    });

    it('shows end users a neutral "Not available" without role details and collapses the widget', async () => {
      context.isBuilder.mockResolvedValue(false);
      state$.next({ findings: [], loading: false, visibleProviders: 0 });
      const fixture = await renderAttention();
      const message = fixture.nativeElement.querySelector('[data-state="unavailable"]');
      expect(message.textContent.trim()).toBe('Not available');
      expect(message.getAttribute('role')).toBe('status');
      expect(boardState.setWidgetHiddenForViewer).toHaveBeenLastCalledWith('w1', true);
    });

    it('renders findings with resolved links, drops unresolvable ones and offers Explain', async () => {
      state$.next({ loading: false, visibleProviders: 1, findings: [
        finding('adapters:error', 'error', {
          links: [{ label: 'Open adapter', target: { kind: 'adapter', rtId: 'r1' } }, { label: 'Re-enter', target: { kind: 'secretsReEntry' } }],
          explain: { label: 'plc-07', prompt: 'Why?' }
        })
      ] });
      const fixture = await renderAttention();
      expect(fixture.nativeElement.querySelector('ul.finding-list').getAttribute('role')).toBe('list');
      expect(fixture.nativeElement.querySelector('[aria-live]')).toBeNull();
      const item = fixture.nativeElement.querySelector('[data-finding="adapters:error"]');
      expect(item.textContent).toContain('Error');
      expect(item.textContent).toContain('adapters:error title');
      const links = [...item.querySelectorAll('a')] as HTMLAnchorElement[];
      expect(links.map(a => a.getAttribute('href'))).toEqual(['/acme/adapter/r1']);
      const explain = item.querySelector('button.ai') as HTMLButtonElement;
      explain.click();
      expect(context.explain).toHaveBeenCalledWith({ label: 'plc-07', prompt: 'Why?' });
    });

    it('shows a count badge only for findings that carry a count (AB#5622)', async () => {
      state$.next({ loading: false, visibleProviders: 1, findings: [
        finding('queue', 'warning', { count: 1284 }),
        finding('plain', 'info')
      ] });
      const fixture = await renderAttention();
      const badge = fixture.nativeElement.querySelector('[data-finding="queue"] .finding-count') as HTMLElement;
      // A generic span cannot carry an accessible name: the label is visually hidden text instead.
      expect(badge.querySelector('[aria-hidden="true"]')?.textContent).toBe('1,284');
      expect(badge.querySelector('.cw-visually-hidden')?.textContent).toBe('Count: 1,284');
      expect(badge.getAttribute('title')).toBe('Count: 1,284');
      expect(fixture.nativeElement.querySelector('[data-finding="plain"] .finding-count')).toBeNull();
    });

    it('navigates route targets with their query parameters, next to semantic links (AB#5622)', async () => {
      state$.next({ loading: false, visibleProviders: 1, findings: [
        finding('documents', 'error', { links: [
          { label: 'Review', target: { kind: 'route', path: '/acme/de/documents', queryParams: { checkTier: '2', view: 'all' } } },
          { label: 'Inbox', target: { kind: 'route', path: ['/', 'acme', 'inbox'] } },
          { label: 'Adapters', target: { kind: 'adapters' } }
        ] })
      ] });
      const fixture = await renderAttention();
      const hrefs = [...fixture.nativeElement.querySelectorAll('[data-finding="documents"] a')].map(a => (a as HTMLAnchorElement).getAttribute('href'));
      expect(hrefs).toEqual(['/acme/de/documents?checkTier=2&view=all', '/acme/inbox', '/acme/adapters']);
    });

    it('translates its texts through COCKPIT_WIDGET_MESSAGES; the messages input wins (AB#5622)', async () => {
      TestBed.configureTestingModule({ providers: [{ provide: COCKPIT_WIDGET_MESSAGES, useValue: { severityError: 'Fehler', attentionMore: 'und {count} weitere', numberLocale: 'de-DE' } }] });
      state$.next({ loading: false, visibleProviders: 1, findings: [
        finding('a', 'error', { count: 1284 }), finding('b', 'warning'), finding('c', 'info')
      ] });
      const fixture = await renderAttention({ maxItems: 1 });
      const item = fixture.nativeElement.querySelector('[data-finding="a"]') as HTMLElement;
      expect(item.querySelector('.cw-status-chip')?.textContent).toContain('Fehler');
      expect(item.querySelector('.finding-count [aria-hidden="true"]')?.textContent?.trim()).toBe('1.284');
      expect(fixture.nativeElement.querySelector('.more').textContent).toContain('und 2 weitere');
      fixture.componentRef.setInput('messages', { severityError: 'Erreur' });
      fixture.detectChanges();
      expect(item.querySelector('.cw-status-chip')?.textContent).toContain('Erreur');
    });

    it('follows a runtime language switch on a signal token, incl. the error text (AB#5622)', async () => {
      const language = signal<Partial<CockpitWidgetMessages>>({ severityError: 'Fehler' });
      TestBed.configureTestingModule({ providers: [{ provide: COCKPIT_WIDGET_MESSAGES, useValue: language }] });
      state$.next({ loading: false, visibleProviders: 1, findings: [finding('a', 'error')] });
      const fixture = await renderAttention();
      const chip = () => fixture.nativeElement.querySelector('[data-finding="a"] .cw-status-chip')?.textContent;
      expect(chip()).toContain('Fehler');
      language.set({ severityError: 'Erreur' });
      fixture.detectChanges();
      expect(chip()).toContain('Erreur');

      // The error text is not frozen at load time either.
      attention.state.mockReturnValueOnce(throwError(() => new Error('boom')));
      language.set({ attentionLoadFailed: 'Échec du chargement.' });
      const failing = await renderAttention();
      expect(failing.nativeElement.querySelector('.cw-error-text').textContent).toContain('Échec du chargement.');
      language.set({ attentionLoadFailed: 'Laden fehlgeschlagen.' });
      failing.detectChanges();
      expect(failing.nativeElement.querySelector('.cw-error-text').textContent).toContain('Laden fehlgeschlagen.');
    });

    it('does not break on an invalid numberLocale (falls back to en-US)', async () => {
      TestBed.configureTestingModule({ providers: [{ provide: COCKPIT_WIDGET_MESSAGES, useValue: { numberLocale: 'not a locale!' } }] });
      state$.next({ loading: false, visibleProviders: 1, findings: [finding('a', 'error', { count: 1284 })] });
      const fixture = await renderAttention();
      expect(fixture.nativeElement.querySelector('.finding-count [aria-hidden="true"]')?.textContent).toBe('1,284');
    });

    it('hides Explain when the host disables it or the widget opts out', async () => {
      state$.next({ loading: false, visibleProviders: 1, findings: [finding('a', 'error', { explain: { label: 'x' } })] });
      let fixture = await renderAttention({ showExplain: false });
      expect(fixture.nativeElement.querySelector('button.ai')).toBeNull();
      context.explainEnabled = false;
      fixture = await renderAttention();
      expect(fixture.nativeElement.querySelector('button.ai')).toBeNull();
    });

    it('reports the natural content height so the phone tier can grow the tile (AB#5558)', async () => {
      const callbacks: (() => void)[] = [];
      const original = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class {
        constructor(callback: () => void) { callbacks.push(callback); }
        observe(): void { /* stub */ }
        disconnect(): void { /* stub */ }
        unobserve(): void { /* stub */ }
      } as unknown as typeof ResizeObserver;
      try {
        state$.next({ loading: false, visibleProviders: 1, findings: [finding('a', 'error'), finding('b', 'warning')] });
        const fixture = await renderAttention();
        const content = fixture.nativeElement.querySelector('.attention-widget > .cw-content') as HTMLElement;
        expect(content.querySelectorAll('[data-finding]').length).toBe(2);
        vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({ height: 640 } as DOMRect);
        callbacks.forEach(callback => callback());
        const [id, height] = boardState.setWidgetContentHeight.mock.calls.at(-1)!;
        expect(id).toBe('w1');
        expect(height).toBeGreaterThanOrEqual(640);
        fixture.destroy();
        expect(boardState.setWidgetContentHeight).toHaveBeenLastCalledWith('w1', null);
      } finally {
        globalThis.ResizeObserver = original;
      }
    });

    it('caps the list at maxItems and says how many more', async () => {
      state$.next({ loading: false, visibleProviders: 1, findings: [finding('a', 'error'), finding('b', 'warning'), finding('c', 'info')] });
      const fixture = await renderAttention({ maxItems: 2 });
      expect(fixture.nativeElement.querySelectorAll('[data-finding]').length).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('and 1 more');
    });
  });

  describe('CockpitKpiWidgetComponent', () => {
    async function renderKpi(config: Partial<CockpitKpiWidgetConfig> & { type: CockpitKpiWidgetConfig['type'] }) {
      const fixture = TestBed.createComponent(CockpitKpiWidgetComponent);
      fixture.componentRef.setInput('config', { ...base, ...config });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it('maps the widget type to its KPI', () => {
      expect(kpiKindOf({ ...base, type: 'ckModelState' })).toBe('ckModelState');
      expect(kpiKindOf({ ...base, type: 'pipelineExecutions' })).toBe('pipelineExecutions');
      expect(kpiKindOf({ ...base, type: 'adapterStatus' })).toBe('adapterStatus');
    });

    it('renders value, status chip, detail and a linked tile', async () => {
      const fixture = await renderKpi({ type: 'adapterStatus' });
      expect(kpiService.kpi).toHaveBeenCalledWith('adapterStatus', expect.objectContaining({ kpiAdaptersLabel: 'Adapters online' }));
      kpi$.next({ state: 'ready', kpi: { id: 'adapters-online', label: 'Adapters online', value: '3 / 4', status: 'warning', statusLabel: '1 offline', detail: '1 hibernated', link: { kind: 'adapters' } } });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const tile = fixture.nativeElement.querySelector('[data-kpi="adapters-online"]') as HTMLAnchorElement;
      expect(tile.tagName).toBe('A');
      expect(tile.getAttribute('href')).toBe('/acme/adapters');
      expect(tile.textContent).toContain('3 / 4');
      expect(tile.querySelector('.cw-status-warning')?.textContent).toContain('1 offline');
      expect(tile.textContent).toContain('1 hibernated');
      // The link's accessible name starts with the metric.
      expect(tile.querySelector('.cw-visually-hidden')?.textContent).toContain('Adapters online:');
      expect(boardState.setWidgetHiddenForViewer).toHaveBeenLastCalledWith('w1', false);
    });

    it('renders the sparkline with its accessible label unless switched off', async () => {
      kpi$.next({ state: 'ready', kpi: { id: 'pipeline-executions', label: 'x', value: '5', status: 'error', statusLabel: '1 failed', sparkline: [0, 2, 3], sparklineLabel: 'peak 3' } });
      let fixture = await renderKpi({ type: 'pipelineExecutions' });
      expect(fixture.nativeElement.querySelector('svg.kpi-spark').getAttribute('aria-label')).toBe('peak 3');
      fixture = await renderKpi({ type: 'pipelineExecutions', showSparkline: false, showDetail: false });
      expect(fixture.nativeElement.querySelector('svg.kpi-spark')).toBeNull();
    });

    it('explains to a builder without the role why there is no figure', async () => {
      kpi$.next({ state: 'unavailable', reason: 'Needs the CommunicationManagement role and the System.Communication model.', forBuilder: true });
      const fixture = await renderKpi({ type: 'adapterStatus' });
      expect(fixture.nativeElement.querySelector('[data-state="unavailable"]').textContent).toContain('CommunicationManagement');
      expect(boardState.setWidgetHiddenForViewer).toHaveBeenLastCalledWith('w1', false);
    });

    it('links a route KPI target with its query parameters (AB#5622)', async () => {
      kpi$.next({ state: 'ready', kpi: { id: 'k', label: 'x', value: '5', status: 'success', statusLabel: 'ok', link: { kind: 'route', path: '/acme/todos', queryParams: { mine: 1 } } } });
      const fixture = await renderKpi({ type: 'adapterStatus' });
      expect(fixture.nativeElement.querySelector('[data-kpi="k"]').getAttribute('href')).toBe('/acme/todos?mine=1');
    });

    it('passes the host texts to the KPI and translates "Not available" (AB#5622)', async () => {
      TestBed.configureTestingModule({ providers: [{ provide: COCKPIT_WIDGET_MESSAGES, useValue: { notAvailable: 'Nicht verfügbar', kpiAdaptersLabel: 'Adapter online' } }] });
      kpi$.next({ state: 'unavailable', reason: 'x', forBuilder: false });
      const fixture = await renderKpi({ type: 'adapterStatus' });
      expect(kpiService.kpi).toHaveBeenCalledWith('adapterStatus', expect.objectContaining({ kpiAdaptersLabel: 'Adapter online', kpiAdaptersAllOnline: 'All online' }));
      expect(fixture.nativeElement.querySelector('[data-state="unavailable"]').textContent.trim()).toBe('Nicht verfügbar');
      expect(kpiService.kpi).toHaveBeenCalledTimes(1);
    });

    it('reloads the tile when the language signal changes (AB#5622)', async () => {
      const language = signal<Partial<CockpitWidgetMessages>>({ kpiAdaptersLabel: 'Adapter online' });
      TestBed.configureTestingModule({ providers: [{ provide: COCKPIT_WIDGET_MESSAGES, useValue: language }] });
      await renderKpi({ type: 'adapterStatus' });
      expect(kpiService.kpi).toHaveBeenCalledTimes(1);
      language.set({ kpiAdaptersLabel: 'Adaptateurs en ligne' });
      TestBed.tick();
      expect(kpiService.kpi).toHaveBeenCalledTimes(2);
      expect(kpiService.kpi).toHaveBeenLastCalledWith('adapterStatus', expect.objectContaining({ kpiAdaptersLabel: 'Adaptateurs en ligne' }));
    });

    describe('slow loading (AB#5622)', () => {
      afterEach(() => vi.useRealTimers());

      function renderNow(type: CockpitKpiWidgetConfig['type']) {
        const fixture = TestBed.createComponent(CockpitKpiWidgetComponent);
        fixture.componentRef.setInput('config', { ...base, type });
        fixture.detectChanges();
        return fixture;
      }
      const loadingText = (fixture: { nativeElement: HTMLElement }) =>
        fixture.nativeElement.querySelector('[data-state="loading"]')?.textContent?.trim();

      it('says "Scanning catalogs…" once the blueprint scan takes longer than a second', () => {
        vi.useFakeTimers();
        const fixture = renderNow('blueprintUpdates');
        expect(loadingText(fixture)).toBe('Loading…');
        vi.advanceTimersByTime(COCKPIT_KPI_SLOW_LOADING_MS - 1);
        fixture.detectChanges();
        expect(loadingText(fixture)).toBe('Loading…');
        vi.advanceTimersByTime(1);
        fixture.detectChanges();
        expect(loadingText(fixture)).toBe('Scanning catalogs…');
        expect(fixture.nativeElement.querySelector('[data-state="loading"]').getAttribute('role')).toBe('status');
        // The figure still replaces the message as soon as it arrives.
        kpi$.next({ state: 'ready', kpi: { id: 'blueprint-updates', label: 'Blueprint updates', value: '2', status: 'warning', statusLabel: '2 available' } });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-state="loading"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('[data-kpi="blueprint-updates"]').textContent).toContain('2 available');
      });

      it('keeps "Loading…" for the other KPIs and when the scan is fast', () => {
        vi.useFakeTimers();
        const other = renderNow('adapterStatus');
        vi.advanceTimersByTime(COCKPIT_KPI_SLOW_LOADING_MS * 3);
        other.detectChanges();
        expect(loadingText(other)).toBe('Loading…');
      });

      it('uses the host translation of the scanning text', () => {
        vi.useFakeTimers();
        TestBed.configureTestingModule({ providers: [{ provide: COCKPIT_WIDGET_MESSAGES, useValue: { kpiBlueprintsScanning: 'Kataloge werden durchsucht…' } }] });
        const fixture = renderNow('blueprintUpdates');
        vi.advanceTimersByTime(COCKPIT_KPI_SLOW_LOADING_MS);
        fixture.detectChanges();
        expect(loadingText(fixture)).toBe('Kataloge werden durchsucht…');
      });
    });

    it('shows end users "Not available" without role details and collapses the tile', async () => {
      kpi$.next({ state: 'unavailable', reason: 'Needs the CommunicationManagement role.', forBuilder: false });
      const fixture = await renderKpi({ type: 'adapterStatus' });
      const message = fixture.nativeElement.querySelector('[data-state="unavailable"]');
      expect(message.textContent.trim()).toBe('Not available');
      expect(message.textContent).not.toContain('CommunicationManagement');
      expect(boardState.setWidgetHiddenForViewer).toHaveBeenLastCalledWith('w1', true);
    });
  });

  describe('config dialogs', () => {
    const close = vi.fn();

    beforeEach(() => {
      attention.availableProviders.mockReturnValue([
        { id: 'ck-models-resolve-failed', label: 'CK', description: '' },
        { id: 'adapters', label: 'Adapters', description: '' },
        { id: 'secrets-re-entry', label: 'Secrets', description: '' }
      ]);
    });

    function attentionDialog(initial: { ids?: string[]; max?: number; explain?: boolean } = {}) {
      TestBed.configureTestingModule({ providers: [AttentionListConfigDialogComponent, { provide: WindowRef, useValue: { close } }] });
      const dialog = TestBed.inject(AttentionListConfigDialogComponent);
      dialog.initialProviderIds = initial.ids;
      dialog.initialMaxItems = initial.max;
      dialog.initialShowExplain = initial.explain;
      dialog.ngOnInit();
      return dialog;
    }

    it('defaults to all checks and saves an empty provider list', () => {
      const dialog = attentionDialog();
      expect(dialog.mode).toBe('all');
      dialog.onSave();
      expect(close).toHaveBeenCalledWith({ ckTypeId: '', providerIds: [], maxItems: 6, showExplain: true });
    });

    it('restores a selection (dropping unknown ids) and saves it in registration order', () => {
      const dialog = attentionDialog({ ids: ['secrets-re-entry', 'gone'], max: 3, explain: false });
      expect(dialog.mode).toBe('selected');
      expect(dialog.isSelected('secrets-re-entry')).toBe(true);
      dialog.toggle('ck-models-resolve-failed');
      dialog.onSave();
      expect(close).toHaveBeenCalledWith({ ckTypeId: '', providerIds: ['ck-models-resolve-failed', 'secrets-re-entry'], maxItems: 3, showExplain: false });
    });

    it('refuses to save an empty selection', () => {
      const dialog = attentionDialog({ ids: ['adapters'] });
      dialog.toggle('adapters');
      expect(dialog.canSave).toBe(false);
      dialog.onSave();
      expect(close).not.toHaveBeenCalled();
    });

    it('saves the KPI display options', () => {
      TestBed.configureTestingModule({ providers: [CockpitKpiConfigDialogComponent, { provide: WindowRef, useValue: { close } }] });
      const dialog = TestBed.inject(CockpitKpiConfigDialogComponent);
      dialog.initialShowDetail = false;
      dialog.ngOnInit();
      expect(dialog.showSparkline).toBe(true);
      dialog.onSave();
      expect(close).toHaveBeenCalledWith({ ckTypeId: '', showDetail: false, showSparkline: true });
      dialog.onCancel();
      expect(close).toHaveBeenLastCalledWith();
    });
  });
});

