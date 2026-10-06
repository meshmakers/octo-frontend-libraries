import {ChangeDetectionStrategy, booleanAttribute, Component, ViewEncapsulation, computed, input, output} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ButtonModule} from '@progress/kendo-angular-buttons';
import {SVGIconModule} from '@progress/kendo-angular-icons';
import {
  MmAction,
  MmActionEvent,
  actionAccessibleName,
  actionTooltip,
  isActionDisabled,
} from './action.model';

/** Where the button sits; drives size, icon size (16 px rows, 20 px toolbars) and emphasis. */
export type MmActionContext = 'row' | 'toolbar' | 'page';

/** What the button shows. Icon-only buttons always get a tooltip and an accessible name. */
export type MmActionDisplay = 'icon' | 'text' | 'icon-text';

let nextReasonId = 0;

/**
 * One action as a button (AB#5570), rendered from a shared {@link MmAction} definition.
 *
 * - `display="icon"`: icon-only, native tooltip = label (+ disabled reason), `aria-label`
 *   = label + `targetLabel` ("Delete dump Encrypt run 2026-10-06 17:09").
 * - `display="text"` / `"icon-text"`: visible label; `targetLabel` still extends the
 *   accessible name when the same label repeats (one per row).
 * - Disabled (`disabledReason`): stays focusable, `aria-disabled="true"`, the reason is
 *   linked via `aria-describedby` and shown in the tooltip; clicks are swallowed.
 * - `danger`: Kendo `themeColor="error"`. The consumer confirms before acting.
 * - `primary` (page/toolbar context only): solid primary button for the one main action.
 * - `link`: rendered as a real router link (`<a kendoButton [routerLink]>`, so open-in-new-tab
 *   works); a disabled link action renders as a disabled button.
 *
 * ```html
 * <mm-action-button [action]="refresh" context="toolbar" (triggered)="reload()" />
 * <mm-action-button [action]="newAdapter" context="page" display="icon-text" primary (triggered)="create()" />
 * ```
 */
@Component({
  selector: 'mm-action-button',
  standalone: true,
  imports: [ButtonModule, RouterLink, SVGIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {class: 'mm-action-button-host'},
  template: `
    @if (action().link && !disabled()) {
      <!-- kendoButton only matches <button>: the link carries the same Kendo button classes itself. -->
      <a
        class="mm-action-button"
        [class]="linkClasses()"
        [class.mm-action-button--danger]="!!action().danger"
        [class.mm-action-button--icon-only]="iconOnly()"
        [class.mm-action-button--toolbar]="context() !== 'row'"
        [attr.title]="tooltip()"
        [attr.aria-label]="ariaLabel()"
        [attr.data-action]="action().id"
        [routerLink]="$any(action().link!.commands)"
        [queryParams]="action().link!.queryParams ?? null"
        (click)="onClick($event)"
      >@if (showIcon()) {<kendo-svgicon class="k-button-icon" [icon]="action().icon!" />}@if (!iconOnly()) {<span class="k-button-text">{{ action().label }}</span>}</a>
    } @else {
      <button
        kendoButton
        type="button"
      class="mm-action-button"
      [class.mm-action-button--disabled]="disabled()"
      [class.mm-action-button--danger]="!!action().danger"
      [class.mm-action-button--icon-only]="iconOnly()"
      [class.mm-action-button--toolbar]="context() !== 'row'"
      [svgIcon]="showIcon() ? action().icon! : $any(undefined)"
      [size]="context() === 'row' ? 'small' : 'medium'"
      [fillMode]="primary() && !action().danger ? 'solid' : 'flat'"
      [themeColor]="action().danger ? 'error' : primary() ? 'primary' : 'base'"
      [attr.title]="tooltip()"
      [attr.aria-label]="ariaLabel()"
      [attr.data-action]="action().id"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.aria-describedby]="disabled() ? reasonId : null"
        (click)="onClick($event)"
      >@if (!iconOnly()) { {{ action().label }} }</button>
    }
    @if (disabled()) {
      <span class="mm-action-button__reason" [id]="reasonId">{{ action().disabledReason }}</span>
    }
  `,
  styles: [`
    .mm-action-button-host { display: inline-flex; }
    .mm-action-button--toolbar.mm-action-button--icon-only .k-svg-icon { width: 20px; height: 20px; }
    .mm-action-button--disabled { opacity: 0.45; cursor: not-allowed; }
    .mm-action-button__reason {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
  `],
})
export class ActionButtonComponent<TId extends string = string> {
  /** The action definition. */
  readonly action = input.required<MmAction<TId>>();
  /** Name of the target (row) for the accessible name; required for repeated row actions. */
  readonly targetLabel = input<string | null | undefined>(undefined);
  readonly context = input<MmActionContext>('row');
  readonly display = input<MmActionDisplay>('icon');
  /** Solid primary emphasis — at most one per page header / toolbar. */
  readonly primary = input(false, {transform: booleanAttribute});

  /** Fires for enabled actions only. */
  readonly triggered = output<MmActionEvent<TId>>();

  protected readonly reasonId = `mm-action-reason-${nextReasonId++}`;
  protected readonly disabled = computed(() => isActionDisabled(this.action()));
  /** Icon-only needs an icon; without one the button falls back to its text. */
  protected readonly iconOnly = computed(() => this.display() === 'icon' && !!this.action().icon);
  protected readonly showIcon = computed(() => this.display() !== 'text' && !!this.action().icon);
  protected readonly tooltip = computed(() =>
    this.iconOnly() || this.disabled() ? actionTooltip(this.action()) : null);
  protected readonly ariaLabel = computed(() =>
    this.iconOnly() || this.targetLabel() ? actionAccessibleName(this.action(), this.targetLabel()) : null);

  /** Kendo button classes for the link variant (same look as `button[kendoButton]`). */
  protected readonly linkClasses = computed(() => {
    const size = this.context() === 'row' ? 'sm' : 'md';
    const fill = this.primary() && !this.action().danger ? 'solid' : 'flat';
    const theme = this.action().danger ? 'error' : this.primary() ? 'primary' : 'base';
    return ['k-button', `k-button-${size}`, `k-button-${fill}`, `k-button-${theme}`, 'k-rounded-md',
      this.iconOnly() ? 'k-icon-button' : ''].filter(Boolean).join(' ');
  });

  protected onClick(event: Event): void {
    if (this.disabled()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const action = this.action();
    this.triggered.emit({id: action.id, action});
  }
}
