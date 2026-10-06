import { DestroyRef, inject, NgZone, Signal, signal } from '@angular/core';
import { ChartThemeColors, chartThemeColors, observeThemeChanges } from './chart-categories';

/**
 * The chart text / line colours of the current theme as a signal (AB#5568), for the Kendo chart
 * widgets: Kendo resolves its chart theme once per page load, so after a live theme switch
 * (Dark → Light) legend and axis labels kept the old colours until reload. Bind the colours into
 * the chart options (`[labels]="{ color: chartTheme().text }"`).
 *
 * The signal only emits a new object when the theme signature changes (`observeThemeChanges`),
 * so the option objects keep their references otherwise — a new object per change detection made
 * Kendo redraw the chart on every hover (AB#5568). Call it in an injection context (field
 * initializer); the observer stops with the component.
 */
export function injectChartTheme(): Signal<ChartThemeColors> {
  const zone = inject(NgZone);
  const theme = signal<ChartThemeColors>(chartThemeColors());
  const stop = observeThemeChanges(() => zone.run(() => theme.set(chartThemeColors())));
  inject(DestroyRef).onDestroy(stop);
  return theme.asReadonly();
}
