import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Signal, WritableSignal } from '@angular/core';
import { DataPointPickerComponent } from './data-point-picker.component';
import { DataPointResolverService } from './data-point-resolver.service';
import { DataPointInfo } from './data-point-picker.utils';

/**
 * Exposes the component's protected/private reactive surface to spec code.
 * The picker keeps `dataPointInfos` (the raw catalogue incl. values),
 * `filter` (current filter text) and `filteredOptions` (computed
 * contains-match) non-public to keep the API minimal; tests still need to
 * drive them to verify the contains-filter and current-value logic.
 */
interface PickerTestAccess {
  dataPointInfos: WritableSignal<DataPointInfo[]>;
  filter: WritableSignal<string>;
  filteredOptions: Signal<string[]>;
  onFilterChange(filter: string): void;
}

function infos(...names: string[]): DataPointInfo[] {
  return names.map(name => ({ name }));
}

describe('DataPointPickerComponent — contains filter', () => {
  let component: DataPointPickerComponent;
  let testAccess: PickerTestAccess;
  let fixture: ComponentFixture<DataPointPickerComponent>;
  let resolverMock: MockedObject<DataPointResolverService>;

  beforeEach(async () => {
    resolverMock = {
      extractFromEntity: vi.fn().mockName('DataPointResolverService.extractFromEntity'),
      extractInfosFromEntity: vi.fn().mockName('DataPointResolverService.extractInfosFromEntity'),
      load: vi.fn().mockName('DataPointResolverService.load'),
      loadInfos: vi.fn().mockName('DataPointResolverService.loadInfos')
    } as unknown as MockedObject<DataPointResolverService>;
    resolverMock.extractFromEntity.mockReturnValue([]);
    resolverMock.extractInfosFromEntity.mockReturnValue([]);
    resolverMock.load.mockResolvedValue([]);
    resolverMock.loadInfos.mockResolvedValue([]);

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
    testAccess.dataPointInfos.set(infos('co2', 'tempActual', 'humidityActual'));
    expect(testAccess.filteredOptions()).toEqual(['co2', 'tempActual', 'humidityActual']);
  });

  it('filters by case-insensitive substring (contains), not just prefix', () => {
    testAccess.dataPointInfos.set(infos('co2', 'tempActual', 'humidityActual', 'CO2Level', 'co2target'));
    testAccess.onFilterChange('co2');
    // All three entries containing "co2" anywhere — including uppercase — match.
    expect(testAccess.filteredOptions()).toEqual(['co2', 'CO2Level', 'co2target']);
  });

  it('treats whitespace-only filter as no filter', () => {
    testAccess.dataPointInfos.set(infos('co2', 'tempActual'));
    testAccess.onFilterChange('   ');
    expect(testAccess.filteredOptions()).toEqual(['co2', 'tempActual']);
  });

  it('returns an empty list when no option contains the filter text', () => {
    testAccess.dataPointInfos.set(infos('co2', 'tempActual'));
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

describe('DataPointPickerComponent — currentValue', () => {
  let component: DataPointPickerComponent;
  let testAccess: PickerTestAccess;
  let fixture: ComponentFixture<DataPointPickerComponent>;

  beforeEach(async () => {
    const resolverMock = {
      extractFromEntity: vi.fn().mockName('DataPointResolverService.extractFromEntity'),
      extractInfosFromEntity: vi.fn().mockName('DataPointResolverService.extractInfosFromEntity'),
      load: vi.fn().mockName('DataPointResolverService.load'),
      loadInfos: vi.fn().mockName('DataPointResolverService.loadInfos')
    };
    resolverMock.extractInfosFromEntity.mockReturnValue([]);
    resolverMock.loadInfos.mockResolvedValue([]);

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

  it('exposes the selected data point\'s last known value', () => {
    testAccess.dataPointInfos.set([
      { name: 'tempActual', currentValue: '21.5' },
      { name: 'co2', currentValue: 640 },
    ]);
    component.value.set('tempActual');
    expect(component.currentValue()).toBe('21.5');

    component.value.set('co2');
    expect(component.currentValue()).toBe(640);
  });

  it('is undefined for a custom/unknown selection', () => {
    testAccess.dataPointInfos.set([{ name: 'tempActual', currentValue: '21.5' }]);
    component.value.set('somethingElse');
    expect(component.currentValue()).toBeUndefined();
  });
});
