import {ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal} from '@angular/core';
import {ButtonComponent} from '@progress/kendo-angular-buttons';
import {DialogActionsComponent, DialogContentBase, DialogRef} from '@progress/kendo-angular-dialog';
import {
  DEFAULT_DANGER_CONFIRMATION_MESSAGES,
  DangerConfirmationMessages,
  DangerConfirmationOptions,
  dangerConfirmNameMatches,
  dangerConfirmTypingToken,
} from './danger-confirmation.model';

let nextId = 0;

/** Selector of the element that gets the initial focus (never the destructive button). */
export function DANGER_CONFIRM_SAFE_FOCUS(requireTypingName: boolean): string {
  return requireTypingName ? '[data-type-to-confirm]' : '[data-action="cancel"]';
}

/** Result of the danger confirmation dialog: `true` only for the confirming button. */
export class DangerConfirmationResult {
  constructor(public readonly confirmed: boolean) {}
}

/**
 * Content of {@link ConfirmationService.showDangerConfirm} (AB#5578): environment notice,
 * target, consequence, optional type-to-confirm input; Cancel left, danger confirm right.
 */
@Component({
  selector: 'mm-danger-confirmation-window',
  standalone: true,
  imports: [DialogActionsComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = options();
    <div class="mm-danger-confirmation" data-dialog="danger-confirm">
      @if (o.environmentLabel) {
        <p class="mm-danger-confirmation__environment" role="alert" data-production-warning>
          {{ environmentNotice() }}
        </p>
      }
      <p class="mm-danger-confirmation__target">
        <span class="mm-danger-confirmation__target-label">{{ messages().target }}:</span>
        <strong data-target>{{ o.targetName }}</strong>
      </p>
      <p class="mm-danger-confirmation__consequence" data-consequence>{{ o.consequence }}</p>
      @if (o.requireTypingName) {
        <label class="mm-danger-confirmation__type" [for]="inputId">{{ typeLabel() }}</label>
        <input
          class="k-textbox k-input k-input-md k-rounded-md mm-danger-confirmation__input"
          [id]="inputId"
          type="text"
          autocomplete="off"
          spellcheck="false"
          data-type-to-confirm
          [value]="typed()"
          (input)="typed.set($any($event.target).value)"
          (keydown.enter)="canConfirm() && confirm()"
        />
      }
    </div>
    <kendo-dialog-actions>
      <button kendoButton data-action="cancel" (click)="cancel()">{{ o.cancelText ?? messages().cancel }}</button>
      <button kendoButton themeColor="error" data-action="confirm" data-danger="true"
              [disabled]="!canConfirm()" (click)="confirm()">{{ o.confirmText }}</button>
    </kendo-dialog-actions>
  `,
  styles: [`
    .mm-danger-confirmation p { margin: 0 0 var(--theme-space-3, 12px); }
    .mm-danger-confirmation__environment {
      padding: var(--theme-space-2, 8px) var(--theme-space-3, 12px);
      border-left: 3px solid var(--theme-status-error, #c0385f);
      border-radius: var(--theme-radius-sm, 4px);
      background: var(--theme-status-error-subtle, rgba(192, 56, 95, 0.08));
      font-weight: 600;
    }
    .mm-danger-confirmation__target-label { color: var(--theme-text-muted, #75829a); margin-right: var(--theme-space-1, 4px); }
    .mm-danger-confirmation__type { display: block; margin-bottom: var(--theme-space-1, 4px); }
    .mm-danger-confirmation__input { width: 100%; }
  `],
})
export class DangerConfirmationWindowComponent extends DialogContentBase {
  private readonly ref: DialogRef;

  /** Set by the service right after opening. */
  readonly options = signal<DangerConfirmationOptions>({title: '', targetName: '', consequence: '', confirmText: ''});
  protected readonly typed = signal('');
  protected readonly inputId = `mm-danger-confirm-${nextId++}`;

  protected readonly messages = computed<DangerConfirmationMessages>(() => ({
    ...DEFAULT_DANGER_CONFIRMATION_MESSAGES,
    ...(this.options().messages ?? {}),
  }));
  /** What has to be typed: the target name, or a non-empty fallback when it is empty. */
  protected readonly typingToken = computed(() => dangerConfirmTypingToken(this.options()));
  protected readonly typeLabel = computed(() => this.messages().typeToConfirm.replace('{name}', this.typingToken()));
  protected readonly environmentNotice = computed(() =>
    this.messages().environmentNotice.replace('{environment}', this.options().environmentLabel ?? ''));
  protected readonly canConfirm = computed(() =>
    !this.options().requireTypingName || dangerConfirmNameMatches(this.typed(), this.typingToken()));

  constructor() {
    const ref = inject(DialogRef);
    super(ref);
    this.ref = ref;
  }

  private readonly host = inject(ElementRef<HTMLElement>);

  /**
   * Initial focus never on the destructive button (Enter must not delete): the type-to-confirm
   * input when required, else Cancel. The service also passes `autoFocusedElement`; this is the
   * fallback for hosts that render the content themselves.
   */
  override ngAfterViewInit(): void {
    super.ngAfterViewInit();
    setTimeout(() => this.focusSafeElement());
  }

  /** Focuses the type-to-confirm input or Cancel (unless focus already sits on one of them). */
  focusSafeElement(): void {
    const root = this.host.nativeElement.closest('.k-dialog') ?? this.host.nativeElement;
    const target = root.querySelector(DANGER_CONFIRM_SAFE_FOCUS(!!this.options().requireTypingName)) as HTMLElement | null;
    target?.focus();
  }

  protected cancel(): void {
    this.ref.close(new DangerConfirmationResult(false));
  }

  protected confirm(): void {
    if (this.canConfirm()) {
      this.ref.close(new DangerConfirmationResult(true));
    }
  }
}
