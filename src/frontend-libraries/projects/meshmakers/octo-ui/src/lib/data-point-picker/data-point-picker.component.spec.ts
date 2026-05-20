import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Signal, WritableSignal } from '@angular/core';
import { DataPointPickerComponent } from './data-point-picker.component';
import { DataPointResolverService } from './data-point-resolver.service';

/**
 * Exposes the component's protected reactive surface to spec code. The picker
 * keeps `options` (the raw catalogue), `filter` (current filter text) and
 * `filteredOptions` (computed contains-match) under `protected` to keep the
 * public API minimal; tests still need to drive `filter` and read the result
 * to verify the contains-filter logic.
 */
interface PickerTestAccess {
  options: WritableSignal<string[]>;
  filter: WritableSignal<string>;
  filteredOptions: Signal<string[]>;
  onFilterChange(filter: string): void;
}

describe('DataPointPickerComponent — contains filter', () => {
  let component: DataPointPickerComponent;
  let testAccess: PickerTestAccess;
  let fixture: ComponentFixture<DataPointPickerComponent>;
  let resolverMock: jasmine.SpyObj<DataPointResolverService>;

  beforeEach(async () => {
    resolverMock = jasmine.createSpyObj<DataPointResolverService>(
      'DataPointResolverService',
      ['extractFromEntity', 'load']
    );
    resolverMock.extractFromEntity.and.returnValue([]);
    resolverMock.load.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [DataPointPickerComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DataPointResolverService, useValue: resolverMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DataPointPickerComponent);
    component = fixture.componentInstance;
    testAccess = component as unknown as PickerTestAccess;
    fixture.detectChanges();
  });

  it('returns all options when no filter is set', () => {
    testAccess.options.set(['co2', 'tempActual', 'humidityActual']);
    expect(testAccess.filteredOptions()).toEqual(['co2', 'tempActual', 'humidityActual']);
  });

  it('filters by case-insensitive substring (contains), not just prefix', () => {
    testAccess.options.set(['co2', 'tempActual', 'humidityActual', 'CO2Level', 'co2target']);
    testAccess.onFilterChange('co2');
    // All three entries containing "co2" anywhere — including uppercase — match.
    expect(testAccess.filteredOptions()).toEqual(['co2', 'CO2Level', 'co2target']);
  });

  it('treats whitespace-only filter as no filter', () => {
    testAccess.options.set(['co2', 'tempActual']);
    testAccess.onFilterChange('   ');
    expect(testAccess.filteredOptions()).toEqual(['co2', 'tempActual']);
  });

  it('returns an empty list when no option contains the filter text', () => {
    testAccess.options.set(['co2', 'tempActual']);
    testAccess.onFilterChange('humidity');
    expect(testAccess.filteredOptions()).toEqual([]);
  });

  it('emits the filterChange output on every keystroke', () => {
    const observed: string[] = [];
    component.filterChange.subscribe(v => observed.push(v));
    testAccess.onFilterChange('c');
    testAccess.onFilterChange('co');
    testAccess.onFilterChange('co2');
    expect(observed).toEqual(['c', 'co', 'co2']);
  });
});
