import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { last } from 'rxjs/operators';
import { AssetRepoService, CkModelService, CONFIGURATION_SERVICE, HealthService, HealthStatus, TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { CockpitBlueprintStatusDtoGQL } from '../graphQL/cockpitBlueprintStatus';
import { BlueprintUpdatesAttentionProvider } from './attention/providers/blueprint-updates.provider';
import { ServicesHealthAttentionProvider } from './attention/providers/services-health.provider';
import { CockpitContextService } from './cockpit-context.service';
import { COCKPIT_LINK_RESOLVER, COCKPIT_ROLES, COCKPIT_VERSION_SOURCE, COCKPIT_VIEWER_ACCESS, provideCockpitWidgetHost } from './cockpit-host';
import { COCKPIT_WIDGET_MESSAGES } from './cockpit-messages';
import {
  COCKPIT_BLUEPRINT_CATALOG_LIMIT,
  CockpitBlueprintStatus,
  CockpitBlueprintStatusService,
  compareBlueprintVersions,
  splitBlueprintId,
  toBlueprintStatus
} from './data/cockpit-blueprint-status.service';
import { CockpitAdapterStatesService } from './data/cockpit-adapter-states.service';
import { CockpitCkModelStatesService } from './data/cockpit-ck-model-states.service';
import { CockpitDataFlowExecutionsService } from './data/cockpit-data-flow-executions.service';
import { COCKPIT_CHILD_TENANT_IDS, CockpitChildTenantsService } from './data/cockpit-child-tenants.service';
import { CockpitServiceHealth, CockpitServiceHealthService, toServiceHealthStatus } from './data/cockpit-service-health.service';
import { blueprintUpdatesKpi, servicesHealthKpi, tenantCountKpi, versionKpi } from './kpi/cockpit-kpi';
import { CockpitKpiService } from './kpi/cockpit-kpi.service';
import { kpiKindOf } from './widgets/cockpit-kpi-widget.component';

const health = (service: CockpitServiceHealth['service'], status: CockpitServiceHealth['status'], name: string = service): CockpitServiceHealth => ({ service, name, status });

const blueprintStatus = (overrides: Partial<CockpitBlueprintStatus> = {}): CockpitBlueprintStatus => ({
  installed: 3, updates: [], catalogRead: 10, catalogTotal: 10, ...overrides
});

describe('system cockpit (AB#5558)', () => {
  describe('blueprint status', () => {
    it('splits blueprint ids at the last dash and compares versions numerically', () => {
      expect(splitBlueprintId('System.UI.TenantCockpit-1.3.0')).toEqual({ name: 'System.UI.TenantCockpit', version: '1.3.0' });
      expect(splitBlueprintId('NoVersion')).toEqual({ name: 'NoVersion', version: '' });
      expect(compareBlueprintVersions('2.10.0', '2.9.0')).toBeGreaterThan(0);
      expect(compareBlueprintVersions('1.0', '1.0.0')).toBe(0);
      expect(compareBlueprintVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    });

    it('finds installed blueprints with a strictly higher catalog version, own ones first', () => {
      const status = toBlueprintStatus({
        blueprints: {
          installations: [
            { blueprintId: 'EnergyCommunity-1.2.0', isDependency: false },
            { blueprintId: 'System.UI.SystemCockpit-1.0.1', isDependency: false },
            { blueprintId: 'Basic-2.0.0', isDependency: true },
            { blueprintId: 'Current-1.0.0', isDependency: false }
          ],
          list: {
            totalCount: 6,
            items: [
              { name: 'EnergyCommunity', version: '1.10.0' },
              { name: 'EnergyCommunity', version: '1.9.0' },
              { name: 'System.UI.SystemCockpit', version: '1.1.0' },
              { name: 'Basic', version: '2.0.0' },
              { name: 'Current', version: '0.9.0' },
              { name: 'Other', version: '5.0.0' }
            ]
          }
        }
      });
      expect(status).toEqual({
        installed: 3,
        updates: [
          { name: 'EnergyCommunity', installedVersion: '1.2.0', availableVersion: '1.10.0', isServiceManaged: false },
          { name: 'System.UI.SystemCockpit', installedVersion: '1.0.1', availableVersion: '1.1.0', isServiceManaged: true }
        ],
        catalogRead: 6,
        catalogTotal: 6
      });
      expect(toBlueprintStatus(null)).toEqual({ installed: 0, updates: [], catalogRead: 0, catalogTotal: 0 });
    });

    it('shares one request per tenant between KPI and attention check', async () => {
      const fetch = vi.fn().mockReturnValue(of({ data: { blueprints: { installations: [], list: { totalCount: 0, items: [] } } } }));
      TestBed.configureTestingModule({ providers: [{ provide: CockpitBlueprintStatusDtoGQL, useValue: { fetch } }] });
      const service = TestBed.inject(CockpitBlueprintStatusService);
      await firstValueFrom(service.status('octosystem', 1000));
      await firstValueFrom(service.status('octosystem', 5000));
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0].variables).toEqual({ take: COCKPIT_BLUEPRINT_CATALOG_LIMIT });
      await firstValueFrom(service.status('octosystem', 20_000));
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('service health', () => {
    const healthService = {
      getIdentityServiceAsync: vi.fn(),
      getAssetRepoServiceHealthAsync: vi.fn(),
      getBotServiceAsync: vi.fn(),
      getCommunicationControllerServiceAsync: vi.fn()
    };

    function setup(config: Record<string, string> | null) {
      vi.clearAllMocks();
      healthService.getIdentityServiceAsync.mockResolvedValue({ status: HealthStatus.Healthy, results: [] });
      healthService.getAssetRepoServiceHealthAsync.mockResolvedValue({ status: HealthStatus.Degraded, results: [] });
      healthService.getBotServiceAsync.mockRejectedValue(new Error('down'));
      healthService.getCommunicationControllerServiceAsync.mockResolvedValue(null);
      TestBed.configureTestingModule({
        providers: [
          { provide: HealthService, useValue: healthService },
          ...(config ? [{ provide: CONFIGURATION_SERVICE, useValue: { config } }] : [])
        ]
      });
      return TestBed.inject(CockpitServiceHealthService);
    }

    it('maps health check states', () => {
      expect(toServiceHealthStatus({ status: HealthStatus.Unhealthy, results: [] })).toBe('unhealthy');
      expect(toServiceHealthStatus(null)).toBe('unknown');
    });

    it('checks every service once per few seconds; a failing call is "unknown"', async () => {
      const service = setup({ communicationServices: 'https://com/' });
      const result = await firstValueFrom(service.services(1000));
      await firstValueFrom(service.services(2000));
      expect(result.map(s => [s.service, s.status])).toEqual([
        ['identity', 'healthy'], ['asset-repository', 'degraded'], ['bot', 'unknown'], ['communication-controller', 'unknown']
      ]);
      expect(healthService.getIdentityServiceAsync).toHaveBeenCalledTimes(1);
    });

    it('leaves out the Communication Controller when it is not part of the installation', async () => {
      const result = await firstValueFrom(setup({ communicationServices: '/' }).services());
      expect(result.map(s => s.service)).toEqual(['identity', 'asset-repository', 'bot']);
    });
  });

  describe('child tenants', () => {
    it('counts the child tenants and keeps the first ids', async () => {
      const getTenants = vi.fn().mockResolvedValue({ totalCount: 7, list: [{ tenantId: 'acme' }, { tenantId: 'demo' }, null] });
      TestBed.configureTestingModule({ providers: [{ provide: AssetRepoService, useValue: { getTenants } }] });
      expect(await firstValueFrom(TestBed.inject(CockpitChildTenantsService).childTenants())).toEqual({ total: 7, firstIds: ['acme', 'demo'] });
      expect(getTenants).toHaveBeenCalledWith(0, COCKPIT_CHILD_TENANT_IDS);
    });
  });

  describe('KPI mapping', () => {
    it('counts tenants with the first names and links to the child tenants', () => {
      expect(tenantCountKpi({ total: 7, firstIds: ['acme', 'demo'] })).toMatchObject({
        id: 'tenant-count', label: 'Tenants', value: '7', detail: 'acme, demo and 5 more', status: 'neutral', statusLabel: 'Registered', link: { kind: 'tenants' }
      });
      expect(tenantCountKpi({ total: 0, firstIds: [] })).toMatchObject({ value: '0', statusLabel: 'No child tenants', detail: undefined });
    });

    it('warns about own blueprint updates; service-managed ones only in the detail', () => {
      const update = (name: string, isServiceManaged = false) => ({ name, installedVersion: '1.0.0', availableVersion: '1.1.0', isServiceManaged });
      expect(blueprintUpdatesKpi(blueprintStatus({ updates: [update('EnergyCommunity'), update('System.UI.SystemCockpit', true)] }))).toMatchObject({
        value: '1', status: 'warning', statusLabel: '1 available', detail: 'EnergyCommunity 1.0.0 → 1.1.0 · 1 service-managed pending', link: { kind: 'blueprints' }
      });
      expect(blueprintUpdatesKpi(blueprintStatus())).toMatchObject({ value: '0', status: 'success', statusLabel: 'Up to date', detail: '3 installed' });
      expect(blueprintUpdatesKpi(blueprintStatus({ installed: 0 }))).toMatchObject({ status: 'neutral', statusLabel: 'No blueprints installed' });
      expect(blueprintUpdatesKpi(blueprintStatus({ catalogRead: 500, catalogTotal: 620 })).detail)
        .toBe('3 installed · based on the first 500 of 620 catalog entries');
    });

    it('counts healthy services; unhealthy or silent ones are errors, degraded a warning', () => {
      expect(servicesHealthKpi([health('identity', 'healthy', 'Identity'), health('bot', 'healthy', 'Bot')])).toMatchObject({
        value: '2 / 2', status: 'success', statusLabel: 'All healthy', detail: 'Identity, Bot', link: { kind: 'serviceHealth', service: 'identity' }
      });
      expect(servicesHealthKpi([health('identity', 'degraded', 'Identity'), health('bot', 'unknown', 'Bot')])).toMatchObject({
        value: '0 / 2', status: 'error', statusLabel: '1 unhealthy', detail: 'Bot: not reachable · Identity: degraded', link: { kind: 'serviceHealth', service: 'bot' }
      });
      expect(servicesHealthKpi([health('identity', 'degraded', 'Identity')])).toMatchObject({ status: 'warning', statusLabel: '1 degraded' });
    });

    it('shows the first version as value and the others in the detail, without a link', () => {
      expect(versionKpi([{ label: 'Refinery Studio', version: '3.4.120' }, { label: 'Libraries', version: '3.4.99' }])).toEqual({
        id: 'version-info', label: 'Version', value: '3.4.120', detail: 'Libraries 3.4.99', status: 'neutral', statusLabel: 'Refinery Studio'
      });
      expect(versionKpi([])).toMatchObject({ value: '—', statusLabel: 'No version information' });
    });

    it('translates the system cockpit texts (AB#5622)', () => {
      const de = { numberLocale: 'de-DE', kpiTenantsLabel: 'Mandanten', kpiTenantsRegistered: 'Registriert', kpiServicesAllHealthy: 'Alle gesund' };
      expect(tenantCountKpi({ total: 1284, firstIds: [] }, de as never)).toMatchObject({ label: 'Mandanten', value: '1.284', statusLabel: 'Registriert' });
      expect(servicesHealthKpi([health('identity', 'healthy')], de as never).statusLabel).toBe('Alle gesund');
    });

    it('maps the widget types to their KPI', () => {
      for (const type of ['tenantCount', 'blueprintUpdates', 'servicesHealth', 'versionInfo'] as const) {
        expect(kpiKindOf({ type } as never)).toBe(type);
      }
    });
  });

  describe('KPI service and attention checks', () => {
    const isInRole = vi.fn();
    const childTenants = { childTenants: vi.fn() };
    const blueprints = { status: vi.fn() };
    const services = { services: vi.fn() };
    let tenantId = 'octosystem';

    function setup(extra: unknown[] = []) {
      TestBed.configureTestingModule({
        providers: [
          CockpitKpiService,
          ServicesHealthAttentionProvider,
          BlueprintUpdatesAttentionProvider,
          { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve(tenantId) },
          { provide: COCKPIT_VIEWER_ACCESS, useValue: { isInRole, isBuilder: () => true } },
          { provide: CkModelService, useValue: { isModelAvailable: vi.fn().mockResolvedValue(true) } },
          { provide: CockpitChildTenantsService, useValue: childTenants },
          { provide: CockpitBlueprintStatusService, useValue: blueprints },
          { provide: CockpitServiceHealthService, useValue: services },
          { provide: CockpitAdapterStatesService, useValue: {} },
          { provide: CockpitCkModelStatesService, useValue: {} },
          { provide: CockpitDataFlowExecutionsService, useValue: {} },
          { provide: CONFIGURATION_SERVICE, useValue: { config: { systemTenantId: 'octosystem' } } },
          ...(extra as never[])
        ]
      });
    }

    beforeEach(() => {
      vi.clearAllMocks();
      tenantId = 'octosystem';
      isInRole.mockReturnValue(true);
      childTenants.childTenants.mockReturnValue(of({ total: 2, firstIds: ['a', 'b'] }));
      blueprints.status.mockReturnValue(of(blueprintStatus()));
      services.services.mockReturnValue(of([health('identity', 'healthy', 'Identity'), health('bot', 'unhealthy', 'Bot'), health('asset-repository', 'unknown', 'Asset Repository')]));
    });

    it('loads the system KPIs for viewers with the role', async () => {
      setup();
      const kpis = TestBed.inject(CockpitKpiService);
      expect(await firstValueFrom(kpis.kpi('tenantCount').pipe(last()))).toMatchObject({ state: 'ready', kpi: { value: '2' } });
      expect(await firstValueFrom(kpis.kpi('blueprintUpdates').pipe(last()))).toMatchObject({ state: 'ready', kpi: { statusLabel: 'Up to date' } });
      expect(await firstValueFrom(kpis.kpi('servicesHealth').pipe(last()))).toMatchObject({ state: 'ready', kpi: { value: '1 / 3', status: 'error' } });
      expect(blueprints.status).toHaveBeenCalledWith('octosystem');
    });

    it('needs TenantManagement for the tenant count and runs no query without it', async () => {
      isInRole.mockImplementation((role: string) => role !== COCKPIT_ROLES.TenantManagement);
      setup();
      expect(await firstValueFrom(TestBed.inject(CockpitKpiService).kpi('tenantCount').pipe(last())))
        .toEqual({ state: 'unavailable', reason: 'Needs the TenantManagement role.', forBuilder: true });
      expect(childTenants.childTenants).not.toHaveBeenCalled();
    });

    it('shows the host versions, or a quiet collapsed tile without them', async () => {
      setup([...provideCockpitWidgetHost({ versions: () => ({ entries: () => [{ label: 'Refinery Studio', version: '1.2.3' }] }) })]);
      expect(TestBed.inject(COCKPIT_VERSION_SOURCE)).toBeTruthy();
      expect(await firstValueFrom(TestBed.inject(CockpitKpiService).kpi('versionInfo').pipe(last()))).toMatchObject({ state: 'ready', kpi: { value: '1.2.3' } });
      TestBed.resetTestingModule();
      setup();
      expect(await firstValueFrom(TestBed.inject(CockpitKpiService).kpi('versionInfo').pipe(last())))
        .toEqual({ state: 'unavailable', reason: 'Not available', forBuilder: false });
    });

    it('reports platform services with problems on the system tenant only, one finding each', async () => {
      setup();
      const provider = TestBed.inject(ServicesHealthAttentionProvider);
      expect(await provider.isVisible({ tenantId: 'octosystem' })).toBe(true);
      expect(await provider.isVisible({ tenantId: 'acme' })).toBe(false);
      const findings = await firstValueFrom(provider.load());
      expect(findings.map(f => [f.id, f.severity, f.title])).toEqual([
        ['services-unhealthy:bot', 'error', 'Bot service is unhealthy'],
        ['services-unhealthy:asset-repository', 'error', 'Asset Repository service is not reachable']
      ]);
      expect(findings[0].links).toEqual([{ label: 'Open health details', target: { kind: 'serviceHealth', service: 'bot' } }]);
      expect(findings[1].text).toContain('does not answer');
    });

    it('lists blueprint updates on the system tenant for AdminPanelManagement, with the count as badge', async () => {
      blueprints.status.mockReturnValue(of(blueprintStatus({ updates: [
        { name: 'EnergyCommunity', installedVersion: '1.0.0', availableVersion: '1.1.0', isServiceManaged: false },
        { name: 'System.UI.SystemCockpit', installedVersion: '1.0.1', availableVersion: '1.1.0', isServiceManaged: true }
      ] })));
      setup([{ provide: COCKPIT_WIDGET_MESSAGES, useValue: { attentionBlueprintUpdatesLink: 'Blueprints öffnen' } }]);
      const provider = TestBed.inject(BlueprintUpdatesAttentionProvider);
      expect(await provider.isVisible({ tenantId: 'octosystem' })).toBe(true);
      expect(await provider.isVisible({ tenantId: 'acme' })).toBe(false);
      const [finding] = await firstValueFrom(provider.load({ tenantId: 'octosystem' }));
      expect(finding).toMatchObject({ id: 'blueprint-updates', severity: 'info', count: 2, links: [{ label: 'Blueprints öffnen', target: { kind: 'blueprints' } }] });
      expect(finding.text).toBe('EnergyCommunity 1.0.0 → 1.1.0. Updates are applied on the Blueprints page. Service-managed: System.UI.SystemCockpit 1.0.1 → 1.1.0 — applied by the owning service when it starts.');
      isInRole.mockReturnValue(false);
      expect(await provider.isVisible({ tenantId: 'octosystem' })).toBe(false);
    });

    it('reports nothing without blueprint updates', async () => {
      setup();
      expect(await firstValueFrom(TestBed.inject(BlueprintUpdatesAttentionProvider).load({ tenantId: 'octosystem' }))).toEqual([]);
    });
  });

  describe('context', () => {
    it('tells the system tenant from the configuration, octosystem without one', () => {
      TestBed.configureTestingModule({ providers: [{ provide: CkModelService, useValue: {} }, { provide: CONFIGURATION_SERVICE, useValue: { config: { systemTenantId: 'rootTenant' } } }] });
      const context = TestBed.inject(CockpitContextService);
      expect(context.isSystemTenant('RootTenant')).toBe(true);
      expect(context.isSystemTenant('octosystem')).toBe(false);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: CkModelService, useValue: {} }] });
      expect(TestBed.inject(CockpitContextService).isSystemTenant('octosystem')).toBe(true);
    });

    it('resolves the new link targets through the host', () => {
      const resolve = vi.fn().mockReturnValue('/octosystem/general/child-tenants');
      TestBed.configureTestingModule({ providers: [{ provide: CkModelService, useValue: {} }, { provide: COCKPIT_LINK_RESOLVER, useValue: { resolve } }] });
      expect(TestBed.inject(CockpitContextService).resolveLink({ kind: 'tenants' }, 'octosystem')).toBe('/octosystem/general/child-tenants');
      expect(resolve).toHaveBeenCalledWith({ kind: 'tenants' }, 'octosystem');
    });
  });
});
