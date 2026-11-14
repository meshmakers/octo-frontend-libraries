import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { ProgressBarComponent } from '@progress/kendo-angular-progressbar';
import { OperationProgressStatus, OperationProgressView } from './operation-progress.model';
import { DEFAULT_OPERATION_PROGRESS_MESSAGES, OperationProgressMessages } from './operation-progress.messages';

/** Date format of the start, finish and expiry dates (locale-aware medium date and time). */
const DATE_FORMAT = 'medium';

/**
 * `mm-operation-progress` — the state of one long-running operation (AB#8448, F3.6): state, method, start time, a
 * progress bar while it runs (determinate when a percentage is known, indeterminate otherwise) and the outcome —
 * download with expiry, error code and message, the distinct "outcome unknown" message of a lost handler, or "no
 * longer available". It has no cancel action (cancel is not part of F3.6).
 *
 * Presentational only: the host maps its operation to an {@link OperationProgressView} and handles the outputs. Used
 * inline (a live-view page) and inside the operation progress window
 * ({@link OperationProgressWindowService}). Colours come from theme / Kendo CSS variables only.
 *
 * @example
 * ```html
 * <mm-operation-progress [view]="view()" showOperationsLink (download)="download()" (startNew)="startAgain()" />
 * ```
 */
@Component({
  selector: 'mm-operation-progress',
  imports: [ButtonComponent, ProgressBarComponent, DatePipe],
  templateUrl: './operation-progress.component.html',
  styleUrl: './operation-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-status]': 'view().status'
  }
})
export class OperationProgressComponent {
  /** What to show. */
  readonly view = input.required<OperationProgressView>();
  /** Text overrides (i18n). */
  readonly messages = input<Partial<OperationProgressMessages> | null | undefined>(undefined);
  /** Shows the "Open in My operations" link (the progress window does; the live-view page does not). */
  readonly showOperationsLink = input(false, { transform: booleanAttribute });
  /** Shows the action buttons (Download, Start again) inside the component; a window may render them itself. */
  readonly showActions = input(true, { transform: booleanAttribute });

  /** The user asked for the result file of a succeeded operation. */
  readonly download = output<void>();
  /** The user wants to start the operation again (failed or outcome unknown). */
  readonly startNew = output<void>();
  /** The user wants to see the operation in My operations. */
  readonly openOperations = output<void>();

  protected readonly dateFormat = DATE_FORMAT;

  protected readonly text = computed<OperationProgressMessages>(() => ({
    ...DEFAULT_OPERATION_PROGRESS_MESSAGES,
    ...(this.messages() ?? {})
  }));

  protected readonly stateLabel = computed(() => this.view().stateLabel || this.statusLabel(this.view().status));

  /** Percent clamped to 0–100, or `null` for an indeterminate bar. */
  protected readonly percent = computed<number | null>(() => {
    const value = this.view().percent;
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  });

  protected readonly isFinal = computed(() => this.view().status !== 'running');

  /** "Available for download until …" with the expiry date filled in by the template. */
  protected readonly availableUntilParts = computed(() => {
    const [before, after] = this.text().availableUntil.split('{0}');
    return { before: before ?? '', after: after ?? '' };
  });

  private statusLabel(status: OperationProgressStatus): string {
    const text = this.text();
    switch (status) {
      case 'running':
        return text.running;
      case 'succeeded':
        return text.succeeded;
      case 'failed':
        return text.failed;
      case 'outcomeUnknown':
        return text.outcomeUnknown;
      case 'notAvailable':
        return text.notAvailable;
    }
  }
}
