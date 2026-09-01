import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams} from '@angular/common/http';
import {firstValueFrom, of, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {
  AdapterMetricsSampleDto,
  DeploymentResultDto,
  PipelineExecutionDataDto,
  PipelineNodePropertiesDto,
  DebugPointNode,
  DebugPointDataDto,
  NodeDescriptorDto,
  RotateServiceAccountSecretResultDto,
  SetPipelineDebugResultDto
} from '../shared/communicationDtos';
import {
  MovePipelinesToAdapterRequestDto,
  MovePipelinesToAdapterResponseDto
} from '../shared/movePipelineDtos';
import {DomainConfigurationDto, WorkloadVariableDto} from '../shared/domainDtos';

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
  // Tenant Feature Toggle — Communication
  // ============================================================================

  /**
   * Enables the Communication feature for a tenant. Installs the
   * `System.Communication` CK model and provisions the required runtime wiring
   * for adapters/pools. Errors propagate to the caller.
   */
  async enableCommunication(tenantId: string): Promise<void> {
    if (!this.communicationServicesUrl) {
      throw new Error('Communication services URL is not configured');
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/communication/enable`;
    await firstValueFrom(
      this.httpClient.post<void>(uri, null, {observe: 'response'})
    );
  }

  /**
   * Disables the Communication feature for a tenant. Reversible flag flip that
   * removes the trigger schedules and unloads the tenant from the controller;
   * nothing is undeployed. Refused with 409 while pools or workloads of the
   * tenant are still deployed (AB#4255) — the error body names them. The UI
   * must confirm before calling. Errors propagate to the caller.
   */
  async disableCommunication(tenantId: string): Promise<void> {
    if (!this.communicationServicesUrl) {
      throw new Error('Communication services URL is not configured');
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/communication/disable`;
    await firstValueFrom(
      this.httpClient.post<void>(uri, null, {observe: 'response'})
    );
  }

  // ============================================================================
  // Trigger Deployment
  // ============================================================================

  /**
   * Deploys all data pipeline triggers for a tenant.
   */
  async deployTrigger(tenantId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipelineTrigger/deploy`;
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
  // Adapter Resource Metrics
  // ============================================================================

  /**
   * Fetches the controller's in-memory ring buffer of CPU / memory samples for a
   * given adapter. Used by the UI to drive live sparklines. Returns an empty
   * array when the communication services URL is not configured, when the
   * adapter is not currently connected (controller returns 404), or when no
   * sample has been collected yet.
   *
   * Pass `since` for incremental polling — only samples strictly newer than the
   * supplied UTC timestamp are returned, keeping subsequent refreshes light.
   */
  async getAdapterMetrics(
    tenantId: string,
    adapterRtId: string,
    adapterCkTypeId: string,
    since?: Date
  ): Promise<AdapterMetricsSampleDto[]> {
    if (!this.communicationServicesUrl) {
      return [];
    }

    const rtEntityId = encodeURIComponent(`${adapterCkTypeId}@${adapterRtId}`);
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/adapter/${rtEntityId}/metrics`;
    let params = new HttpParams();
    if (since) {
      params = params.set('since', since.toISOString());
    }

    return firstValueFrom(
      this.httpClient
        .get<AdapterMetricsSampleDto[]>(uri, {params, headers: this.noCacheHeaders})
        .pipe(
          catchError((err: HttpErrorResponse) => {
            // 404 = adapter not connected yet / unknown to the controller;
            // surface as "no samples" so the UI can render an empty state
            // instead of a toast.
            if (err.status === 404) {
              return of([] as AdapterMetricsSampleDto[]);
            }
            return throwError(() => err);
          })
        )
    );
  }

  // ============================================================================
  // Pool-Level Adapter Deployment
  // ============================================================================

  /**
   * Deploys a pool. For Cloud-environment pools, this triggers the central
   * Communication Operator to provision the corresponding CommunicationPool
   * CR and broker secret. Edge-environment pools transition state without
   * any operator notification.
   */
  async deployPool(tenantId: string, poolRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('poolRtId', poolRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/deploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Undeploys a pool. For Cloud-environment pools, this notifies the central
   * Communication Operator to remove the CommunicationPool CR and broker
   * secret.
   */
  async undeployPool(tenantId: string, poolRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('poolRtId', poolRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/undeploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Deploys a single workload (Adapter or Application) via its parent
   * pool. Independent of pool deploy — the workload's pool must already
   * be deployed, but only this workload's helm-install fires.
   */
  async deployWorkload(tenantId: string, workloadRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('workloadRtId', workloadRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/workloads/deploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Returns the named public base domains configured on the Communication
   * Controller instance. Workload editors use the result to populate the
   * hint list / dropdown behind the `{{domain.NAME}}` Hostname template
   * syntax. Read-only; result is identical per tenant on the instance.
   */
  async getDomains(tenantId: string): Promise<DomainConfigurationDto[]> {
    if (!this.communicationServicesUrl) {
      return [];
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/communication/domains`;
    const response = await firstValueFrom(
      this.httpClient.get<DomainConfigurationDto[]>(uri)
    );
    return response ?? [];
  }

  /**
   * Returns every template placeholder a workload can reference in its
   * `hostname`, non-secret `valueOverride.value` or `valuesYaml`. Spans
   * the three families `context.tenantId`, `domain.NAME`, `service.NAME`
   * in one ordered list so the workload editor can offer a single
   * suggestion source. Read-only; result is identical per tenant on the
   * instance.
   */
  async getWorkloadVariables(tenantId: string): Promise<WorkloadVariableDto[]> {
    if (!this.communicationServicesUrl) {
      return [];
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/communication/workload-variables`;
    const response = await firstValueFrom(
      this.httpClient.get<WorkloadVariableDto[]>(uri)
    );
    return response ?? [];
  }

  /**
   * Undeploys a single workload (Adapter or Application). Triggers a
   * helm-uninstall for the workload only; the pool itself stays deployed.
   */
  async undeployWorkload(tenantId: string, workloadRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('workloadRtId', workloadRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pool/workloads/undeploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Reassigns one or more pipelines from their current adapter to a new
   * target adapter (bulk). Each pipeline is moved atomically on the server
   * (Executes-assoc swap in a single transaction); per-pipeline failures
   * are returned in the result list without aborting the batch. When
   * `redeploy=true` is set, the server also re-fires `DeployPipeline` on
   * the target adapter for every successfully moved pipeline — a redeploy
   * failure leaves the move committed and surfaces as a warning in
   * `errorMessage` while `success` stays `true`.
   */
  async movePipelinesToAdapter(
    tenantId: string,
    request: MovePipelinesToAdapterRequestDto
  ): Promise<MovePipelinesToAdapterResponseDto> {
    if (!this.communicationServicesUrl) {
      throw new Error('Communication services URL is not configured');
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipeline/move-to-adapter`;
    return await firstValueFrom(
      this.httpClient.patch<MovePipelinesToAdapterResponseDto>(uri, request)
    );
  }

  /**
   * Encrypts a plaintext value via the controller's at-rest encryption key
   * and returns the sentinel-prefixed ciphertext (`enc:v1:...`). Use this
   * before saving Helm ValueOverride entries flagged IsSecret so the
   * plaintext is never persisted in MongoDB. Already-encrypted values pass
   * through unchanged.
   */
  async encryptValue(tenantId: string, plaintext: string): Promise<string> {
    if (!this.communicationServicesUrl) {
      throw new Error('Communication services URL is not configured');
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/communication/encrypt-value`;
    const response = await firstValueFrom(
      this.httpClient.post<{ciphertext: string}>(uri, {plaintext})
    );
    return response.ciphertext;
  }

  // ============================================================================
  // Pipeline Execution
  // ============================================================================

  /**
   * Executes a data pipeline manually.
   *
   * The optional `pipelineInput` is serialized as the JSON request body and
   * becomes the pipeline's initial DataContext on the adapter side
   * (FromExecutePipelineCommand trigger). Pipelines that were written for an
   * HTTP POST trigger read their payload at `$.body`, so callers mirror that
   * shape by passing `{ body: <document> }`. Omitting it preserves the
   * classic empty-context execution.
   */
  async executePipeline(
    tenantId: string,
    pipelineRtId: string,
    pipelineInput: unknown = null
  ): Promise<PipelineExecutionDataDto | null> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('pipelineRtId', pipelineRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipeline/execute`;

      const response = await firstValueFrom(
        this.httpClient.post<PipelineExecutionDataDto>(uri, pipelineInput, {
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
   * Wakes an on-demand workload that has scaled to zero (`POST
   * /adapter/{workloadRtId}/wake`, OctoMesh AB#4918).
   *
   * Safe to call in any state: the controller no-ops for a workload that is
   * AlwaysOn, already running, or on a tenant without scale-to-zero — it only
   * stamps the activity that keeps the idle watchdog from hibernating it. So the
   * caller does not have to know the lifecycle state to offer the action.
   *
   * **Resolves only once the workload is ready**, which can take the controller's
   * full wake budget (default 60s) — that wait is the point of the call, so show
   * progress rather than a spinner that looks stuck. Rejects with 400 when the
   * wake fails or exceeds the budget; the deployment is then left scaled up for
   * diagnosis and a retry is reasonable.
   */
  async wakeWorkload(tenantId: string, workloadRtId: string): Promise<void> {
    if (!this.communicationServicesUrl) {
      return;
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/adapter/${workloadRtId}/wake`;
    await firstValueFrom(this.httpClient.post<void>(uri, null));
  }

  /**
   * Rotates the client secret of an adapter's pipeline service account (`POST
   * /adapter/{adapterRtId}/serviceAccount/rotateSecret`, OctoMesh AB#5032).
   *
   * The route takes the **plain runtime object id**, not a composite
   * `RtEntityId` like the adapter read endpoints: `Adapter` is polymorphic, so
   * the controller resolves it through the tenant's adapter list.
   *
   * The old secret is invalid the moment this resolves, while a running adapter
   * keeps presenting it until its pipelines are redeployed — the credentials are
   * frozen into the pipeline's `GlobalConfiguration` at registration time. That
   * is what `requiresPipelineRedeploy` and `message` in the result are for; a
   * caller that reduces this to a "done" toast leaves the adapter broken with
   * nothing on screen saying why.
   *
   * Unlike {@link wakeWorkload} this throws rather than no-opping when the
   * communication services URL is missing, and never substitutes a default
   * result: an undescribable rotation reported as success would tell the user
   * "nothing left to do" about a secret that was in fact replaced.
   *
   * Rotation is deliberately not doable from a blueprint — the secret attribute
   * is runtime state, so a blueprint import cannot change a live secret. This
   * call (and `octo-cli`'s `RotateAdapterServiceAccountSecret`) is the supported
   * path.
   */
  async rotateAdapterServiceAccountSecret(
    tenantId: string,
    adapterRtId: string
  ): Promise<RotateServiceAccountSecretResultDto> {
    if (!this.communicationServicesUrl) {
      throw new Error('Communication services URL is not configured');
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/adapter/${adapterRtId}/serviceAccount/rotateSecret`;
    return await firstValueFrom(
      this.httpClient.post<RotateServiceAccountSecretResultDto>(uri, null)
    );
  }

  /**
   * Enables or disables debug capture for a pipeline via the dedicated debug
   * endpoint (`PATCH /pipeline/{id}/debug`). This is the ONLY way debug capture
   * is toggled (AB#4364): deploying a pipeline pushes the persisted flag as-is
   * and never changes it. The endpoint persists the flag exactly as requested
   * and re-pushes the running adapter, so both enable and disable take effect
   * immediately. `appliedToRunningAdapter` is false when the owning adapter is
   * offline (the flag is still persisted and applies on the next deploy).
   */
  async setPipelineDebugging(
    tenantId: string,
    pipelineRtId: string,
    enabled: boolean
  ): Promise<SetPipelineDebugResultDto | null> {
    if (!this.communicationServicesUrl) {
      return null;
    }
    const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipeline/${pipelineRtId}/debug`;
    return await firstValueFrom(
      this.httpClient.patch<SetPipelineDebugResultDto>(uri, {enabled})
    );
  }

  /**
   * Deploys a data flow.
   */
  async deployDataFlow(tenantId: string, dataFlowRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('dataFlowRtId', dataFlowRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/dataFlow/deploy`;

      await firstValueFrom(
        this.httpClient.post<void>(uri, null, {params, observe: 'response'})
      );
    }
  }

  /**
   * Undeploys a data flow.
   */
  async undeployDataFlow(tenantId: string, dataFlowRtId: string): Promise<void> {
    if (this.communicationServicesUrl) {
      const params = new HttpParams().set('dataFlowRtId', dataFlowRtId);
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/dataFlow/undeploy`;

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
  // Node Descriptors
  // ============================================================================

  /**
   * Gets all node descriptors from all connected adapters.
   * Each descriptor contains the node name, version, category, and configuration schema.
   */
  async getNodeDescriptors(tenantId: string): Promise<NodeDescriptorDto[]> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/adapter/nodes`;
      try {
        return await firstValueFrom(
          this.httpClient.get<NodeDescriptorDto[]>(uri)
        );
      } catch {
        return [];
      }
    }
    return [];
  }

  // ============================================================================
  // Pipeline Definition Parsing
  // ============================================================================

  /**
   * Parses a YAML pipeline definition on the backend and returns the properties
   * of a specific node instance identified by type and occurrence index.
   */
  async parseNodeProperties(
    tenantId: string,
    definition: string,
    nodeType: string,
    nodeIndex: number
  ): Promise<PipelineNodePropertiesDto | null> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipelineDefinition/parse-node`;
      try {
        return await firstValueFrom(
          this.httpClient.post<PipelineNodePropertiesDto>(uri, {definition, nodeType, nodeIndex})
        );
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Updates the properties of a specific node in a YAML pipeline definition.
   * Sends the current YAML, node identifier, and new property values to the backend,
   * which returns the updated YAML string.
   */
  async updateNodeProperties(
    tenantId: string,
    definition: string,
    nodeType: string,
    nodeIndex: number,
    properties: Record<string, unknown>
  ): Promise<string | null> {
    if (this.communicationServicesUrl) {
      const uri = `${this.communicationServicesUrl}${tenantId}/v1/pipelineDefinition/update-node`;
      try {
        return await firstValueFrom(
          this.httpClient.put(uri, {definition, nodeType, nodeIndex, properties}, {responseType: 'text'})
        );
      } catch {
        return null;
      }
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
