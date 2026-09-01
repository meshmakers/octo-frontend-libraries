/**
 * Communication service DTOs for adapter and pipeline management.
 */

/**
 * Describes a pipeline node type with its configuration schema.
 * Returned by GET /adapter/nodes endpoint.
 */
export interface NodeDescriptorDto {
  nodeName: string;
  version: number;
  category: string;
  isTrigger: boolean;
  supportsChildren: boolean;
  configurationSchemaJson: string;
}

/**
 * Parsed node properties from a pipeline definition.
 * Returned by POST /pipelinedefinition/parse-node endpoint.
 */
export interface PipelineNodePropertiesDto {
  nodeType: string;
  nodeIndex: number;
  properties: Record<string, unknown>;
}

/**
 * Deployment state for pipeline operations.
 */
export enum DeploymentState {
  Processing = 0,
  Success = 1,
  Failed = 2
}

/**
 * Result of a pipeline deployment operation.
 */
export interface DeploymentResultDto {
  pipelineRtEntityId: string;
  state: DeploymentState;
  stateMessages: string | null;
}

/**
 * Result of toggling a pipeline's debug capture flag.
 * `appliedToRunningAdapter` is false when the owning adapter was offline — the
 * flag is persisted and takes effect on the next deploy.
 */
export interface SetPipelineDebugResultDto {
  enabled: boolean;
  appliedToRunningAdapter: boolean;
}

/**
 * Pipeline execution data for debugging.
 */
export interface PipelineExecutionDataDto {
  id: string;
  dateTime: Date;
  status?: string;
  durationMs?: number;
  errorMessage?: string;
  hasDebugData?: boolean;
}

/**
 * Severity levels for debug messages.
 */
export enum LoggerSeverity {
  Debug = 0,
  Information = 1,
  Warning = 2,
  Error = 3
}

/**
 * Debug message from pipeline execution.
 */
export interface DebugMessage {
  severity: LoggerSeverity;
  nodePath: string;
  message: string;
  dateTime: Date;
  exceptionMessage: string | null;
}

/**
 * Debug point node in a pipeline execution tree.
 */
export interface DebugPointNode {
  nodeId: string;
  sequenceNumber: number;
  name: string;
  fullPath: string;
  description: string | null;
  children: DebugPointNode[] | null;
}

/**
 * Data captured at a debug point during pipeline execution.
 */
export interface DebugPointDataDto {
  nodePath: string;
  sequenceNumber: number;
  messages: DebugMessage[];
  input: unknown | null;
  output: unknown | null;
}

/**
 * Result of rotating the client secret of an adapter's pipeline service account
 * (`POST /adapter/{adapterRtId}/serviceAccount/rotateSecret`, AB#5032; .NET client
 * surface AB#5048). Shape-identical to the controller's
 * `RotateServiceAccountSecretResultDto` and to the SDK mirror in
 * `Meshmakers.Octo.Communication.Contracts`.
 *
 * 🔴 It deliberately carries **no secret**. The plaintext lives in exactly two
 * places — the tenant's `ServiceAccountConfiguration` entity and the identity
 * client's hash — and a third copy travelling to a browser would end up in
 * devtools, proxy logs and screenshots. Do not add a convenience property; the
 * server pins the absence in its own contract tests.
 */
export interface RotateServiceAccountSecretResultDto {
  /** The identity client whose secret was replaced. */
  clientId: string;
  /**
   * `RtWellKnownName` of the configuration entity holding the new secret — the
   * key the mesh adapter resolves its execution identity by.
   */
  configurationWellKnownName: string;
  /**
   * `true` when the adapter had no service account yet and the call provisioned
   * one instead of rotating. Nothing was invalidated in that case.
   */
  wasCreated: boolean;
  /**
   * `true` when the adapter's pipelines / data flows must be redeployed before
   * the new secret takes effect — the adapter freezes the credentials into the
   * pipeline's `GlobalConfiguration` at registration time and never refreshes
   * them. A UI that drops this flag produces "rotation done, still broken".
   */
  requiresPipelineRedeploy: boolean;
  /** Operator-facing summary, including the redeploy instruction when one is needed. */
  message: string;
}

/**
 * Resource-utilisation snapshot of a running adapter process. Returned by the
 * communication controller's `GET /v1/adapter/{rtId}/metrics` endpoint to back
 * the live CPU / memory sparklines in the UI. Phase 1 of the adapter telemetry
 * feature keeps these in an in-memory ring buffer on the controller, so the
 * series spans roughly the last 30 minutes and resets on controller restart.
 */
export interface AdapterMetricsSampleDto {
  /** Combined `{ckTypeId}@{rtId}` identifier of the reporting adapter. */
  adapterRtEntityId: string;
  /** UTC timestamp the sample was captured at on the adapter side (ISO-8601). */
  timestamp: string;
  /** CPU utilisation in percent (0..100), normalised across all available cores. */
  cpuPercent: number;
  /** Working set of the adapter process in bytes. */
  workingSetBytes: number;
  /** Managed-heap size reported by the GC in bytes. */
  gcHeapBytes: number;
  /** Total thread count of the adapter process. */
  threadCount: number;
}
