/**
 * Display state of a long-running operation (AB#8448, F3.6): what `mm-operation-progress` renders.
 *
 * - `running` — accepted or running; a progress bar (determinate when `percent` is set, otherwise indeterminate).
 * - `succeeded` — finished; optional download with its expiry date.
 * - `failed` — finished with an error code and message.
 * - `outcomeUnknown` — the platform lost the handler (`METHOD_OUTCOME_UNKNOWN` / `handler-lost`): the result may be
 *   incomplete, the operation was not restarted.
 * - `notAvailable` — the operation id is unknown, expired or not readable (`OPERATION_NOT_FOUND`).
 */
export type OperationProgressStatus = 'running' | 'succeeded' | 'failed' | 'outcomeUnknown' | 'notAvailable';

/**
 * Language-neutral input of `mm-operation-progress`. The host maps its operation (e.g. a CK method operation of
 * `@meshmakers/octo-services`) to this view; the component holds no transport logic.
 */
export interface OperationProgressView {
  status: OperationProgressStatus;
  /** Plain-language name of what runs ("Tenant backup"). */
  methodLabel: string;
  /** Plain-language state ("Running", "Succeeded" …); defaults to the message of `status`. */
  stateLabel?: string | null;
  /** When the work started (or was accepted). */
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  /** Until when the result can be downloaded (`expiresAtUtc`). */
  expiresAt?: Date | string | null;
  /** Done in percent (0–100); `null`/`undefined` renders an indeterminate bar. */
  percent?: number | null;
  /** Current step in plain language ("Dumping the database …"). */
  stageText?: string | null;
  /** Error code of a failed operation (`DUMP_FAILED`). */
  errorCode?: string | null;
  /** Plain-language error message. */
  errorMessage?: string | null;
  /** The last status read failed; the host retries (a hint line is shown, the state stays). */
  connectionLost?: boolean;
  /** A succeeded operation offers a download. */
  canDownload?: boolean;
  /** A failed or lost operation offers "Start new …". */
  canStartNew?: boolean;
}
