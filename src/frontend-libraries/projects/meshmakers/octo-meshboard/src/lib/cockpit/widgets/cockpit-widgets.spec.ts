import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { AttentionListWidgetConfig, CockpitKpiWidgetConfig } from '../../models/meshboard.models';
import { AttentionFinding } from '../attention/attention.models';
import { AttentionState, CockpitAttentionService } from '../attention/attention.service';
import { CockpitContextService } from '../cockpit-context.service';
import { CockpitKpiResult, CockpitKpiService } from '../kpi/cockpit-kpi.service';
import { AttentionListConfigDialogComponent } from './attention-list-config-dialog.component';
import { AttentionListWidgetComponent } from './attention-list-widget.component';
import { CockpitKpiConfigDialogComponent } from './cockpit-kpi-config-dialog.component';
import { CockpitKpiWidgetComponent, kpiKindOf } from './cockpit-kpi-widget.component';

const base = { id: 'w1', title: 'Needs attention', col: 1, row: 1, colSpan: 6, rowSpan: 1, dataSource: { type: 'static' as const } };

const finding = (id: string, severity: AttentionFinding['severity'], extra: Partial<AttentionFinding> = {}): AttentionFinding => ({
  id, severity, title: `${id} title`, text: `${id} text`, links: [], ...extra
});

describe('cockpit widgets', () => {
  const state$ = new BehaviorSubject<AttentionState>({ findings: [], loading: true, visibleProviders: 1 });
  const kpi$ = new BehaviorSubject<CockpitKpiResult>({ state: 'loading' });
  const attention = { state: vi.fn(() => state$.asObservable()), availableProviders: vi.fn() };
  const kpiService = { kpi: vi.fn(() => kpi$.asObservable()) };
  const context = {
    tenantId: vi.fn().mockResolvedValue('acme'),
    resolveLink: vi.fn((target: { kind: string; rtId?: string }, tenantId: string) =>
      target.kind === 'secretsReEntry' ? null : `/${tenantId}/${target.kind}${target.rtId ? '/' + target.rtId : ''}`),
    explainEnabled: true,
    explain: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    context.explainEnabled = true;
    state$.next({ findings: [], loading: true, visibleProviders: 1 });
    kpi$.next({ state: 'loading' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CockpitAttentionService, useValue: attention },
        { provide: CockpitKpiService, useValue: kpiService },
        { provide: CockpitContextService, useValue: context }
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

    it('never claims "all clear" when no check is available for the viewer', async () => {
      state$.next({ findings: [], loading: false, visibleProviders: 0 });
      const fixture = await renderAttention();
      expect(fixture.nativeElement.querySelector('[data-state="unavailable"]').textContent).toContain('No health checks are available for your role');
    });

    it('renders findings with resolved links, drops unresolvable ones and offers Explain', async () => {
      state$.next({ loading: false, visibleProviders: 1, findings: [
        finding('adapters:error', 'error', {
          links: [{ label: 'Open adapter', target: { kind: 'adapter', rtId: 'r1' } }, { label: 'Re-enter', target: { kind: 'secretsReEntry' } }],
          explain: { label: 'plc-07', prompt: 'Why?' }
        })
      ] });
      const fixture = await renderAttention();
      const item = fixture.nativeElement.querySelector('[data-finding="adapters:error"]');
      expect(item.textContent).toContain('Error');
      expect(item.textContent).toContain('adapters:error title');
      const links = [...item.querySelectorAll('a')] as HTMLAnchorElement[];
      expect(links.map(a => a.getAttribute('href'))).toEqual(['/acme/adapter/r1']);
      const explain = item.querySelector('button.ai') as HTMLButtonElement;
      explain.click();
      expect(context.explain).toHaveBeenCalledWith({ label: 'plc-07', prompt: 'Why?' });
    });

    it('hides Explain when the host disables it or the widget opts out', async () => {
      state$.next({ loading: false, visibleProviders: 1, findings: [finding('a', 'error', { explain: { label: 'x' } })] });
      let fixture = await renderAttention({ showExplain: false });
      expect(fixture.nativeElement.querySelector('button.ai')).toBeNull();
      context.explainEnabled = false;
      fixture = await renderAttention();
      expect(fixture.nativeElement.querySelector('button.ai')).toBeNull();
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
      expect(kpiService.kpi).toHaveBeenCalledWith('adapterStatus');
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
    });

    it('renders the sparkline with its accessible label unless switched off', async () => {
      kpi$.next({ state: 'ready', kpi: { id: 'pipeline-executions', label: 'x', value: '5', status: 'error', statusLabel: '1 failed', sparkline: [0, 2, 3], sparklineLabel: 'peak 3' } });
      let fixture = await renderKpi({ type: 'pipelineExecutions' });
      expect(fixture.nativeElement.querySelector('svg.kpi-spark').getAttribute('aria-label')).toBe('peak 3');
      fixture = await renderKpi({ type: 'pipelineExecutions', showSparkline: false, showDetail: false });
      expect(fixture.nativeElement.querySelector('svg.kpi-spark')).toBeNull();
    });

    it('explains why a viewer without the role sees no figure', async () => {
      kpi$.next({ state: 'unavailable', reason: 'Needs the CommunicationManagement role and the System.Communication model.' });
      const fixture = await renderKpi({ type: 'adapterStatus' });
      expect(fixture.nativeElement.querySelector('[data-state="unavailable"]').textContent).toContain('CommunicationManagement');
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

