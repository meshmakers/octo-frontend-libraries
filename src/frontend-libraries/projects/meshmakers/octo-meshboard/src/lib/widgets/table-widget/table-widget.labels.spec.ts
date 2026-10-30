import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TableWidgetComponent } from './table-widget.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { TableColumn, TableWidgetConfig } from '../../models/meshboard.models';
import { MESHBOARD_LANGUAGE } from '../../utils/meshboard-language';
import { MESHBOARD_LABEL_RESOLVER } from '../../utils/meshboard-labels';

interface CellInputs { text: string; color?: string }

function create(
  config: Partial<TableWidgetConfig>,
  options: { language?: unknown; resolver?: (r: unknown) => string | null | undefined } = {}
): TableWidgetComponent {
  TestBed.configureTestingModule({
    providers: [
      { provide: MeshBoardStateService, useValue: { timeZoneMode: signal('local') } },
      ...(options.language !== undefined ? [{ provide: MESHBOARD_LANGUAGE, useValue: options.language }] : []),
      ...(options.resolver ? [{ provide: MESHBOARD_LABEL_RESOLVER, useValue: options.resolver }] : [])
    ]
  });
  const cmp = TestBed.runInInjectionContext(() => new TableWidgetComponent());
  cmp.config = {
    id: 'w7655', type: 'table', title: 'Daily quality', col: 1, row: 1, colSpan: 2, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q1' },
    columns: [],
    ...config
  } as TableWidgetConfig;
  return cmp;
}

function cell(cmp: TableWidgetComponent, value: unknown, index = 0): CellInputs {
  const column = cmp.listViewColumns()[index];
  return column.cellInputs!({ [column.field]: value }) as unknown as CellInputs;
}

const qualityColumn: TableColumn = {
  field: 'dataquality_max',
  title: 'Dataquality',
  dataType: 'numeric',
  titles: { 'de-AT': 'Datenqualität', 'en-GB': 'Data quality' },
  valueLabels: { '1': { label: 'L1' }, '2': { label: 'L2' }, '3': { label: 'L3', color: 'var(--kendo-color-error)' } }
};

describe('TableWidgetComponent — titles per language (AB#7655 AC 1, 2)', () => {
  it('shows the header of the host language and follows a language signal without a refetch', () => {
    const language = signal<string | null>('de-AT');
    const cmp = create({ columns: [qualityColumn] }, { language });
    const refresh = vi.spyOn(cmp, 'refresh').mockImplementation(() => undefined);

    expect(cmp.listViewColumns()[0].displayName).toBe('Datenqualität');
    language.set('en-GB');
    expect(cmp.listViewColumns()[0].displayName).toBe('Data quality');
    language.set(null);
    expect(cmp.listViewColumns()[0].displayName).toBe('Dataquality');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('accepts a fixed language string', () => {
    expect(create({ columns: [qualityColumn] }, { language: 'en-GB' }).listViewColumns()[0].displayName).toBe('Data quality');
  });

  it('never picks a sibling culture: de-DE shows title', () => {
    expect(create({ columns: [qualityColumn] }, { language: 'de-DE' }).listViewColumns()[0].displayName).toBe('Dataquality');
  });

  it('uses a key equal to the language part', () => {
    const column: TableColumn = { ...qualityColumn, titles: { de: 'Qualität' } };
    expect(create({ columns: [column] }, { language: 'de-AT' }).listViewColumns()[0].displayName).toBe('Qualität');
  });

  it('without a host language every column shows title', () => {
    const cmp = create({ columns: [qualityColumn, { field: 'day', title: 'Day' }] });
    expect(cmp.listViewColumns().map(c => c.displayName)).toEqual(['Dataquality', 'Day']);
  });
});

describe('TableWidgetComponent — value labels (AB#7655 AC 3, 4)', () => {
  it('a number and a numeric string both read as their label; the colour is passed when configured', () => {
    const cmp = create({ columns: [qualityColumn] });
    const [column] = cmp.listViewColumns();
    expect(column.dataType).toBe('component');
    expect(column.formatter).toBeUndefined();
    expect(cell(cmp, 2)).toEqual({ text: 'L2', color: undefined });
    expect(cell(cmp, '2')).toEqual({ text: 'L2', color: undefined });
    expect(cell(cmp, 3)).toEqual({ text: 'L3', color: 'var(--kendo-color-error)' });
  });

  it('a label per language follows the host language', () => {
    const language = signal('de-AT');
    const cmp = create({
      columns: [{ field: 'q', title: 'Q', valueLabels: { '1': { label: { 'de-AT': 'gut', 'en-GB': 'good' } } } }]
    }, { language });
    expect(cell(cmp, 1).text).toBe('gut');
    language.set('en-GB');
    expect(cell(cmp, 1).text).toBe('good');
  });

  it('an unmapped value shows the raw value; null, missing and empty show an empty cell', () => {
    const cmp = create({ columns: [qualityColumn] });
    expect(cell(cmp, 4)).toEqual({ text: '4' });
    expect(cell(cmp, null)).toEqual({ text: '' });
    expect(cell(cmp, undefined)).toEqual({ text: '' });
    expect(cell(cmp, '')).toEqual({ text: '' });
    expect(cmp.listViewColumns()[0].cellInputs!({})).toEqual({ text: '' });
  });

  it('reads a nested field like the list view', () => {
    const cmp = create({ columns: [{ field: 'stats.quality', title: 'Q', valueLabels: { '1': { label: 'L1' } } }] });
    const column = cmp.listViewColumns()[0];
    expect(column.cellInputs!({ stats: { quality: 1 } })).toEqual({ text: 'L1', color: undefined });
    expect(column.cellInputs!({ 'stats.quality': 1 })).toEqual({ text: 'L1', color: undefined });
  });

  it('ignores bad culture keys and malformed entries with one warning naming widget and column', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const language = signal('en-GB');
    const cmp = create({
      columns: [{
        field: 'q', title: 'Quality',
        titles: { german: 'Qualität', 'en-GB': 'Quality (en)' },
        valueLabels: { '1': { label: 'L1' }, '2': 'L2' as never }
      }]
    }, { language });

    expect(cmp.listViewColumns()[0].displayName).toBe('Quality (en)');
    expect(cell(cmp, 1).text).toBe('L1');
    expect(cell(cmp, 2).text).toBe('2');
    language.set('de-AT');
    expect(cmp.listViewColumns()[0].displayName).toBe('Quality');

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('"Daily quality" (w7655)');
    expect(message).toContain('column "q"');
    expect(message).toContain('"german"');
    expect(message).toContain('"2"');
  });

  it('an entirely malformed valueLabels falls back to the normal cell rendering', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cmp = create({ columns: [{ field: 'q', title: 'Q', valueLabels: 'x' as never }] });
    const [column] = cmp.listViewColumns();
    expect(column.dataType).toBe('text');
    expect(column.formatter!(2, {})).toBe('2');
  });

  it('a column without titles / valueLabels renders exactly as before (AC 7)', () => {
    const cmp = create({ columns: [{ field: 'name', title: 'Name', width: 80 }] }, { language: 'de-AT' });
    const [column] = cmp.listViewColumns();
    expect(column.displayName).toBe('Name');
    expect(column.dataType).toBe('text');
    expect(column.width).toBe(80);
    expect(column.cellComponent).toBeUndefined();
    expect(column.formatter!('x', {})).toBe('x');
  });
});

describe('TableWidgetComponent — resolver for numeric enum cells (AB#7655 AC 5)', () => {
  function createWithQuery(resolver: (r: unknown) => string | null | undefined): TableWidgetComponent {
    const cmp = create({}, { resolver });
    cmp.onQueryColumnsLoaded([
      { attributePath: 'quality', attributeValueType: 'ENUM' },
      { attributePath: 'count', attributeValueType: 'INT' }
    ]);
    return cmp;
  }

  it('offers a number of an enum column to the resolver as string with valueType', () => {
    const resolver = vi.fn((r: unknown) => (r as { value: string }).value === '2' ? 'L2' : null);
    const [quality, count] = createWithQuery(resolver).listViewColumns();
    expect(quality.formatter!(2, {})).toBe('L2');
    expect(resolver).toHaveBeenCalledWith({ kind: 'tableCell', attribute: 'quality', value: '2', valueType: 'ENUM', defaultText: '2' });
    expect(count.formatter!(2, {})).toBe('2');
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('keeps the raw value when the resolver returns an empty string', () => {
    expect(createWithQuery(() => '').listViewColumns()[0].formatter!(3, {})).toBe('3');
  });

  it('keeps the raw value when the resolver returns null', () => {
    expect(createWithQuery(() => null).listViewColumns()[0].formatter!(3, {})).toBe('3');
  });

  it('string cells behave as before', () => {
    const resolver = vi.fn(() => 'translated');
    expect(createWithQuery(resolver).listViewColumns()[0].formatter!('PAID', {})).toBe('translated');
    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ value: 'PAID', valueType: 'ENUM' }));
  });

  it('does not offer numbers of a column without a known enum value type', () => {
    const resolver = vi.fn(() => 'translated');
    const cmp = create({
      dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Invoice' } as never,
      columns: [{ field: 'state', title: 'State' }]
    }, { resolver });
    expect(cmp.listViewColumns()[0].formatter!(2, {})).toBe('2');
    expect(resolver).not.toHaveBeenCalled();
  });

  it('valueLabels win over the resolver', () => {
    const resolver = vi.fn(() => 'from resolver');
    const cmp = create({ columns: [{ field: 'q', title: 'Q', valueLabels: { '1': { label: 'L1' } } }] }, { resolver });
    cmp.onQueryColumnsLoaded([{ attributePath: 'q', attributeValueType: 'ENUM' }]);
    expect(cell(cmp, 1).text).toBe('L1');
    expect(cell(cmp, 9).text).toBe('9');
    expect(resolver).not.toHaveBeenCalled();
  });
});
