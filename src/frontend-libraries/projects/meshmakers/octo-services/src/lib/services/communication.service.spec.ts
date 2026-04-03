import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
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
        provideHttpClient(),
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

  describe('deployTrigger', () => {
    it('should call the correct endpoint', async () => {
      const promise = service.deployTrigger(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.communicationServices}${tenantId}/v1/dataPipelineTrigger/deploy`
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

  describe('deployAllAdaptersOfPool', () => {
    it('should call the correct endpoint with poolRtId param', async () => {
      const poolRtId = 'pool-123';

      const promise = service.deployAllAdaptersOfPool(tenantId, poolRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pool/deployAllAdaptersOfPool` &&
        request.params.get('poolRtId') === poolRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('undeployAllAdaptersOfPool', () => {
    it('should call the correct endpoint with poolRtId param', async () => {
      const poolRtId = 'pool-123';

      const promise = service.undeployAllAdaptersOfPool(tenantId, poolRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pool/undeployAllAdaptersOfPool` &&
        request.params.get('poolRtId') === poolRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('deployAdapter', () => {
    it('should call the correct endpoint with pool and adapter params', async () => {
      const poolRtId = 'pool-123';
      const adapterRtId = 'adapter-123';
      const adapterCkTypeId = 'System.Communication/Adapter';

      const promise = service.deployAdapter(tenantId, poolRtId, adapterRtId, adapterCkTypeId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pool/deployAdapter` &&
        request.params.get('poolRtId') === poolRtId &&
        request.params.get('adapterRtEntityId') === `${adapterCkTypeId}@${adapterRtId}`
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('undeployAdapter', () => {
    it('should call the correct endpoint with pool and adapter params', async () => {
      const poolRtId = 'pool-123';
      const adapterRtId = 'adapter-123';
      const adapterCkTypeId = 'System.Communication/Adapter';

      const promise = service.undeployAdapter(tenantId, poolRtId, adapterRtId, adapterCkTypeId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pool/unDeployAdapter` &&
        request.params.get('poolRtId') === poolRtId &&
        request.params.get('adapterRtEntityId') === `${adapterCkTypeId}@${adapterRtId}`
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await promise;
    });
  });

  describe('executePipeline', () => {
    it('should return pipeline execution data', async () => {
      const dataPipelineRtId = 'pipeline-123';
      const expectedResult = {id: 'exec-1', dateTime: new Date()};

      const promise = service.executePipeline(tenantId, dataPipelineRtId);

      const req = httpMock.expectOne(request =>
        request.url === `${mockConfig.communicationServices}${tenantId}/v1/pipeline/execute` &&
        request.params.get('dataPipelineRtId') === dataPipelineRtId
      );
      expect(req.request.method).toBe('POST');
      req.flush(expectedResult);

      const result = await promise;
      expect(result?.id).toBe('exec-1');
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
});
