import { OperationProgressStatus, OperationProgressView } from '@meshmakers/shared-ui';
import { CkMethodOperationStateDto } from '../graphQL/globalTypes';
import { CkMethodOperationItem, CkMethodOperationService } from './ck-method-operation.service';

/**
 * Plain-language texts of one method's operations (AB#8448). The CK method reports language-neutral codes only
 * (stage codes, error codes with parameters); the host turns them into text here. Unknown codes fall back to the code
 * itself, so a new stage or error never shows an empty line.
 */
export interface CkMethodOperationTexts {
  /** Plain-language name of the method ("Tenant backup"). */
  methodLabel: string;
  /** Text of a progress stage code ("DUMPING_DATABASE" → "Dumping the database …"). */
  stage?: (stageCode: string, parameters: Readonly<Record<string, string>>) => string | null | undefined;
  /** Text of an error code ("DUMP_FAILED" + reason → "Another backup is running …"). */
  error?: (code: string, parameters: Readonly<Record<string, string>>) => string | null | undefined;
}

/** Texts per qualified method id (`System.Bot/TenantRepository.Dump-1`). */
export type CkMethodOperationTextRegistry = Readonly<Record<string, CkMethodOperationTexts>>;

/** Extra state of the live view that is not part of the operation itself. */
export interface CkMethodOperationViewOptions {
  /** The last status read failed and is retried. */
  connectionLost?: boolean;
  /** The host can download the result of this method (offered once the operation succeeded). */
  canDownload?: boolean;
  /** The host can start the method again (offered for failed and lost operations). */
  canStartNew?: boolean;
}

/** The method label of an operation: the registered text, otherwise the method id. */
export function ckMethodOperationLabel(methodId: string, registry: CkMethodOperationTextRegistry): string {
  return registry[methodId]?.methodLabel ?? methodId;
}

/**
 * Maps an operation of `runtime.operations` to the view of `mm-operation-progress` (`@meshmakers/shared-ui`):
 * ACCEPTED/RUNNING → `running` (percent only when reported), SUCCEEDED → `succeeded` (100 %, expiry),
 * FAILED with `METHOD_OUTCOME_UNKNOWN` / `handler-lost` → `outcomeUnknown`, any other FAILED → `failed` with code and
 * text. A succeeded operation keeps its last progress report on the server (e.g. 80 % "storing"); the view ignores it.
 */
export function toOperationProgressView(
  operation: CkMethodOperationItem,
  registry: CkMethodOperationTextRegistry,
  options: CkMethodOperationViewOptions = {}
): OperationProgressView {
  const texts = registry[operation.methodId];
  const status = statusOf(operation);
  const progressParameters = toRecord(operation.progress?.parameters);
  const errorParameters = toRecord(operation.error?.parameters);
  const stageCode = operation.progress?.stageCode ?? null;
  const errorCode = operation.error?.code ?? null;

  return {
    status,
    methodLabel: texts?.methodLabel ?? operation.methodId,
    startedAt: operation.startedAtUtc ?? operation.acceptedAtUtc,
    completedAt: operation.completedAtUtc ?? null,
    expiresAt: status === 'succeeded' ? operation.expiresAtUtc ?? null : null,
    percent: status === 'running' ? operation.progress?.percent ?? null : status === 'succeeded' ? 100 : null,
    stageText: status === 'running' && stageCode ? texts?.stage?.(stageCode, progressParameters) ?? stageCode : null,
    errorCode: status === 'failed' ? errorCode : null,
    errorMessage: status === 'failed' && errorCode ? texts?.error?.(errorCode, errorParameters) ?? null : null,
    connectionLost: options.connectionLost ?? false,
    canDownload: status === 'succeeded' && (options.canDownload ?? false),
    canStartNew: (status === 'failed' || status === 'outcomeUnknown') && (options.canStartNew ?? false)
  };
}

/** The view of an operation id that `runtime.operations` no longer knows (`OPERATION_NOT_FOUND`). */
export function notAvailableOperationView(methodLabel: string): OperationProgressView {
  return { status: 'notAvailable', methodLabel };
}

function statusOf(operation: CkMethodOperationItem): OperationProgressStatus {
  switch (operation.state) {
    case CkMethodOperationStateDto.SucceededDto:
      return 'succeeded';
    case CkMethodOperationStateDto.FailedDto:
      return CkMethodOperationService.isHandlerLost(operation) ? 'outcomeUnknown' : 'failed';
    default:
      return 'running';
  }
}

function toRecord(parameters: readonly { name: string; value: string }[] | null | undefined): Record<string, string> {
  const record: Record<string, string> = {};
  for (const parameter of parameters ?? []) {
    record[parameter.name] = parameter.value;
  }
  return record;
}
