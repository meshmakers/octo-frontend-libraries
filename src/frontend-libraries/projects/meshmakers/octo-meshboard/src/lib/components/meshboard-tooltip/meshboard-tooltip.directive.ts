import { DOCUMENT, DestroyRef, Directive, ElementRef, Renderer2, TemplateRef, inject, input } from '@angular/core';
import { Position, TooltipDirective } from '@progress/kendo-angular-tooltip';

/**
 * Shows the given template in a Kendo tooltip, styled by the Kendo theme, while the host is hovered or has
 * keyboard focus; blur hides it, and Escape anywhere in the document hides an open tooltip, also one opened by
 * hover while the focus is elsewhere. The host keeps no `title` attribute, so the browser shows no
 * second, native tooltip; give the host its accessible name with `aria-label` or visible text. The tooltip opens
 * above the host unless `mmMeshBoardTooltipPosition` names another side. With `null` instead of a template it opens
 * nothing, for hosts whose text is optional.
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
  readonly content = input.required<TemplateRef<unknown> | null>({ alias: 'mmMeshBoardTooltip' });
  readonly position = input<Position>('top', { alias: 'mmMeshBoardTooltipPosition' });

  private readonly tooltip = inject(TooltipDirective);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private stopEscapeListener: (() => void) | null = null;

  constructor() {
    this.tooltip.showOn = 'none';
    this.tooltip.filter = '';
    inject(DestroyRef).onDestroy(() => this.removeEscapeListener());
  }

  open(): void {
    const content = this.content();
    if (!content) {
      return;
    }
    this.tooltip.tooltipTemplate = content;
    this.tooltip.position = this.position();
    this.tooltip.show(this.host);
    this.stopEscapeListener ??= this.renderer.listen(this.document, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.close();
      }
    });
  }

  close(): void {
    this.removeEscapeListener();
    this.tooltip.hide();
  }

  private removeEscapeListener(): void {
    this.stopEscapeListener?.();
    this.stopEscapeListener = null;
  }
}
