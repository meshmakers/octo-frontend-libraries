/** Texts of `mm-operation-progress` and the operation progress window (AB#8448). Override per app for i18n. */
export interface OperationProgressMessages {
  stateLabel: string;
  methodLabel: string;
  startedLabel: string;
  finishedLabel: string;
  running: string;
  succeeded: string;
  failed: string;
  outcomeUnknown: string;
  notAvailable: string;
  runningHint: string;
  succeededText: string;
  /** `{0}` is replaced with the expiry date. */
  availableUntil: string;
  failedText: string;
  outcomeUnknownText: string;
  notAvailableText: string;
  connectionLost: string;
  progressLabel: string;
  download: string;
  startNew: string;
  openOperations: string;
  close: string;
}

export const DEFAULT_OPERATION_PROGRESS_MESSAGES: OperationProgressMessages = {
  stateLabel: 'State',
  methodLabel: 'Method',
  startedLabel: 'Started',
  finishedLabel: 'Finished',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  outcomeUnknown: 'Outcome unknown',
  notAvailable: 'No longer available',
  runningHint: 'You can close this window. The operation keeps running; find it again under My operations.',
  succeededText: 'Finished successfully.',
  availableUntil: 'Available for download until {0}.',
  failedText: 'The operation failed.',
  outcomeUnknownText:
    'The service stopped while this operation was running, so its outcome is unknown. The result may be incomplete, ' +
    'and the operation was not restarted automatically. Start it again if you need it.',
  notAvailableText: 'This operation is no longer available. Operations are kept for 7 days after they finish.',
  connectionLost: 'Connection lost. Retrying …',
  progressLabel: 'Progress',
  download: 'Download',
  startNew: 'Start again',
  openOperations: 'Open in My operations',
  close: 'Close',
};
