import { DestroyRef, ElementRef, NgZone, Signal, effect, inject } from '@angular/core';
import { MeshBoardStateService } from '../../services/meshboard-state.service';

/**
 * Reports the natural content height of a cockpit list widget to the board (AB#5558), so the
 * phone tier grows the tile instead of clipping it (`MeshBoardStateService.setWidgetContentHeight`)
 * and, on the desktop tier outside edit mode, the attention list shrinks to its content within its
 * configured rows (AB#5622, `DESKTOP_CONTENT_FIT_TYPES`).
 *
 * `content` must wrap the widget's whole content without any height constraint (no `height` /
 * `min-height` relative to the tile), otherwise a growing tile would report a growing height.
 * The vertical padding of its parent (the scroll container) is added. Call it in an injection
 * context; the observer stops with the component.
 */
export function reportCockpitContentHeight(content: Signal<ElementRef<HTMLElement> | undefined>, widgetId: () => string | undefined): void {
  const state = inject(MeshBoardStateService);
  const zone = inject(NgZone);
  let observer: ResizeObserver | undefined;
  let reportedId: string | undefined;

  const measure = (element: HTMLElement): void => {
    const id = widgetId();
    if (!id) {
      return;
    }
    const parent = element.parentElement;
    const style = parent && typeof getComputedStyle === 'function' ? getComputedStyle(parent) : null;
    const padding = (parseFloat(style?.paddingTop ?? '') || 0) + (parseFloat(style?.paddingBottom ?? '') || 0);
    const height = element.getBoundingClientRect().height + padding;
    reportedId = id;
    zone.run(() => state.setWidgetContentHeight(id, height));
  };

  effect(() => {
    const element = content()?.nativeElement;
    observer?.disconnect();
    observer = undefined;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    observer = zone.runOutsideAngular(() => new ResizeObserver(() => measure(element)));
    observer.observe(element);
  });

  inject(DestroyRef).onDestroy(() => {
    observer?.disconnect();
    if (reportedId) {
      state.setWidgetContentHeight(reportedId, null);
    }
  });
}
