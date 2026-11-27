import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hoverTooltip, leaveTooltip, openTooltips, tooltipTestProviders, tooltipText } from '../../testing/meshboard-tooltip.helpers';
import { exclamationCircleIcon } from '@progress/kendo-svg-icons';
import { TableValueMarkerCellComponent } from './table-value-marker-cell.component';
import { isPositiveMarkerValue } from '../../utils/meshboard-table-row-action';

describe('isPositiveMarkerValue (AB#7728)', () => {
  it.each([
    [1, true], [0.5, true], ['2', true], [' 3 ', true],
    [0, false], [-1, false], ['0', false], ['', false], ['  ', false], ['abc', false],
    [null, false], [undefined, false], [true, false], [Number.NaN, false], [{}, false]
  ])('%j -> %s', (value, expected) => {
    expect(isPositiveMarkerValue(value)).toBe(expected);
  });
});

describe('TableValueMarkerCellComponent (AB#7728)', () => {
  function render(value: unknown, showValue?: boolean, tooltip = 'Contains manual values'): HTMLElement {
    TestBed.configureTestingModule({ imports: [TableValueMarkerCellComponent] });
    const fixture = TestBed.createComponent(TableValueMarkerCellComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('icon', exclamationCircleIcon);
    fixture.componentRef.setInput('tooltip', tooltip);
    if (showValue !== undefined) {
      fixture.componentRef.setInput('showValue', showValue);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the icon with tooltip for a value above zero', () => {
    const marker = render(2).querySelector('.value-marker');
    expect(marker).not.toBeNull();
    const image = marker!.querySelector('[role="img"]');
    expect(image!.getAttribute('aria-label')).toBe('Contains manual values');
    expect(image!.querySelector('kendo-svgicon')).not.toBeNull();
  });

  it('keeps the shown value outside the image, so it is announced', () => {
    const marker = render(2, true).querySelector('.value-marker')!;
    expect(marker.getAttribute('role')).toBeNull();
    const value = marker.querySelector('.value-marker-value')!;
    expect(value.closest('[role="img"]')).toBeNull();
    expect(value.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('hides an icon without tooltip from screen readers instead of an unnamed image', () => {
    const marker = render(2, true, '').querySelector('.value-marker')!;
    expect(marker.querySelector('[role="img"]')).toBeNull();
    expect(marker.querySelector('.value-marker-icon')!.getAttribute('aria-hidden')).toBe('true');
    expect(marker.querySelector('.value-marker-value')!.textContent).toBe('2');
  });

  it('shows only the icon by default', () => {
    expect(render(2).querySelector('.value-marker-value')).toBeNull();
  });

  it('shows the value next to the icon with showValue', () => {
    const marker = render(2, true).querySelector('.value-marker');
    expect(marker!.querySelector('kendo-svgicon')).not.toBeNull();
    expect(marker!.querySelector('.value-marker-value')!.textContent).toBe('2');
  });

  it('stays empty for zero with showValue', () => {
    const cell = render(0, true);
    expect(cell.textContent!.trim()).toBe('');
    expect(cell.querySelector('.value-marker')).toBeNull();
  });

  it('stays empty for zero', () => {
    expect(render(0).querySelector('.value-marker')).toBeNull();
  });

  it('stays empty without a value', () => {
    expect(render(null).querySelector('.value-marker')).toBeNull();
  });
});

describe('TableValueMarkerCellComponent styled tooltip', () => {
  let fixture: ComponentFixture<TableValueMarkerCellComponent>;

  function render(showValue = false): HTMLElement {
    TestBed.configureTestingModule({ imports: [TableValueMarkerCellComponent], providers: tooltipTestProviders() });
    fixture = TestBed.createComponent(TableValueMarkerCellComponent);
    fixture.componentRef.setInput('value', 3);
    fixture.componentRef.setInput('icon', exclamationCircleIcon);
    fixture.componentRef.setInput('tooltip', 'Contains manual values');
    fixture.componentRef.setInput('showValue', showValue);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.value-marker')!;
  }

  afterEach(() => fixture?.destroy());

  it('criterion 1: hovering the marker shows the tooltip text in a Kendo tooltip, leaving hides it', () => {
    const marker = render();
    expect(tooltipText()).toBeNull();
    expect(hoverTooltip(fixture, marker)).toBe('Contains manual values');
    leaveTooltip(fixture, marker);
    expect(tooltipText()).toBeNull();
  });

  it('criterion 1: a changed tooltip text is what the next hover shows', () => {
    const marker = render();
    fixture.componentRef.setInput('tooltip', 'Corrected by hand');
    fixture.detectChanges();
    expect(hoverTooltip(fixture, marker)).toBe('Corrected by hand');
  });

  it('criterion 3: the marker image keeps the tooltip text as its accessible name', () => {
    const marker = render();
    expect(marker.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Contains manual values');
  });

  it('criterion 4: no element of the marker carries a native title, also while the tooltip is open', () => {
    const marker = render(true);
    expect(marker.closest('[title]')).toBeNull();
    expect(marker.querySelectorAll('[title]').length).toBe(0);
    hoverTooltip(fixture, marker);
    expect(marker.hasAttribute('title')).toBe(false);
    expect(marker.querySelectorAll('[title]').length).toBe(0);
    expect(openTooltips().length).toBe(1);
  });

  it('a marker without tooltip text opens no tooltip on hover', () => {
    const marker = render();
    fixture.componentRef.setInput('tooltip', '');
    fixture.detectChanges();
    expect(hoverTooltip(fixture, marker)).toBeNull();
    expect(openTooltips().length).toBe(0);
  });

  it('criterion 2: Escape hides a marker tooltip opened by hover while the focus is elsewhere', () => {
    const marker = render();
    hoverTooltip(fixture, marker);
    expect(document.activeElement).not.toBe(marker);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(tooltipText()).toBeNull();
  });
});
