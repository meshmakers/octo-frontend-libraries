import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl } from '@angular/forms';
import { EntitySelectInputComponent } from './entity-select-input.component';
import { EntitySelectDataSource } from '@meshmakers/shared-services';

interface Entity {
  id: string;
  name: string;
}

describe('EntitySelectInputComponent', () => {
  const query: Entity = { id: 'q-1', name: 'pipeline_ec_podlist' };
  const dataSource = {
    onFilter: vi.fn().mockResolvedValue({ totalCount: 0, items: [] }),
    onDisplayEntity: (entity: Entity) => entity.name
  } as unknown as EntitySelectDataSource<Entity>;

  let component: EntitySelectInputComponent;
  let control: FormControl<Entity | null>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntitySelectInputComponent],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(EntitySelectInputComponent, { set: { template: '<div></div>' } })
      .compileComponents();

    component = TestBed.createComponent(EntitySelectInputComponent).componentInstance;
    component.dataSource = dataSource;
    component.required = true;
    control = new FormControl<Entity | null>(null);
    component.registerOnChange(value => control.setValue(value as Entity | null, { emitEvent: false }));
    control.setValue(query);
    component.writeValue(query);
  });

  it('clears the value when the built-in clear button empties the input', () => {
    component.onSelectionChange('');

    expect(control.value).toBeNull();
    expect(component.selectedEntity).toBeNull();
    expect(component.validate(control)).toEqual({ required: true });
  });

  it('keeps the value when the text is edited away from the selected entity', () => {
    const cleared = vi.fn();
    component.entityCleared.subscribe(cleared);

    component.onFilterChange('pipeline_ec_pod');

    expect(control.value).toBe(query);
    expect(component.selectedEntity).toBe(query);
    expect(cleared).not.toHaveBeenCalled();
  });

  it('keeps the value while the text still shows the selected entity', () => {
    component.onFilterChange(query.name);
    component.onSelectionChange(query.name);

    expect(control.value).toBe(query);
    expect(component.validate(control)).toBeNull();
  });

  it('announces the cleared value', () => {
    const cleared = vi.fn();
    component.entityCleared.subscribe(cleared);

    component.onSelectionChange('');

    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('announces the cleared value once when the clear button empties the input and the filter', () => {
    const cleared = vi.fn();
    component.entityCleared.subscribe(cleared);

    component.onSelectionChange('');
    component.onFilterChange('');

    expect(cleared).toHaveBeenCalledTimes(1);
    expect(control.value).toBeNull();
  });

  it('drops a search result that arrives after the input was emptied', async () => {
    vi.useFakeTimers();
    try {
      let resolveSearch!: (result: { totalCount: number; items: Entity[] }) => void;
      vi.mocked(dataSource.onFilter).mockReturnValueOnce(new Promise(resolve => resolveSearch = resolve));
      component.autocomplete = { closeActionSheet: vi.fn() } as unknown as EntitySelectInputComponent['autocomplete'];
      component.ngOnInit();

      component.onFilterChange('pipeline_ec_pod');
      await vi.advanceTimersByTimeAsync(component.debounceMs);

      component.onSelectionChange('');
      component.onFilterChange('');
      resolveSearch({ totalCount: 1, items: [query] });
      await vi.advanceTimersByTimeAsync(0);
      component.onBlur();

      expect(component.filteredEntities).toEqual([]);
      expect(component.selectedEntity).toBeNull();
      expect(control.value).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the results of a search typed into an empty field, whose form control Kendo updates only on commit', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(dataSource.onFilter).mockResolvedValueOnce({ totalCount: 1, items: [query] });
      component.ngOnInit();
      component.searchFormControl.setValue('', { emitEvent: false });

      component.onFilterChange('pipeline_ec_pod');
      await vi.advanceTimersByTimeAsync(component.debounceMs);

      expect(component.filteredEntities).toEqual([query.name]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('searches again for the same text after it was deleted with backspace and typed again', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(dataSource.onFilter).mockClear();
      vi.mocked(dataSource.onFilter).mockResolvedValue({ totalCount: 1, items: [query] });
      component.ngOnInit();

      component.onFilterChange('pip');
      await vi.advanceTimersByTimeAsync(component.debounceMs);
      component.onFilterChange('pi');
      component.onFilterChange('p');
      component.onFilterChange('');
      await vi.advanceTimersByTimeAsync(component.debounceMs);
      component.onFilterChange('pip');
      await vi.advanceTimersByTimeAsync(component.debounceMs);

      expect(dataSource.onFilter).toHaveBeenCalledTimes(2);
      expect(component.filteredEntities).toEqual([query.name]);
    } finally {
      vi.mocked(dataSource.onFilter).mockResolvedValue({ totalCount: 0, items: [] });
      vi.useRealTimers();
    }
  });

  it('keeps a search result while the input still holds the searched text', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(dataSource.onFilter).mockResolvedValueOnce({ totalCount: 1, items: [query] });
      component.ngOnInit();

      component.onFilterChange('pipeline_ec_pod');
      await vi.advanceTimersByTimeAsync(component.debounceMs);

      expect(component.filteredEntities).toEqual([query.name]);
    } finally {
      vi.useRealTimers();
    }
  });
});
