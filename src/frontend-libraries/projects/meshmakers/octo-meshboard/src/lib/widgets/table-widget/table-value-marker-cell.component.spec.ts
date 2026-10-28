import { TestBed } from '@angular/core/testing';
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
  function render(value: unknown): HTMLElement {
    TestBed.configureTestingModule({ imports: [TableValueMarkerCellComponent] });
    const fixture = TestBed.createComponent(TableValueMarkerCellComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('icon', exclamationCircleIcon);
    fixture.componentRef.setInput('tooltip', 'Contains manual values');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the icon with tooltip for a value above zero', () => {
    const marker = render(2).querySelector('.value-marker');
    expect(marker).not.toBeNull();
    expect(marker!.getAttribute('title')).toBe('Contains manual values');
    expect(marker!.getAttribute('aria-label')).toBe('Contains manual values');
  });

  it('stays empty for zero', () => {
    expect(render(0).querySelector('.value-marker')).toBeNull();
  });

  it('stays empty without a value', () => {
    expect(render(null).querySelector('.value-marker')).toBeNull();
  });
});
