import { ElementRef, Provider, EnvironmentProviders } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { POPUP_CONTAINER } from '@progress/kendo-angular-popup';

export function tooltipTestProviders(): (Provider | EnvironmentProviders)[] {
  return [
    provideNoopAnimations(),
    { provide: POPUP_CONTAINER, useFactory: () => new ElementRef(document.body) }
  ];
}

export function openTooltips(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('kendo-tooltip, .k-tooltip'))
    .filter(element => !element.parentElement?.closest('kendo-tooltip, .k-tooltip'));
}

export function tooltipText(): string | null {
  const tooltips = openTooltips();
  return tooltips.length === 0 ? null : tooltips.map(tooltip => tooltip.textContent?.trim() ?? '').join(' | ');
}

export function hoverTooltip(fixture: ComponentFixture<unknown>, anchor: Element): string | null {
  anchor.dispatchEvent(new MouseEvent('mouseenter'));
  fixture.detectChanges();
  return tooltipText();
}

export function leaveTooltip(fixture: ComponentFixture<unknown>, anchor: Element): void {
  anchor.dispatchEvent(new MouseEvent('mouseleave'));
  fixture.detectChanges();
}
