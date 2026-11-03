import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { POPUP_CONTAINER } from '@progress/kendo-angular-popup';
import { of } from 'rxjs';
import { LineChartConfigDialogComponent } from './line-chart-config-dialog.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';

const G01 = '1-1:1.9.0 G.01';
const G03 = '1-1:2.9.0 G.03';
const G03R = '1-1:2.9.0 G.03R';

const SD_QUERY: PersistentQueryItem = { rtId: 'q-energy', name: 'energy_measurements', ckTypeId: 'System/SimpleSdQuery' };
const RUNTIME_QUERY: PersistentQueryItem = { rtId: 'q-runtime', name: 'measurements', ckTypeId: 'System/SimpleRtQuery' };

/** Line chart dialog: Field Mapping → Excluded series (AB#8128). */
describe('LineChartConfigDialogComponent — excluded series (AB#8128)', () => {
  let fixture: ComponentFixture<LineChartConfigDialogComponent>;
  let cmp: LineChartConfigDialogComponent;
  let windowRef: { close: ReturnType<typeof vi.fn> };
  let qe: Record<string, ReturnType<typeof vi.fn>>;

  async function open(initial: Partial<LineChartConfigDialogComponent>, query: PersistentQueryItem = SD_QUERY): Promise<void> {
    fixture = TestBed.createComponent(LineChartConfigDialogComponent);
    cmp = fixture.componentInstance;
    Object.assign(cmp, {
      initialCategoryField: 'window_start', initialSeriesGroupField: 'obisCode', initialValueField: 'amount.value',
      ...initial
    });
    await cmp.ngOnInit();
    cmp.selectedPersistentQuery = query;
    cmp.queryColumns = [{ attributePath: 'obisCode', attributeValueType: 'STRING', aggregationType: null }];
    cmp.nonNumericColumns = cmp.queryColumns;
    await cmp.loadSeriesGroupValues();
    await render();
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function input(): HTMLInputElement {
    return el().querySelector('[data-chart-option="excludedSeriesGroupValues"] input') as HTMLInputElement;
  }

  function chips(): string[] {
    return Array.from(el().querySelectorAll('[data-chart-option="excludedSeriesGroupValues"] .k-chip'))
      .map(c => (c.textContent ?? '').trim());
  }

  function key(target: HTMLElement, name: string): void {
    const keyCode = ({ Enter: 13, Backspace: 8, Delete: 46, ArrowDown: 40, ArrowLeft: 37 } as Record<string, number>)[name];
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, code: name, keyCode, bubbles: true } as KeyboardEventInit));
  }

  /** The author picks a series group field in the combobox. */
  function pickGroupField(field: string): void {
    fixture.debugElement.query(By.css('kendo-combobox[placeholder="Select grouping field..."]'))
      .triggerEventHandler('ngModelChange', field);
  }

  function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  /** Group reads that the test answers by hand, per series group field. */
  function groupReadsByField(...fields: string[]): Record<string, ReturnType<typeof deferred<Map<string, string[]>>>> {
    const reads = Object.fromEntries(fields.map(f => [f, deferred<Map<string, string[]>>()]));
    qe['fetchEntityGroups'].mockImplementation((_ck: string, field: string) => reads[field].promise);
    return reads;
  }

  function failureHint(): Element | null {
    return el().querySelector('[data-hint="series-group-values-failed"]');
  }

  async function type(text: string): Promise<void> {
    const box = input();
    box.focus();
    box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await render();
  }

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    qe = {
      fetchStreamDataColumns: vi.fn().mockResolvedValue([]),
      resolveFamily: vi.fn(),
      fetchQueryArchive: vi.fn().mockResolvedValue({ archiveRtId: 'archive-raw', ckTypeId: 'System/SimpleSdQuery', rtIds: null }),
      fetchEntityGroups: vi.fn().mockResolvedValue(new Map([[G03R, ['mp-g03r']], [G01, ['mp-g01']], [G03, ['mp-g03']]])),
      execute: vi.fn()
    };
    TestBed.configureTestingModule({
      imports: [LineChartConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: POPUP_CONTAINER, useFactory: () => new ElementRef(document.body) },
        { provide: WindowRef, useValue: windowRef },
        { provide: QueryExecutorService, useValue: qe },
        {
          provide: MeshBoardStateService, useValue: {
            getVariables: vi.fn(() => []), getEntitySelectors: vi.fn(() => []), resolveStreamDataTimeArgs: vi.fn(() => undefined)
          }
        },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
  });

  it('offers the group values of the source entities of a stream-data query (the widget\'s own grouping read)', async () => {
    await open({});

    expect(qe['fetchEntityGroups']).toHaveBeenCalledWith('System/SimpleSdQuery', 'obisCode');
    expect(cmp.seriesGroupValues).toEqual([G01, G03, G03R]);
  });

  it('offers the distinct column values of a runtime query', async () => {
    qe['execute'].mockReturnValue(of({
      family: 'runtime', queryRtId: 'q-runtime', associatedCkTypeId: null, columns: [], totalCount: 3, hasNextPage: false, endCursor: null,
      rows: [G03, G03R, G03].map(v => ({ __typename: 'RtSimpleQueryRow', rtId: 'x', cells: [{ attributePath: 'obisCode', value: v }] }))
    }));

    await open({}, RUNTIME_QUERY);

    expect(cmp.seriesGroupValues).toEqual([G03, G03R]);
  });

  it('shows the field only when a series group field is set, with a label linked to the input', async () => {
    await open({ initialSeriesGroupField: '' });
    expect(el().querySelector('[data-chart-option="excludedSeriesGroupValues"]')).toBeNull();

    cmp.form.seriesGroupField = 'obisCode';
    await render();

    const label = el().querySelector('label[for="line-chart-excluded-series"]');
    expect(label?.textContent?.trim()).toBe('Excluded series');
    expect(input().id).toBe('line-chart-excluded-series');
  });

  it('an empty list shows a one-line hint, not a blank area', async () => {
    await open({});

    expect(input().placeholder).toBe('No series excluded - pick or type a value');
    expect(el().textContent).toContain('Values of obisCode whose line is left out. Exact match on the stored value.');
  });

  it('shows the saved values as chips and saves them', async () => {
    await open({ initialExcludedSeriesGroupValues: [G03R] });

    expect(chips()).toEqual([G03R]);
    cmp.onSave();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ excludedSeriesGroupValues: [G03R] }));
  });

  it('keyboard only: type a value that is not listed and press Enter, then remove it with Backspace', async () => {
    await open({});

    await type('1-1:9.9.9 G.99');
    key(input(), 'Enter');
    await render();
    expect(chips()).toEqual(['1-1:9.9.9 G.99']);
    expect(cmp.excludedSeriesGroupValues).toEqual(['1-1:9.9.9 G.99']);

    key(input(), 'Backspace');
    await render();
    expect(chips()).toEqual([]);
    expect(cmp.excludedSeriesGroupValues).toEqual([]);
  });

  it('keyboard only: picks a listed value by typing it and pressing Enter', async () => {
    await open({});

    await type(G03R);
    key(input(), 'Enter');
    await render();

    expect(cmp.excludedSeriesGroupValues).toEqual([G03R]);
  });

  it('typing narrows the offered values; arrow keys and Enter pick one', async () => {
    await open({});

    await type('03r');
    expect(cmp.filteredSeriesGroupValues).toEqual([G03R]);
    key(input(), 'ArrowDown');
    key(input(), 'Enter');
    await render();

    expect(cmp.excludedSeriesGroupValues).toEqual([G03R]);
  });

  it('removing every chip saves no key', async () => {
    await open({ initialExcludedSeriesGroupValues: [G03R] });

    key(input(), 'Backspace');
    await render();
    cmp.onSave();

    expect(windowRef.close.mock.lastCall![0].excludedSeriesGroupValues).toBeUndefined();
  });

  it('when the values cannot be loaded the field still accepts typed values and says so', async () => {
    qe['fetchEntityGroups'].mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await open({});

    expect(cmp.seriesGroupValuesFailed).toBe(true);
    expect(el().querySelector('[data-hint="series-group-values-failed"]')?.textContent)
      .toContain('Could not load the values of obisCode - type a value and press Enter.');
    await type(G03R);
    key(input(), 'Enter');
    await render();
    expect(cmp.excludedSeriesGroupValues).toEqual([G03R]);
  });

  it('keyboard only: moves to a chip with ArrowLeft and removes it with Delete', async () => {
    await open({ initialExcludedSeriesGroupValues: [G01, G03R] });
    input().focus();

    key(input(), 'ArrowLeft');
    await render();
    key(input(), 'Delete');
    await render();

    expect(chips()).toEqual([G01]);
    expect(cmp.excludedSeriesGroupValues).toEqual([G01]);
  });

  it('choosing another series group field clears the list and loads the values of the new field', async () => {
    await open({ initialExcludedSeriesGroupValues: [G03R] });
    qe['fetchEntityGroups'].mockClear();

    fixture.debugElement.query(By.css('kendo-combobox[placeholder="Select grouping field..."]'))
      .triggerEventHandler('ngModelChange', 'unit');
    await render();

    expect(cmp.form.seriesGroupField).toBe('unit');
    expect(cmp.excludedSeriesGroupValues).toEqual([]);
    expect(qe['fetchEntityGroups']).toHaveBeenCalledWith('System/SimpleSdQuery', 'unit');
  });

  it('reopening a saved config loads the offered values of its query and keeps the excluded values', async () => {
    vi.useFakeTimers();
    try {
      fixture = TestBed.createComponent(LineChartConfigDialogComponent);
      cmp = fixture.componentInstance;
      Object.assign(cmp, {
        initialQueryRtId: SD_QUERY.rtId,
        initialCategoryField: 'window_start', initialSeriesGroupField: 'obisCode', initialValueField: 'amount.value',
        initialExcludedSeriesGroupValues: [G03R]
      });
      const selectByRtId = vi.fn().mockResolvedValue(SD_QUERY);
      cmp.querySelector = { selectByRtId } as unknown as QuerySelectorComponent;

      await cmp.ngOnInit();
      await vi.advanceTimersByTimeAsync(100);
      await vi.waitFor(() => expect(cmp.isLoadingInitial).toBe(false));

      expect(selectByRtId).toHaveBeenCalledWith(SD_QUERY.rtId);
      expect(qe['fetchEntityGroups']).toHaveBeenCalledWith('System/SimpleSdQuery', 'obisCode');
      expect(cmp.seriesGroupValues).toEqual([G01, G03, G03R]);
      expect(cmp.excludedSeriesGroupValues).toEqual([G03R]);
    } finally {
      vi.useRealTimers();
    }
    await render();
    expect(chips()).toEqual([G03R]);
  });

  it('offers a runtime value exactly as stored, surrounding blanks included', async () => {
    qe['execute'].mockReturnValue(of({
      family: 'runtime', queryRtId: 'q-runtime', associatedCkTypeId: null, columns: [], totalCount: 2, hasNextPage: false, endCursor: null,
      rows: [` ${G03R} `, G03].map(v => ({ __typename: 'RtSimpleQueryRow', rtId: 'x', cells: [{ attributePath: 'obisCode', value: v }] }))
    }));

    await open({}, RUNTIME_QUERY);

    expect(cmp.seriesGroupValues).toEqual([` ${G03R} `, G03]);
  });

  it('shows the loading state while the values of the field are read', async () => {
    await open({});
    const reads = groupReadsByField('unit');

    pickGroupField('unit');
    await render();
    expect(cmp.isLoadingSeriesGroupValues).toBe(true);

    reads['unit'].resolve(new Map([['kWh', ['mp-g01']]]));
    await render();
    expect(cmp.isLoadingSeriesGroupValues).toBe(false);
    expect(cmp.seriesGroupValues).toEqual(['kWh']);
  });

  it('switching the field twice quickly: a late answer for the first field does not replace the values of the second', async () => {
    await open({});
    const reads = groupReadsByField('unit', 'direction');

    pickGroupField('unit');
    pickGroupField('direction');
    await render();
    reads['direction'].resolve(new Map([['export', ['mp-g03']]]));
    await render();
    reads['unit'].resolve(new Map([['kWh', ['mp-g01']]]));
    await render();

    expect(cmp.form.seriesGroupField).toBe('direction');
    expect(cmp.seriesGroupValues).toEqual(['export']);
    expect(cmp.isLoadingSeriesGroupValues).toBe(false);
  });

  it('switching the field twice quickly: the first field answering first does not end the loading of the second', async () => {
    await open({});
    const reads = groupReadsByField('unit', 'direction');

    pickGroupField('unit');
    pickGroupField('direction');
    await render();
    reads['unit'].resolve(new Map([['kWh', ['mp-g01']]]));
    await render();

    expect(cmp.seriesGroupValues).toEqual([]);
    expect(cmp.isLoadingSeriesGroupValues).toBe(true);

    reads['direction'].resolve(new Map([['export', ['mp-g03']]]));
    await render();
    expect(cmp.seriesGroupValues).toEqual(['export']);
    expect(cmp.isLoadingSeriesGroupValues).toBe(false);
  });

  it('switching the field twice quickly: a late failure for the first field shows no failure hint for the second', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await open({});
    const reads = groupReadsByField('unit', 'direction');

    pickGroupField('unit');
    pickGroupField('direction');
    await render();
    reads['direction'].resolve(new Map([['export', ['mp-g03']]]));
    await render();
    reads['unit'].reject(new Error('network'));
    await render();

    expect(cmp.seriesGroupValuesFailed).toBe(false);
    expect(failureHint()).toBeNull();
    expect(cmp.seriesGroupValues).toEqual(['export']);
  });

  it('clearing the field while its values are still read ends the loading state', async () => {
    await open({});
    const reads = groupReadsByField('unit');

    pickGroupField('unit');
    await render();
    pickGroupField('');
    await render();
    reads['unit'].resolve(new Map([['kWh', ['mp-g01']]]));
    await render();

    expect(cmp.isLoadingSeriesGroupValues).toBe(false);
    expect(cmp.seriesGroupValues).toEqual([]);
  });

  it('choosing another query clears the list and the offered values', async () => {
    await open({ initialExcludedSeriesGroupValues: [G03R] });
    expect(cmp.seriesGroupValues).toEqual([G01, G03, G03R]);

    await cmp.onQuerySelected({ rtId: 'q-other', name: 'other', ckTypeId: 'System/SimpleSdQuery' });

    expect(cmp.excludedSeriesGroupValues).toEqual([]);
    expect(cmp.seriesGroupValues).toEqual([]);
  });

  it('after a failed load, choosing another query clears the failure state', async () => {
    qe['fetchEntityGroups'].mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await open({});
    expect(failureHint()).not.toBeNull();

    await cmp.onQuerySelected({ rtId: 'q-other', name: 'other', ckTypeId: 'System/SimpleSdQuery' });
    await render();

    expect(cmp.seriesGroupValuesFailed).toBe(false);
    expect(failureHint()).toBeNull();
  });

  it('keeps the shared dialog action bar', async () => {
    await open({});

    expect(el().querySelector('.mm-dialog-actions')).not.toBeNull();
  });
});
