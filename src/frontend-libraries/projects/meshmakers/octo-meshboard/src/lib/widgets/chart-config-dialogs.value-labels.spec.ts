import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { PieChartConfigDialogComponent } from './pie-chart-widget/pie-chart-config-dialog.component';
import { BarChartConfigDialogComponent } from './bar-chart-widget/bar-chart-config-dialog.component';
import { LineChartConfigDialogComponent } from './line-chart-widget/line-chart-config-dialog.component';
import { QueryExecutorService } from '../services/query-executor.service';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';

/**
 * The value label editor in the pie, bar and line config dialogs (AB#7235), driven through the
 * rendered editor the way a board author would use it - including the clumsy paths.
 */
describe('Chart config dialogs - value label editor (AB#7235)', () => {
  const FEED_IN = '1-1:2.9.0 G.03';
  const SURPLUS = '1-1:2.9.0 P.01T';

  let windowRef: { close: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<unknown>;

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: WindowRef, useValue: windowRef },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns: vi.fn().mockResolvedValue([]), resolveFamily: vi.fn() } },
        { provide: MeshBoardStateService, useValue: { getVariables: vi.fn(() => []), getEntitySelectors: vi.fn(() => []), resolveStreamDataTimeArgs: vi.fn(() => undefined) } },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function section(selector: string): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
    expect(found, `section ${selector}`).not.toBeNull();
    return found as HTMLElement;
  }

  function rowElements(sec: HTMLElement): HTMLElement[] {
    return Array.from(sec.querySelectorAll<HTMLElement>('[data-value-label-row]'));
  }

  function typeInto(input: HTMLInputElement, text: string): void {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function addRow(sec: HTMLElement, value = '', label = ''): void {
    sec.querySelector<HTMLElement>('[data-value-labels-action="add"]')?.click();
    fixture.detectChanges();
    const row = rowElements(sec).at(-1) as HTMLElement;
    const [valueInput, nameInput] = Array.from(row.querySelectorAll<HTMLInputElement>('input'));
    if (value) typeInto(valueInput, value);
    if (label) typeInto(nameInput, label);
  }

  function removeRow(sec: HTMLElement, index: number): void {
    rowElements(sec)[index].querySelector<HTMLElement>('.remove-button')?.click();
    fixture.detectChanges();
  }

  function saved(): Record<string, unknown> {
    expect(windowRef.close).toHaveBeenCalledTimes(1);
    return windowRef.close.mock.calls[0][0] as Record<string, unknown>;
  }

  describe('pie chart', () => {
    const SECTION = '[data-pie-category-labels]';
    let cmp: PieChartConfigDialogComponent;

    async function open(initial: Partial<PieChartConfigDialogComponent> = {}): Promise<void> {
      const f = TestBed.createComponent(PieChartConfigDialogComponent);
      fixture = f;
      cmp = f.componentInstance;
      Object.assign(cmp, { initialDataSourceType: 'constructionKitQuery', initialChartType: 'pie', ...initial });
      await cmp.ngOnInit();
      await render();
    }

    it('shows the saved names as rows, edits and saves them', async () => {
      await open({ initialCategoryLabels: { [FEED_IN]: 'Feed-in' } });
      const sec = section(SECTION);
      const [valueInput, nameInput] = Array.from(rowElements(sec)[0].querySelectorAll<HTMLInputElement>('input'));
      expect([valueInput.value, nameInput.value]).toEqual([FEED_IN, 'Feed-in']);

      typeInto(nameInput, 'Feed-in (kWh)');
      addRow(sec, SURPLUS, 'Surplus');
      cmp.onSave();

      expect(saved()['categoryLabels']).toEqual({ [FEED_IN]: 'Feed-in (kWh)', [SURPLUS]: 'Surplus' });
    });

    it('an empty list shows the hint and saves without the key', async () => {
      await open();
      expect(section(SECTION).querySelector('[data-value-labels-empty]')).not.toBeNull();

      cmp.onSave();

      expect('categoryLabels' in saved()).toBe(false);
    });

    it('adding a row and removing it again changes nothing', async () => {
      await open({ initialCategoryLabels: { [FEED_IN]: 'Feed-in' } });
      const sec = section(SECTION);

      addRow(sec, SURPLUS, 'Surplus');
      removeRow(sec, 1);
      cmp.onSave();

      expect(saved()['categoryLabels']).toEqual({ [FEED_IN]: 'Feed-in' });
    });

    it('removing the last row clears the names', async () => {
      await open({ initialCategoryLabels: { [FEED_IN]: 'Feed-in' } });

      removeRow(section(SECTION), 0);
      cmp.onSave();

      expect('categoryLabels' in saved()).toBe(false);
    });

    it('an unfinished duplicate row does not erase the name of the complete row', async () => {
      await open({ initialCategoryLabels: { [FEED_IN]: 'Feed-in' } });
      const sec = section(SECTION);

      addRow(sec, FEED_IN);
      cmp.onSave();

      expect(saved()['categoryLabels']).toEqual({ [FEED_IN]: 'Feed-in' });
    });

    it('a name cleared to empty removes that entry only', async () => {
      await open({ initialCategoryLabels: { [FEED_IN]: 'Feed-in', [SURPLUS]: 'Surplus' } });
      const [, nameInput] = Array.from(rowElements(section(SECTION))[0].querySelectorAll<HTMLInputElement>('input'));

      typeInto(nameInput, '');
      cmp.onSave();

      expect(saved()['categoryLabels']).toEqual({ [SURPLUS]: 'Surplus' });
    });

    it('keeps the colours editor next to it and the shared dialog footer', async () => {
      await open();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('[data-pie-category-colors]')).not.toBeNull();
      expect(root.querySelector('.mm-dialog-actions')).not.toBeNull();
    });
  });

  describe('bar chart', () => {
    let cmp: BarChartConfigDialogComponent;

    async function open(initial: Partial<BarChartConfigDialogComponent> = {}): Promise<void> {
      const f = TestBed.createComponent(BarChartConfigDialogComponent);
      fixture = f;
      cmp = f.componentInstance;
      Object.assign(cmp, { initialChartType: 'column', initialCategoryField: 'obisCode', initialSeries: [{ field: 'energy_sum' }], ...initial });
      await cmp.ngOnInit();
      cmp.selectedPersistentQuery = { rtId: 'q', name: 'Energy', ckTypeId: 'System/SimpleSdQuery' };
      await render();
    }

    it('edits category names and saves them; series names are offered in dynamic mode only', async () => {
      await open({ initialCategoryLabels: { [FEED_IN]: 'Feed-in' } });
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-bar-series-labels]')).toBeNull();

      addRow(section('[data-bar-category-labels]'), SURPLUS, 'Surplus');
      cmp.onSave();

      const result = saved();
      expect(result['categoryLabels']).toEqual({ [FEED_IN]: 'Feed-in', [SURPLUS]: 'Surplus' });
      expect(result['seriesLabels']).toBeUndefined();
    });

    it('edits series names of a dynamic series chart', async () => {
      await open({ initialSeriesGroupField: 'region', initialValueField: 'energy_sum', initialSeriesLabels: { N: 'North' } });

      const sec = section('[data-bar-series-labels]');
      expect(rowElements(sec).length).toBe(1);
      addRow(sec, 'S', 'South');
      cmp.onSave();

      expect(saved()['seriesLabels']).toEqual({ N: 'North', S: 'South' });
    });

    it('keeps the series names while the author switches the series mode back and forth', async () => {
      await open({ initialSeriesGroupField: 'region', initialValueField: 'energy_sum', initialSeriesLabels: { N: 'North' } });

      cmp.seriesMode = 'static';
      await render();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-bar-series-labels]')).toBeNull();
      cmp.seriesMode = 'dynamic';
      await render();

      expect(rowElements(section('[data-bar-series-labels]')).length).toBe(1);
      cmp.onSave();
      expect(saved()['seriesLabels']).toEqual({ N: 'North' });
    });

    it('an unfinished duplicate row and a half-typed row do not change the names', async () => {
      await open({ initialCategoryLabels: { [FEED_IN]: 'Feed-in' } });
      const sec = section('[data-bar-category-labels]');

      addRow(sec, FEED_IN);
      addRow(sec, '', 'name without value');
      cmp.onSave();

      expect(saved()['categoryLabels']).toEqual({ [FEED_IN]: 'Feed-in' });
    });

    it('saves without the keys for a chart that has none', async () => {
      await open();

      cmp.onSave();

      expect(saved()['categoryLabels']).toBeUndefined();
      expect(saved()['seriesLabels']).toBeUndefined();
    });

    it('keeps the shared dialog footer', async () => {
      await open();
      expect((fixture.nativeElement as HTMLElement).querySelector('.mm-dialog-actions')).not.toBeNull();
    });
  });

  describe('line chart', () => {
    let cmp: LineChartConfigDialogComponent;

    async function open(initial: Partial<LineChartConfigDialogComponent> = {}): Promise<void> {
      const f = TestBed.createComponent(LineChartConfigDialogComponent);
      fixture = f;
      cmp = f.componentInstance;
      Object.assign(cmp, { initialCategoryField: 'window_start', initialSeriesGroupField: 'obisCode', initialValueField: 'amount.value', ...initial });
      await cmp.ngOnInit();
      cmp.selectedPersistentQuery = { rtId: 'q', name: 'Energy', ckTypeId: 'System/SimpleRtQuery' };
      await render();
    }

    it('edits series names and saves them', async () => {
      await open({ initialSeriesLabels: { [FEED_IN]: 'Feed-in' } });
      const sec = section('[data-line-series-labels]');

      addRow(sec, SURPLUS, 'Surplus');
      cmp.onSave();

      expect(saved()['seriesLabels']).toEqual({ [FEED_IN]: 'Feed-in', [SURPLUS]: 'Surplus' });
    });

    it('keeps the names when the author switches the series group field and back', async () => {
      await open({ initialSeriesLabels: { [FEED_IN]: 'Feed-in' } });

      cmp.form.seriesGroupField = 'region';
      await render();
      cmp.form.seriesGroupField = 'obisCode';
      await render();
      cmp.onSave();

      expect(saved()['seriesLabels']).toEqual({ [FEED_IN]: 'Feed-in' });
    });

    it('an unfinished duplicate row does not erase the name of the complete row, removing a row works', async () => {
      await open({ initialSeriesLabels: { [FEED_IN]: 'Feed-in', [SURPLUS]: 'Surplus' } });
      const sec = section('[data-line-series-labels]');

      addRow(sec, FEED_IN);
      removeRow(sec, 1);
      cmp.onSave();

      expect(saved()['seriesLabels']).toEqual({ [FEED_IN]: 'Feed-in' });
    });

    it('saves without the key for a chart that has none and keeps the shared dialog footer', async () => {
      await open();
      expect(section('[data-line-series-labels] [data-value-labels-empty]')).not.toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('.mm-dialog-actions')).not.toBeNull();

      cmp.onSave();

      expect(saved()['seriesLabels']).toBeUndefined();
    });
  });
});
