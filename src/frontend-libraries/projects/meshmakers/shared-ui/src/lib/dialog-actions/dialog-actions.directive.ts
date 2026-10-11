import { Directive, inject } from '@angular/core';
import { DialogActionsComponent } from '@progress/kendo-angular-dialog';

/**
 * CSS class of every dialog action row. The look behind it (right-aligned, 34 px buttons, token
 * gap, danger-styled destructive confirm) is defined once in the octo-ui styles
 * (`runtime-browser/styles/_dialog-actions.scss`); hand-made footers (`<div class="mm-dialog-actions">`)
 * use the same class and need no CSS of their own.
 */
export const MM_DIALOG_ACTIONS_CLASS = 'mm-dialog-actions';

/**
 * The one action layout of every dialog (AB#6464, Studio action guideline §2.2 / §2.4).
 *
 * Importing the directive is all a component has to do: it matches every `<kendo-dialog-actions>`
 * of that component's template, switches Kendo's default `stretched` layout (every button as wide
 * as the dialog allows, Cancel and confirm look like twins) to `end` and stamps
 * {@link MM_DIALOG_ACTIONS_CLASS}, so the shared styles apply.
 *
 * Button order is the caller's: dismissing buttons first (Cancel), the confirming action last,
 * labelled verb + object; a destructive confirm uses `themeColor="error"` and is rendered as a
 * danger fill by the shared styles.
 *
 * ```ts
 * @Component({ imports: [DialogActionsComponent, MmDialogActionsDirective, ButtonComponent], ... })
 * ```
 * ```html
 * <kendo-dialog-actions>
 *   <button kendoButton>Cancel</button>
 *   <button kendoButton themeColor="error">Delete adapter</button>
 * </kendo-dialog-actions>
 * ```
 */
@Directive({
  // Deliberately an element selector: the directive augments Kendo's own element for every use.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'kendo-dialog-actions',
  host: { class: MM_DIALOG_ACTIONS_CLASS },
})
export class MmDialogActionsDirective {
  constructor() {
    // The layout is fixed Studio-wide: the host component exists before the directive is created, so
    // this wins over Kendo's `stretched` default and over a `layout` attribute in the template.
    inject(DialogActionsComponent, { self: true }).layout = 'end';
  }
}
