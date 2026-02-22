import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams} from '@angular/common/http';
import {firstValueFrom, of, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {
  DeploymentResultDto,
  PipelineExecutionDataDto,
  DebugPointNode,
  DebugPointDataDto
} from '../shared/communicationDtos';

/**
 * Service for communication controller operations.
 * Handles adapter deployment, pipeline execution, and debugging.
 */
@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);

  /** Headers to prevent browser caching of debug/execution data. */
  private readonly noCacheHeaders = new HttpHeaders()
    .set('Cache-Control', 'no-cache, no-store')
    .set('Pragma', 'no-cache');

  /**
   * Gets the base URL for communication services.
   */
  private get communicationServicesUrl(): string | undefined {
    return this.configurationService.config?.communicationServices;
  }

  // ============================================================================
  // Trigger Deployment
  // ============================================================================

  /**
   * Deploys all data pipeline triggers for a tenant.
   */
  async deployTrigger(tenantId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/dataPipelineTrigger/deploy`;
      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {observe: 'response'})
      );
    }
  }

  // ============================================================================
  // Adapter Configuration Deployment
  // ============================================================================

  /**
   * Deploys an adapter configuration update.
   * This triggers the adapter to reload its configuration.
   */
  async deployAdapterConfigurationUpdate(
    tenantId: string,
    adapterRtId: string,
    adapterCkTypeId: string
  ): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams()
        .set('adapterRtEntityId', `${adapterCkTypeId}@${adapterRtId}`);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/adapter/deployUpdate`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  // ============================================================================
  // Pool-Level Adapter Deployment
  // ============================================================================

  /**
   * Deploys all adapters of a pool.
   */
  async deployAllAdaptersOfPool(tenantId: string, poolRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('poolRtId', poolRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/deployAllAdaptersOfPool`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Undeploys all adapters of a pool.
   */
  async undeployAllAdaptersOfPool(tenantId: string, poolRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('poolRtId', poolRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/undeployAllAdaptersOfPool`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  // ============================================================================
  // Individual Adapter Deployment
  // ============================================================================

  /**
   * Deploys a single adapter to a pool.
   */
  async deployAdapter(
    tenantId: string,
    poolRtId: string,
    adapterRtId: string,
    adapterCkTypeId: string
  ): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams()
        .set('poolRtId', poolRtId)
        .set('adapterRtEntityId', `${adapterCkTypeId}@${adapterRtId}`);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/deployAdapter`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Undeploys a single adapter from a pool.
   */
  async undeployAdapter(
    tenantId: string,
    poolRtId: string,
    adapterRtId: string,
    adapterCkTypeId: string
  ): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams()
        .set('poolRtId', poolRtId)
        .set('adapterRtEntityId', `${adapterCkTypeId}@${adapterRtId}`);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/unDeployAdapter`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  // ============================================================================
  // Pipeline Execution
  // ============================================================================

  /**
   * Executes a data pipeline manually.
   */
  async executePipeline(
    tenantId: string,
    dataPipelineRtId: string
  ): Promise<PipelineExecutionDataDto | null> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('dataPipelineRtId', dataPipelineRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipeline/execute`;

      const response = await firstValueFrom(
        this.httpClient.post<PipelineExecutionDataDto>(uri, null, {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  // ============================================================================
  // Pipeline Deployment
  // ============================================================================

  /**
   * Deploys a pipeline definition to an adapter.
   */
  async deployPipelineDefinition(
    tenantId: string,
    adapterRtId: string,
    adapterCkTypeId: string,
    pipelineRtId: string,
    pipelineCkTypeId: string,
    pipelineDefinition: string | null
  ): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams()
        .set('pipelineRtEntityId', `${pipelineCkTypeId}@${pipelineRtId}`)
        .set('adapterRtEntityId', `${adapterCkTypeId}@${adapterRtId}`)
        .set('Content-Type', 'text/yaml');

      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipeline/deploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, pipelineDefinition, {
          params,
          observe: 'response'
        })
      );
    }
  }

  /**
   * Deploys a data pipeline.
   */
  async deployDataPipeline(tenantId: string, dataPipelineRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('dataPipelineRtId', dataPipelineRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/dataPipeline/deploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Undeploys a data pipeline.
   */
  async undeployDataPipeline(tenantId: string, dataPipelineRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('dataPipelineRtId', dataPipelineRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/dataPipeline/undeploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Gets the deployment status of a pipeline.
   */
  async getPipelineStatus(
    tenantId: string,
    pipelineRtId: string,
    pipelineCkTypeId: string
  ): Promise<DeploymentResultDto | null> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams()
        .set('pipelineRtEntityId', `${pipelineCkTypeId}@${pipelineRtId}`);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipeline/status`;

      return await firstValueFrom(
        this.httpClient.get<DeploymentResultDto>(uri, {params}).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 404) {
              return throwError(() => new Error('No pipeline status found'));
            }
            return throwError(() => new Error('An error occurred'));
          })
        )
      );
    }
    return null;
  }

  // ============================================================================
  // Pipeline Schema
  // ============================================================================

  /**
   * Gets the JSON Schema for a pipeline adapter.
   * Returns null if no schema is available (404).
   */
  async getPipelineSchema(
    tenantId: string,
    adapterRtId: string,
    adapterCkTypeId: string
  ): Promise<Record<string, unknown> | null> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams()
        .set('adapterRtEntityId', `${adapterCkTypeId}@${adapterRtId}`);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/adapter/pipeline-schema`;

      return await firstValueFrom(
        this.httpClient.get<Record<string, unknown>>(uri, {params}).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 404) {
              return of(null);
            }
            return throwError(() => error);
          })
        )
      );
    }
    return null;
  }

  // ============================================================================
  // Pipeline Debugging
  // ============================================================================

  /**
   * Gets pipeline execution history.
   * Returns empty array if no executions found (404).
   */
  async getPipelineExecutions(
    tenantId: string,
    pipelineRtId: string,
    pipelineCkTypeId: string,
    skip: number,
    take: number
  ): Promise<PipelineExecutionDataDto[]> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams()
        .set('skip', skip.toString())
        .set('take', take.toString());
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipelineDebug/${encodeURIComponent(`${pipelineCkTypeId}@${pipelineRtId}`)}`;

      return await firstValueFrom(
        this.httpClient.get<PipelineExecutionDataDto[]>(uri, {params, headers: this.noCacheHeaders}).pipe(
          catchError((error: HttpErrorResponse) => {
            // 404 means no executions found - return empty array
            if (error.status === 404) {
              return of([]);
            }
            return throwError(() => error);
          })
        )
      );
    }
    return [];
  }

  /**
   * Gets the latest pipeline execution.
   * Returns null if no executions found (404).
   */
  async getLatestPipelineExecution(
    tenantId: string,
    pipelineRtId: string,
    pipelineCkTypeId: string
  ): Promise<PipelineExecutionDataDto | null> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipelineDebug/${encodeURIComponent(`${pipelineCkTypeId}@${pipelineRtId}`)}/latest`;

      return await firstValueFrom(
        this.httpClient.get<PipelineExecutionDataDto | null>(uri, {headers: this.noCacheHeaders}).pipe(
          catchError((error: HttpErrorResponse) => {
            // 404 means no executions found - return null
            if (error.status === 404) {
              return of(null);
            }
            return throwError(() => error);
          })
        )
      );
    }
    return null;
  }

  /**
   * Gets debug point nodes for a pipeline execution.
   * Returns null if execution not found (404).
   */
  async getPipelineExecutionDebugPointNodes(
    tenantId: string,
    pipelineRtId: string,
    pipelineCkTypeId: string,
    pipelineExecutionId: string
  ): Promise<DebugPointNode[] | null> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipelineDebug/${encodeURIComponent(`${pipelineCkTypeId}@${pipelineRtId}`)}/${pipelineExecutionId}`;

      return await firstValueFrom(
        this.httpClient.get<DebugPointNode[]>(uri, {headers: this.noCacheHeaders}).pipe(
          catchError((error: HttpErrorResponse) => {
            // 404 means execution not found - return null
            if (error.status === 404) {
              return of(null);
            }
            return throwError(() => error);
          })
        )
      );
    }
    return null;
  }

  /**
   * Gets data captured at a specific debug point.
   * Returns null if debug point not found (404).
   */
  async getDebugPoint(
    tenantId: string,
    pipelineRtId: string,
    pipelineCkTypeId: string,
    pipelineExecutionId: string,
    nodeId: string
  ): Promise<DebugPointDataDto | null> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipelineDebug/${encodeURIComponent(`${pipelineCkTypeId}@${pipelineRtId}`)}/${pipelineExecutionId}/${encodeURIComponent(nodeId)}`;

      return await firstValueFrom(
        this.httpClient.get<DebugPointDataDto>(uri, {headers: this.noCacheHeaders}).pipe(
          catchError((error: HttpErrorResponse) => {
            // 404 means debug point not found - return null
            if (error.status === 404) {
              return of(null);
            }
            return throwError(() => error);
          })
        )
      );
    }
    return null;
  }
}
