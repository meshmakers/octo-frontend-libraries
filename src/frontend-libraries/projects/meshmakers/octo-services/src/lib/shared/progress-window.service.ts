import { Observable } from 'rxjs';
import { ProgressValue } from './progress-value';

/**
 * Reference to an open progress dialog. Provides close() to dismiss.
 */
export interface ProgressDialogRef {
  close(): void;
}

export interface ProgressWindowOptions {
  isCancelOperationAvailable?: boolean;
  cancelOperation?: () => void;
  width?: number;
  height?: number | string;
}

/**
 * Abstract progress window service.
 * Consuming apps must provide a concrete implementation (Material or Kendo).
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * import { ProgressWindowService as AbstractProgressWindowService } from '@meshmakers/octo-services';
 * import { ProgressWindowService } from '@meshmakers/shared-ui-legacy'; // Material impl
 *
 * providers: [
 *   { provide: AbstractProgressWindowService, useClass: ProgressWindowService }
 * ]
 * ```
 */
export abstract class ProgressWindowService {
  abstract showDeterminateProgress(
    title: string,
    progress: Observable<ProgressValue>,
    options?: Partial<ProgressWindowOptions>
  ): ProgressDialogRef;

  abstract showIndeterminateProgress(
    title: string,
    progress: Observable<ProgressValue>,
    options?: Partial<ProgressWindowOptions>
  ): ProgressDialogRef;
}
