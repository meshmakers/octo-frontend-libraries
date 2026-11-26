import { Directive, ElementRef, TemplateRef, inject, input } from '@angular/core';
import { TooltipDirective } from '@progress/kendo-angular-tooltip';

/**
 * Shows the given template in a Kendo tooltip, styled by the Kendo theme, while the host is hovered or has
 * keyboard focus; Escape and blur hide it. The host keeps no `title` attribute, so the browser shows no
 * second, native tooltip; give the host its accessible name with `aria-label` or visible text.
 *
 * ```html
 * <span tabindex="0" role="img" [attr.aria-label]="text" [mmMeshBoardTooltip]="tip">…</span>
 * <ng-template #tip>{{ text }}</ng-template>
 * ```
 */
@Directive({
  selector: '[mmMeshBoardTooltip]',
  standalone: true,
  hostDirectives: [TooltipDirective],
  host: {
    '(mouseenter)': 'open()',
    '(mouseleave)': 'close()',
    '(focus)': 'open()',
    '(blur)': 'close()',
    '(keydown.escape)': 'close()'
  }
})
export class MeshBoardTooltipDirective {
  readonly content = input.required<TemplateRef<unknown>>({ alias: 'mmMeshBoardTooltip' });

  private readonly tooltip = inject(TooltipDirective);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    this.tooltip.showOn = 'none';
    this.tooltip.filter = '';
    this.tooltip.position = 'top';
  }

  open(): void {
    this.tooltip.tooltipTemplate = this.content();
    this.tooltip.show(this.host);
  }

  close(): void {
    this.tooltip.hide();
  }
}
