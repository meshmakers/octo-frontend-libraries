import { ApplicationRef, ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MeshBoardTooltipDirective } from './meshboard-tooltip.directive';
import { hoverTooltip, leaveTooltip, openTooltips, tooltipSide, tooltipTestProviders, tooltipText } from '../../testing/meshboard-tooltip.helpers';

@Component({
  standalone: true,
  imports: [MeshBoardTooltipDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span class="anchor" tabindex="0" role="img" [attr.aria-label]="text()" [mmMeshBoardTooltip]="tip">i</span>
    <ng-template #tip>{{ text() }}</ng-template>
  `
})
class TooltipHostComponent {
  readonly text = signal('Sum of all metering points per month');
}

describe('MeshBoardTooltipDirective', () => {
  let fixture: ComponentFixture<TooltipHostComponent>;
  let anchor: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TooltipHostComponent], providers: tooltipTestProviders() });
    fixture = TestBed.createComponent(TooltipHostComponent);
    fixture.detectChanges();
    anchor = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.anchor')!;
  });

  afterEach(() => fixture.destroy());

  function focus(): void {
    anchor.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
  }

  it('criterion 2: keyboard focus shows the tooltip, blur hides it', () => {
    focus();
    expect(tooltipText()).toBe('Sum of all metering points per month');
    anchor.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(tooltipText()).toBeNull();
  });

  it('criterion 2: Escape hides the tooltip while the element keeps focus', () => {
    focus();
    anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(tooltipText()).toBeNull();
  });

  it('other keys leave the tooltip open', () => {
    focus();
    anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true }));
    fixture.detectChanges();
    expect(tooltipText()).toBe('Sum of all metering points per month');
  });

  it('criterion 4: hover and focus together still show exactly one tooltip, and the host gets no title', () => {
    hoverTooltip(fixture, anchor);
    focus();
    expect(openTooltips().length).toBe(1);
    expect(anchor.hasAttribute('title')).toBe(false);
    leaveTooltip(fixture, anchor);
    expect(tooltipText()).toBeNull();
  });

  it('opens above its host by default', () => {
    hoverTooltip(fixture, anchor);
    expect(tooltipSide()).toBe('top');
  });

  it('criterion 5: an open tooltip follows a change of its text without reopening', () => {
    hoverTooltip(fixture, anchor);
    fixture.componentInstance.text.set('Summe aller Zählpunkte im Monat');
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    expect(tooltipText()).toBe('Summe aller Zählpunkte im Monat');
  });
});
