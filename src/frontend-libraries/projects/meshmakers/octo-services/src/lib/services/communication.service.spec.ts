import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {CommunicationService} from './communication.service';
import {CONFIGURATION_SERVICE, IConfigurationService} from './configuration.service';
import {AddInConfiguration} from '../shared/addInConfiguration';
import {DeploymentState} from '../shared/communicationDtos';

describe('CommunicationService', () => {
  let service: CommunicationService;
  let httpMock: HttpTestingController;
  let mockConfigService: jasmine.SpyObj<IConfigurationService>;

  const mockConfig: AddInConfiguration = {
    communicationServices: 'https://api.example.com/communication/',
    assetServices: 'https://api.example.com/asset/',
    botServices: 'https://api.example.com/bot/',
    meshAdapterUrl: '',
    aiServices: '',
    reportingServices: 'https://api.example.com/reporting/',
    crateDbAdminUrl: '',
    issuer: '',
    grafanaUrl: '',
    systemTenantId: 'system',
    clientId: 'test-client',
    redirectUri: '',
    postLogoutRedirectUri: ''
  };

  const tenantId = 'test-tenant';

  beforeEach(() => {
    mockConfigService = jasmine.createSpyObj<IConfigurationService>('ConfigurationService', [], {
      config: mockConfig
    });

    TestBed.configureTestingModule({
      providers: [
        CommunicationService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {provide: CONFIGURATION_SERVICE, useValue: mockConfigService}
      ]
    });

    service = TestBed.inject(CommunicationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('enableCommunication', () => {
    it('should POST the tenant-scoped enable endpoint', async () => {
      const promise = service.enableCommunication(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/communication/enable`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null);

      await promise;
    });

    it('should propagate errors', async () => {
      const promise = service.enableCommunication(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/communication/enable`
      );
      req.flush({errorMessage: 'boom'}, {status: 500, statusText: 'Server Error'});

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('disableCommunication', () => {
    it('should POST the tenant-scoped disable endpoint', async () => {
      const promise = service.disableCommunication(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/communication/disable`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null);

      await promise;
    });

    it('should propagate errors', async () => {
      const promise = service.disableCommunication(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/communication/disable`
      );
      req.flush({errorMessage: 'boom'}, {status: 500, statusText: 'Server Error'});

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('deployTrigger', () => {
    it('should call the correct endpoint', async () => {
      const promise = service.deployTrigger(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/pipelineTrigger/deploy`
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('deployAdapterConfigurationUpdate', () => {
    it('should call the correct endpoint with rtEntityId param', async () => {
      const adapterRtId = 'adapter-123';
      const adapterCkTypeId = 'System.Communication/Adapter';

      const promise = service.deployAdapterConfigurationUpdate(
        tenantId,
        adapterRtId,
        adapterCkTypeId
      );

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/adapter/deployUpdate` &&
        request.params.get('adapterRtEntityId') === `${adapterCkTypeId}@${adapterRtId}`
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('deployPool', () => {
    it('should call the correct endpoint with poolRtId param', async () => {
      const poolRtId = 'pool-123';

      const promise = service.deployPool(tenantId, poolRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pool/deploy` &&
        request.params.get('poolRtId') === poolRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('undeployPool', () => {
    it('should call the correct endpoint with poolRtId param', async () => {
      const poolRtId = 'pool-123';

      const promise = service.undeployPool(tenantId, poolRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pool/undeploy` &&
        request.params.get('poolRtId') === poolRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('executePipeline', () => {
    it('should return pipeline execution data', async () => {
      const pipelineRtId = 'pipeline-123';
      const expectedResult = {id: 'exec-1', dateTime: new Date()};

      const promise = service.executePipeline(tenantId, pipelineRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pipeline/execute` &&
        request.params.get('pipelineRtId') === pipelineRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(expectedResult);

      const result = await promise;
      expect(result?.id).toBe('exec-1');
    });
  });

  describe('setPipelineDebugging', () => {
    it('PATCHes the dedicated debug endpoint with the enabled flag', async () => {
      const pipelineRtId = 'pipeline-123';

      const promise = service.setPipelineDebugging(tenantId, pipelineRtId, false);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/pipeline/${pipelineRtId}/debug`
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({enabled: false});
      req.flush({enabled: false, appliedToRunningAdapter: true});

      const result = await promise;
      expect(result?.enabled).toBe(false);
      expect(result?.appliedToRunningAdapter).toBe(true);
    });
  });

  describe('wakeWorkload', () => {
    it('POSTs to the wake endpoint of the workload', async () => {
      const workloadRtId = 'workload-123';

      const promise = service.wakeWorkload(tenantId, workloadRtId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/adapter/${workloadRtId}/wake`
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });

    it('rejects when the wake fails so the caller can tell the user', async () => {
      const promise = service.wakeWorkload(tenantId, 'workload-123');

      httpMock
        .expectOne(`${mockConfig.communicationServices}${tenantId}/v1/adapter/workload-123/wake`)
        .flush('Wake timed out', {status: 400, statusText: 'Bad Request'});

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('deployDataFlow', () => {
    it('should call the correct endpoint', async () => {
      const dataFlowRtId = 'pipeline-123';

      const promise = service.deployDataFlow(tenantId, dataFlowRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/dataFlow/deploy` &&
        request.params.get('dataFlowRtId') === dataFlowRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('undeployDataFlow', () => {
    it('should call the correct endpoint', async () => {
      const dataFlowRtId = 'pipeline-123';

      const promise = service.undeployDataFlow(tenantId, dataFlowRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/dataFlow/undeploy` &&
        request.params.get('dataFlowRtId') === dataFlowRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('getPipelineStatus', () => {
    it('should return deployment result', async () => {
      const pipelineRtId = 'pipeline-123';
      const pipelineCkTypeId = 'System.Communication/DataFlow';
      const expectedResult = {
        pipelineRtEntityId: `${pipelineCkTypeId}@${pipelineRtId}`,
        state: DeploymentState.Success,
        stateMessages: null
      };

      const promise = service.getPipelineStatus(tenantId, pipelineRtId, pipelineCkTypeId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pipeline/status` &&
        request.params.get('pipelineRtEntityId') === `${pipelineCkTypeId}@${pipelineRtId}`
      );
      expect(req.request.method).toBe('GET');
      req.flush(expectedResult);

      const result = await promise;
      expect(result?.state).toBe(DeploymentState.Success);
    });
  });

  describe('getPipelineExecutions', () => {
    it('should return pipeline execution history', async () => {
      const pipelineRtId = 'pipeline-123';
      const pipelineCkTypeId = 'System.Communication/DataFlow';
      const expectedResult = [
        {id: 'exec-1', dateTime: new Date()},
        {id: 'exec-2', dateTime: new Date()}
      ];

      const promise = service.getPipelineExecutions(tenantId, pipelineRtId, pipelineCkTypeId, 0, 10);

      const encodedEntityId = encodeURIComponent(`${pipelineCkTypeId}@${pipelineRtId}`);
      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pipelineDebug/${encodedEntityId}` &&
        request.params.get('skip') === '0' &&
        request.params.get('take') === '10'
      );
      expect(req.request.method).toBe('GET');
      req.flush(expectedResult);

      const result = await promise;
      expect(result.length).toBe(2);
    });
  });

  describe('getLatestPipelineExecution', () => {
    it('should return the latest execution', async () => {
      const pipelineRtId = 'pipeline-123';
      const pipelineCkTypeId = 'System.Communication/DataFlow';
      const expectedResult = {id: 'exec-latest', dateTime: new Date()};

      const promise = service.getLatestPipelineExecution(tenantId, pipelineRtId, pipelineCkTypeId);

      const encodedEntityId = encodeURIComponent(`${pipelineCkTypeId}@${pipelineRtId}`);
      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/pipelineDebug/${encodedEntityId}/latest`
      );
      expect(req.request.method).toBe('GET');
      req.flush(expectedResult);

      const result = await promise;
      expect(result?.id).toBe('exec-latest');
    });
  });

  describe('when communicationServices is not configured', () => {
    beforeEach(() => {
      Object.defineProperty(mockConfigService, 'config', {
        get: () => ({...mockConfig, communicationServices: ''})
      });
    });

    it('deployTrigger should not make HTTP call', async () => {
      await service.deployTrigger(tenantId);
      httpMock.expectNone(() => true);
    });

    it('executePipeline should return null', async () => {
      const result = await service.executePipeline(tenantId, 'pipeline-123');
      expect(result).toBeNull();
      httpMock.expectNone(() => true);
    });

    it('getPipelineExecutions should return empty array', async () => {
      const result = await service.getPipelineExecutions(tenantId, 'p1', 'type', 0, 10);
      expect(result).toEqual([]);
      httpMock.expectNone(() => true);
    });
  });

  describe('movePipelinesToAdapter', () => {
    it('should PATCH the move endpoint with the request body and return the response', async () => {
      const promise = service.movePipelinesToAdapter(tenantId, {
        pipelineRtIds: ['p1', 'p2'],
        targetAdapterRtId: 'adapter-new',
        redeploy: true
      });

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/pipeline/move-to-adapter`
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        pipelineRtIds: ['p1', 'p2'],
        targetAdapterRtId: 'adapter-new',
        redeploy: true
      });

      req.flush({
        results: [
          {
            pipelineRtId: 'p1',
            success: true,
            oldAdapterRtId: 'adapter-old',
            newAdapterRtId: 'adapter-new',
            errorMessage: null
          },
          {
            pipelineRtId: 'p2',
            success: false,
            oldAdapterRtId: null,
            newAdapterRtId: null,
            errorMessage: 'pipeline not found'
          }
        ]
      });

      const result = await promise;
      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBeTrue();
      expect(result.results[0].newAdapterRtId).toBe('adapter-new');
      expect(result.results[1].success).toBeFalse();
      expect(result.results[1].errorMessage).toBe('pipeline not found');
    });
  });

  describe('getWorkloadVariables', () => {
    it('should call the correct endpoint and return the response', async () => {
      const promise = service.getWorkloadVariables(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/communication/workload-variables`
      );
      expect(req.request.method).toBe('GET');
      req.flush([
        {placeholder: '{{context.tenantId}}', description: 'tenant id', sampleValue: null},
        {placeholder: '{{domain.default}}', description: 'default domain', sampleValue: 'staging.octo-mesh.com'},
        {placeholder: '{{service.authority}}', description: 'identity authority', sampleValue: 'https://identity.staging.octo-mesh.com'}
      ]);

      const result = await promise;
      expect(result.length).toBe(3);
      expect(result[0].placeholder).toBe('{{context.tenantId}}');
      expect(result[0].sampleValue).toBeNull();
      expect(result[2].placeholder).toBe('{{service.authority}}');
      expect(result[2].sampleValue).toBe('https://identity.staging.octo-mesh.com');
    });

    it('should return empty array when communication services URL is not configured', async () => {
      // Re-create service against a config without communicationServices to
      // exercise the early-return branch — same pattern as getDomains and
      // the deploy* methods.
      const emptyConfigService = jasmine.createSpyObj<IConfigurationService>(
        'ConfigurationService', [], {
          config: {...mockConfig, communicationServices: ''}
        });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          CommunicationService,
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
          {provide: CONFIGURATION_SERVICE, useValue: emptyConfigService}
        ]
      });
      const localService = TestBed.inject(CommunicationService);
      const localHttp = TestBed.inject(HttpTestingController);

      const result = await localService.getWorkloadVariables(tenantId);

      expect(result).toEqual([]);
      localHttp.verify();
    });
  });

  describe('getAdapterMetrics', () => {
    const adapterRtId = 'adapter-123';
    const adapterCkTypeId = 'System.Communication/Adapter';
    const expectedRtEntityId = encodeURIComponent(`${adapterCkTypeId}@${adapterRtId}`);

    it('GETs the controller endpoint and returns parsed samples', async () => {
      const promise = service.getAdapterMetrics(tenantId, adapterRtId, adapterCkTypeId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/adapter/${expectedRtEntityId}/metrics`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('since')).toBe(false);
      req.flush([
        {adapterRtEntityId: `${adapterCkTypeId}@${adapterRtId}`, timestamp: '2026-06-05T17:00:00Z',
         cpuPercent: 12.5, workingSetBytes: 100, gcHeapBytes: 50, threadCount: 4}
      ]);

      const result = await promise;
      expect(result.length).toBe(1);
      expect(result[0].cpuPercent).toBe(12.5);
    });

    it('appends the since query parameter for incremental polling', async () => {
      const since = new Date('2026-06-05T17:00:00Z');
      const promise = service.getAdapterMetrics(tenantId, adapterRtId, adapterCkTypeId, since);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/adapter/${expectedRtEntityId}/metrics` &&
        request.params.get('since') === since.toISOString()
      );
      req.flush([]);
      await promise;
    });

    it('returns an empty array on 404 (adapter not connected) instead of throwing', async () => {
      // The controller surfaces "tenant not enabled" / "adapter not loaded" as 404.
      // The UI must render an empty sparkline, not an error toast.
      const promise = service.getAdapterMetrics(tenantId, adapterRtId, adapterCkTypeId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/adapter/${expectedRtEntityId}/metrics`
      );
      req.flush({errorMessage: 'Adapter not loaded'}, {status: 404, statusText: 'Not Found'});

      const result = await promise;
      expect(result).toEqual([]);
    });

    it('returns empty array when the communication services URL is not configured', async () => {
      const emptyConfig = {...mockConfig, communicationServices: ''};
      const emptyConfigService = jasmine.createSpyObj<IConfigurationService>('ConfigurationService', [], {
        config: emptyConfig
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          CommunicationService,
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
          {provide: CONFIGURATION_SERVICE, useValue: emptyConfigService}
        ]
      });
      const localService = TestBed.inject(CommunicationService);
      const localHttp = TestBed.inject(HttpTestingController);

      const result = await localService.getAdapterMetrics(tenantId, adapterRtId, adapterCkTypeId);

      expect(result).toEqual([]);
      localHttp.verify();
    });
  });
});
