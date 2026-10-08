import { TestBed } from '@angular/core/testing';
import { filter, firstValueFrom, of, throwError } from 'rxjs';
import { AssetRepoService, CkModelService, CONFIGURATION_SERVICE, TenantFeaturesStatus } from '@meshmakers/octo-services';
import { print } from 'graphql';
import { CockpitUnregisteredPoolsDocumentDto, CockpitUnregisteredPoolsDtoGQL } from '../../../graphQL/cockpitUnregisteredPools';
import { COCKPIT_ROLES, COCKPIT_VIEWER_ACCESS } from '../../cockpit-host';
import { COCKPIT_WIDGET_MESSAGES } from '../../cockpit-messages';
import { CockpitDataFlowExecutionsService, CockpitDataFlowRow } from '../../data/cockpit-data-flow-executions.service';
import { CockpitAttentionService } from '../attention.service';
import { COCKPIT_ATTENTION_PROVIDERS } from '../attention.models';
import { COCKPIT_FAILED_EXECUTIONS_OPTIONS, DEFAULT_FAILED_EXECUTIONS_OPTIONS, FailedExecutionsAttentionProvider, failedExecutionsSeverity } from './failed-executions.provider';
import { ADAPTER_OFFLINE_GRACE_MS, adaptersInError, adaptersOffline, CockpitAdapterState, CockpitAdapterStatesService } from '../../data/cockpit-adapter-states.service';
import { CockpitCkModelStatesService } from '../../data/cockpit-ck-model-states.service';
import { AdaptersAttentionProvider } from './adapters.provider';
import { CkModelsResolveFailedAttentionProvider } from './ck-models-resolve-failed.provider';
import { enabledButNotInstalled, FeaturesNotInstalledAttentionProvider, isServiceConfigured } from './features-not-installed.provider';
import { UnregisteredPoolsAttentionProvider } from './unregistered-pools.provider';

const context = { tenantId: 'meshmakers' };
const RT = (c: string) => c.repeat(24);
type S = CockpitAdapterState;

function adapter(overrides: Partial<Record<keyof S, unknown>>): S {
  return {
    rtId: RT('a'), name: 'mesh-adapter', communicationState: 'ONLINE', communicationStateTimestamp: null,
    deploymentState: 'DEPLOYED', configurationState: 'CONFIGURED', lifecycleState: 'RUNNING', ...overrides
  } as S;
}

describe('cockpit attention providers', () => {
  const isInRole = vi.fn();
  const isModelAvailable = vi.fn();
  const ckModelStates = { counts: vi.fn() };
  const pools = { fetch: vi.fn() };
  const adapterStates = { states: vi.fn() };
  const dataFlowExecutions = { executions: vi.fn() };
  const assetRepo = { getTenantFeaturesStatus: vi.fn() };
  const configuration = { config: { reportingServices: 'https://reporting/', aiServices: '' } as Record<string, string> };

  beforeEach(() => {
    vi.clearAllMocks();
    isInRole.mockReturnValue(true);
    isModelAvailable.mockResolvedValue(true);
    configuration.config = { reportingServices: 'https://reporting/', aiServices: '' };
    TestBed.configureTestingModule({
      providers: [
        CkModelsResolveFailedAttentionProvider,
        UnregisteredPoolsAttentionProvider,
        AdaptersAttentionProvider,
        FeaturesNotInstalledAttentionProvider,
        FailedExecutionsAttentionProvider,
        { provide: CockpitDataFlowExecutionsService, useValue: dataFlowExecutions },
        { provide: COCKPIT_VIEWER_ACCESS, useValue: { isInRole } },
        { provide: CkModelService, useValue: { isModelAvailable } },
        { provide: CockpitCkModelStatesService, useValue: ckModelStates },
        { provide: CockpitUnregisteredPoolsDtoGQL, useValue: pools },
        { provide: CockpitAdapterStatesService, useValue: adapterStates },
        { provide: AssetRepoService, useValue: assetRepo },
        { provide: CONFIGURATION_SERVICE, useValue: configuration }
      ]
    });
  });

  it('hides every role-gated provider when the host provides no viewer access', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CkModelsResolveFailedAttentionProvider, { provide: CkModelService, useValue: { isModelAvailable } }, { provide: CockpitCkModelStatesService, useValue: ckModelStates }]
    });
    expect(await TestBed.inject(CkModelsResolveFailedAttentionProvider).isVisible()).toBe(false);
  });

  describe('CK models in ResolveFailed', () => {
    const provider = () => TestBed.inject(CkModelsResolveFailedAttentionProvider);

    it('is visible only to viewers who may open the model libraries', async () => {
      isInRole.mockImplementation((role: string) => role === COCKPIT_ROLES.AdminPanelManagement);
      expect(await provider().isVisible()).toBe(true);
      isInRole.mockReturnValue(false);
      expect(await provider().isVisible()).toBe(false);
    });

    it('builds one error finding from the shared counts', async () => {
      ckModelStates.counts.mockReturnValue(of({ total: 9, available: 4, importing: 0, resolveFailed: 5, resolveFailedNames: ['Demo.Tickets-1.0.0', 'FamilyOs-2.0.0'] }));
      const findings = await firstValueFrom(provider().load(context));
      expect(ckModelStates.counts).toHaveBeenCalledWith('meshmakers');
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ severity: 'error', title: '5 CK models in ResolveFailed', links: [{ target: { kind: 'ckModels' } }] });
      expect(findings[0].text).toContain('Demo.Tickets-1.0.0, FamilyOs-2.0.0 and 3 more');
    });

    it('reports nothing when every model resolves', async () => {
      ckModelStates.counts.mockReturnValue(of({ total: 3, available: 3, importing: 0, resolveFailed: 0, resolveFailedNames: [] }));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
    });
  });

  describe('deployment sites not registered (provider id pools-unregistered)', () => {
    const provider = () => TestBed.inject(UnregisteredPoolsAttentionProvider);

    it('needs CommunicationManagement and the System.Communication model', async () => {
      expect(await provider().isVisible()).toBe(true);
      isModelAvailable.mockResolvedValue(false);
      expect(await provider().isVisible()).toBe(false);
      isModelAvailable.mockResolvedValue(true);
      isInRole.mockReturnValue(false);
      expect(await provider().isVisible()).toBe(false);
    });

    it('keeps its persisted provider id (AB#5842: deployment sites, id unchanged)', () => {
      expect(provider().id).toBe('pools-unregistered');
      expect(provider().label).toBe('Deployment sites not registered');
    });

    it('queries System.Communication 4.x deployment sites', () => {
      const text = print(CockpitUnregisteredPoolsDocumentDto);
      expect(text).toContain('systemCommunicationDeploymentSite(');
      expect(text).not.toContain('systemCommunicationPool');
    });

    it('links a single unregistered deployment site directly', async () => {
      pools.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationDeploymentSite: { totalCount: 1, items: [{ rtId: RT('p'), name: 'Default Cloud' }] } } } }));
      const [found] = await firstValueFrom(provider().load());
      expect(found).toMatchObject({ severity: 'warning', title: 'Deployment site "Default Cloud" is not registered' });
      expect(found.links[0].target).toEqual({ kind: 'deployment-site', rtId: RT('p') });
      expect(found.links[1].target).toEqual({ kind: 'deployment-sites' });
      expect(found.explain).toMatchObject({ rtId: RT('p'), ckTypeId: 'System.Communication/DeploymentSite' });
    });

    it('summarises several deployment sites and reports nothing when there are none', async () => {
      pools.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationDeploymentSite: { totalCount: 2, items: [{ rtId: RT('p'), name: 'a' }, { rtId: RT('q'), name: 'b' }] } } } }));
      const [found] = await firstValueFrom(provider().load());
      expect(found.title).toBe('2 deployment sites not registered');
      expect(found.links).toEqual([{ label: 'Open deployment sites', target: { kind: 'deployment-sites' } }]);

      pools.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationDeploymentSite: { totalCount: 0, items: [] } } } }));
      expect(await firstValueFrom(provider().load())).toEqual([]);
    });
  });

  describe('adapters in error / offline', () => {
    const provider = () => TestBed.inject(AdaptersAttentionProvider);
    const now = Date.parse('2026-10-06T10:00:00Z');

    it('finds deployment and configuration errors', () => {
      const states = [adapter({ rtId: RT('a') }), adapter({ rtId: RT('b'), deploymentState: 'ERROR' }), adapter({ rtId: RT('c'), configurationState: 'ERROR' })];
      expect(adaptersInError(states).map(s => s.rtId)).toEqual([RT('b'), RT('c')]);
    });

    it('reports adapters expected to run offline beyond the grace period, not hibernated or undeployed ones', () => {
      const old = new Date(now - ADAPTER_OFFLINE_GRACE_MS - 1000);
      const fresh = new Date(now - 60_000);
      const states = [
        adapter({ rtId: RT('a'), communicationState: 'OFFLINE', communicationStateTimestamp: old }),
        adapter({ rtId: RT('b'), communicationState: 'OFFLINE', communicationStateTimestamp: fresh }),
        adapter({ rtId: RT('c'), communicationState: 'OFFLINE', lifecycleState: 'HIBERNATED' }),
        adapter({ rtId: RT('d'), communicationState: 'OFFLINE', deploymentState: 'UNDEPLOYED' }),
        adapter({ rtId: RT('e'), communicationState: 'UNREGISTERED', communicationStateTimestamp: null }),
        adapter({ rtId: RT('f'), communicationState: 'OFFLINE', deploymentState: 'DISABLED', communicationStateTimestamp: old })
      ];
      expect(adaptersOffline(states, now).map(s => s.rtId)).toEqual([RT('a'), RT('e'), RT('f')]);
    });

    it('builds an error finding linking the adapter, no offline finding for the same adapter', async () => {
      adapterStates.states.mockReturnValue(of({ totalCount: 2, states: [
        adapter({ rtId: RT('b'), name: 'sap-bridge', deploymentState: 'ERROR', communicationState: 'OFFLINE' }),
        adapter({ rtId: RT('a') })
      ] }));
      const findings = await firstValueFrom(provider().load(context));
      expect(adapterStates.states).toHaveBeenCalledWith('meshmakers');
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ id: 'adapters:error', severity: 'error', title: '1 adapter in error' });
      expect(findings[0].links[0].target).toEqual({ kind: 'adapter', rtId: RT('b') });
      expect(findings[0].explain).toMatchObject({ label: 'sap-bridge', rtId: RT('b'), ckTypeId: 'System.Communication/Adapter' });
    });

    it('says "≥" when the adapter read was capped', async () => {
      adapterStates.states.mockReturnValue(of({ totalCount: 900, states: [adapter({ rtId: RT('b'), deploymentState: 'ERROR' })] }));
      const [found] = await firstValueFrom(provider().load(context));
      expect(found.title).toBe('≥ 1 adapter in error');
    });

    it('reports nothing when all adapters are fine', async () => {
      adapterStates.states.mockReturnValue(of({ totalCount: 1, states: [adapter({})] }));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
    });
  });

  describe('features enabled but not installed', () => {
    const provider = () => TestBed.inject(FeaturesNotInstalledAttentionProvider);
    const status = (overrides: Partial<TenantFeaturesStatus> = {}): TenantFeaturesStatus => ({
      streamData: { instanceEnabled: true, tenantEnabled: true },
      communication: { tenantEnabled: true },
      reporting: { tenantEnabled: false },
      aiServices: { tenantEnabled: false },
      ...overrides
    });

    it('treats an empty or legacy "/" URL as not installed', () => {
      expect(isServiceConfigured('')).toBe(false);
      expect(isServiceConfigured('/')).toBe(false);
      expect(isServiceConfigured(undefined)).toBe(false);
      expect(isServiceConfigured('https://x/')).toBe(true);
    });

    it('lists the capabilities enabled without their service', () => {
      const config = { reportingServices: '', aiServices: '/' };
      expect(enabledButNotInstalled(status({ reporting: { tenantEnabled: true } }), config)).toEqual(['Reporting']);
      expect(enabledButNotInstalled(status({ aiServices: { tenantEnabled: true } }), config)).toEqual(['AI Services']);
      expect(enabledButNotInstalled(status({ streamData: { instanceEnabled: false, tenantEnabled: true } }), config)).toEqual(['Stream Data']);
      expect(enabledButNotInstalled(status({ reporting: { tenantEnabled: true } }), { reportingServices: 'https://r/' })).toEqual([]);
      expect(enabledButNotInstalled(null, config)).toEqual([]);
    });

    it('needs TenantManagement', async () => {
      isInRole.mockImplementation((role: string) => role === COCKPIT_ROLES.TenantManagement);
      expect(await provider().isVisible()).toBe(true);
      isInRole.mockReturnValue(false);
      expect(await provider().isVisible()).toBe(false);
    });

    it('reads the tenant status once and builds an info finding', async () => {
      configuration.config = { reportingServices: '', aiServices: '' };
      assetRepo.getTenantFeaturesStatus.mockResolvedValue(status({ reporting: { tenantEnabled: true } }));
      const findings = await firstValueFrom(provider().load(context));
      expect(assetRepo.getTenantFeaturesStatus).toHaveBeenCalledWith('meshmakers');
      expect(findings).toEqual([expect.objectContaining({ severity: 'info', title: 'Reporting enabled, but not installed', links: [{ label: 'Open tenant settings', target: { kind: 'tenantSettings' } }] })]);
    });

    it('reports nothing when everything enabled is installed', async () => {
      assetRepo.getTenantFeaturesStatus.mockResolvedValue(status({ reporting: { tenantEnabled: true } }));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
    });
  });

  describe('failed pipeline executions (AB#5622)', () => {
    const provider = () => TestBed.inject(FailedExecutionsAttentionProvider);
    const pipeline = (ok: number, failed: number) => ({
      __typename: 'SystemCommunicationPipeline',
      statisticsForPipeline: { items: [{ lastHourSuccessCount: 0, lastHourFailureCount: 0, last24HoursSuccessCount: ok, last24HoursFailureCount: failed, hourlyBuckets: [] }] },
      executedPipeline: { items: [] }
    });
    const flows = (ok: number, failed: number, totalCount = 1) => of({ flows: [{ children: { items: [pipeline(ok, failed)] } }] as CockpitDataFlowRow[], totalCount });

    it('needs CommunicationManagement and the System.Communication model', async () => {
      expect(await provider().isVisible()).toBe(true);
      isInRole.mockImplementation((role: string) => role !== COCKPIT_ROLES.CommunicationManagement);
      expect(await provider().isVisible()).toBe(false);
    });

    it('reports nothing below the threshold', async () => {
      dataFlowExecutions.executions.mockReturnValue(flows(500, DEFAULT_FAILED_EXECUTIONS_OPTIONS.minFailed - 1));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
      dataFlowExecutions.executions.mockReturnValue(flows(0, 0));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
    });

    it('builds a warning with the count and a link to the data flows from the shared request', async () => {
      dataFlowExecutions.executions.mockReturnValue(flows(27_279, 802));
      const findings = await firstValueFrom(provider().load(context));
      expect(dataFlowExecutions.executions).toHaveBeenCalledWith('meshmakers');
      expect(findings).toEqual([{
        id: 'pipeline-executions-failed',
        severity: 'warning',
        title: 'Failed pipeline executions in the last 24 h',
        text: '802 of 28,081 executions failed (2.9%). The Data Flows list shows which pipelines fail, their execution history the errors.',
        count: 802,
        links: [{ label: 'Open data flows', target: { kind: 'dataFlows' } }],
        explain: { label: 'Failed pipeline executions in the last 24 h: 802', prompt: 'Why did 802 pipeline executions fail in the last 24 hours?' }
      }]);
    });

    it('is an error above the error count or the failure ratio, and says when the read was capped', async () => {
      dataFlowExecutions.executions.mockReturnValue(flows(100_000, 1500, 800));
      const [byCount] = await firstValueFrom(provider().load(context));
      expect(byCount).toMatchObject({ severity: 'error', count: 1500 });
      expect(byCount.text).toContain('Counted over the first 1 of 800 data flows.');
      dataFlowExecutions.executions.mockReturnValue(flows(30, 20));
      expect((await firstValueFrom(provider().load(context)))[0]).toMatchObject({ severity: 'error', count: 20 });
    });

    it('takes thresholds from COCKPIT_FAILED_EXECUTIONS_OPTIONS and texts from COCKPIT_WIDGET_MESSAGES', async () => {
      TestBed.configureTestingModule({
        providers: [
          { provide: COCKPIT_FAILED_EXECUTIONS_OPTIONS, useValue: { minFailed: 1, errorRatio: null, errorFailed: undefined } },
          { provide: COCKPIT_WIDGET_MESSAGES, useValue: { numberLocale: 'de-DE', attentionFailedExecutionsTitle: 'Fehlgeschlagene Ausführungen (24 h)', attentionFailedExecutionsLink: 'Datenflüsse öffnen' } }
        ]
      });
      dataFlowExecutions.executions.mockReturnValue(flows(1, 1));
      const [finding] = await firstValueFrom(provider().load(context));
      expect(finding).toMatchObject({ severity: 'warning', title: 'Fehlgeschlagene Ausführungen (24 h)', count: 1, links: [{ label: 'Datenflüsse öffnen' }] });
      expect(finding.text).toMatch(/\(50\s%\)/);
    });

    it('decides the severity from count and ratio', () => {
      const options = DEFAULT_FAILED_EXECUTIONS_OPTIONS;
      expect(failedExecutionsSeverity(9, 9, options)).toBeNull();
      expect(failedExecutionsSeverity(10, 1000, options)).toBe('warning');
      expect(failedExecutionsSeverity(10, 50, options)).toBe('error');
      expect(failedExecutionsSeverity(1000, 1_000_000, options)).toBe('error');
      expect(failedExecutionsSeverity(1000, 1_000_000, { ...options, errorFailed: null })).toBe('warning');
      expect(failedExecutionsSeverity(0, 0, { ...options, minFailed: 0 })).toBeNull();
    });

    it('fails soft: a failing query only removes its own findings', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      dataFlowExecutions.executions.mockReturnValue(throwError(() => new Error('boom')));
      TestBed.configureTestingModule({
        providers: [{ provide: COCKPIT_ATTENTION_PROVIDERS, useExisting: FailedExecutionsAttentionProvider, multi: true }]
      });
      const state = await firstValueFrom(TestBed.inject(CockpitAttentionService).state(context).pipe(filter(s => !s.loading)));
      expect(state).toEqual({ findings: [], loading: false, visibleProviders: 1 });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('pipeline-executions-failed'), expect.any(Error));
    });
  });
});
