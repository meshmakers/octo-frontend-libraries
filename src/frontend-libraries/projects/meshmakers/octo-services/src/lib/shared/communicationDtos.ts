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
