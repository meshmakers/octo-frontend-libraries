import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { OctoBotAnimation, OctoBotComponent, OctoBotSize } from '../octobot/octobot.component';

/**
 * - `empty`: a list or page has no records yet → OctoBot `idle`.
 * - `no-results`: a search or filter matches nothing → OctoBot `look`.
 * - `error`: loading failed → no figure (errors stay sober), `role="alert"`, optional "Try again".
 */
export type EmptyStateVariant = 'empty' | 'no-results' | 'error';

/** Default English "Try again" label of {@link EmptyStateComponent}. */
export const DEFAULT_EMPTY_STATE_RETRY_LABEL = 'Try again';

/**
 * `mm-empty-state` — the shared empty / no-results / error block of a page or list (AB#3444).
 *
 * One per page or list, never per row. The `empty` and `no-results` variants show one OctoBot
 * (`idle` / `look`, decorative) above the title; the `error` variant shows no figure and announces
 * itself as an alert. Project extra actions (e.g. "New data flow") as content.
 *
 * @example
 * ```html
 * <mm-empty-state heading="No data flows yet" text="Create your first data flow to start processing data." />
 * <mm-empty-state variant="error" heading="The blueprints could not be loaded." showRetry (retry)="load()" />
 * ```
 */
@Component({
  selector: 'mm-empty-state',
  imports: [OctoBotComponent, ButtonComponent],
  template: `
    @if (figure(); as animation) {
      <mm-octobot class="mm-empty-state__figure" [animation]="animation" [size]="size()" loading="eager" />
    }
    <p class="mm-empty-state__title" [attr.role]="variant() === 'error' ? 'alert' : null">{{ heading() }}</p>
    @if (text()) {
      <p class="mm-empty-state__text">{{ text() }}</p>
    }
    @if (variant() === 'error' && showRetry()) {
      <button kendoButton type="button" class="mm-empty-state__retry" (click)="retry.emit()">{{ retryLabel() }}</button>
    }
    <ng-content />
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--theme-space-2, 8px);
      padding: var(--theme-space-6, 24px) var(--theme-space-4, 16px);
      text-align: center;
      color: var(--theme-text-secondary);
    }
    .mm-empty-state__title {
      margin: 0;
      color: var(--theme-text-primary);
      font-weight: 600;
    }
    :host([data-variant='error']) .mm-empty-state__title {
      color: var(--theme-status-error);
    }
    .mm-empty-state__text {
      margin: 0;
      max-width: 48ch;
    }
    .mm-empty-state__retry {
      margin-top: var(--theme-space-1, 4px);
    }
  `],
  host: {
    'class': 'mm-empty-state',
    '[attr.data-variant]': 'variant()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  readonly variant = input<EmptyStateVariant>('empty');
  readonly heading = input.required<string>();
  readonly text = input<string | null | undefined>(null);
  /** OctoBot size of the `empty` / `no-results` variants. Default `md`. */
  readonly size = input<OctoBotSize>('md');
  /** Shows the "Try again" button (error variant only). */
  readonly showRetry = input(false, { transform: booleanAttribute });
  readonly retryLabel = input<string>(DEFAULT_EMPTY_STATE_RETRY_LABEL);
  /** Emitted by the "Try again" button. */
  readonly retry = output<void>();

  protected readonly figure = computed<OctoBotAnimation | null>(() => {
    switch (this.variant()) {
      case 'empty': return 'idle';
      case 'no-results': return 'look';
      default: return null;
    }
  });
}
