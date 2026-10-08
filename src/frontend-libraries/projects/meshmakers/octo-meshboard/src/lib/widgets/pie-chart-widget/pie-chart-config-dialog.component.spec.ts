import { PieChartConfigDialogComponent, PieChartConfigResult } from './pie-chart-config-dialog.component';

/** The dialog's category colour / label editor (AB#5622), driven through its methods without rendering. */
describe('PieChartConfigDialogComponent presentation editor (AB#5622)', () => {
  type Dialog = PieChartConfigDialogComponent;
  let close: ReturnType<typeof vi.fn>;

  function dialog(): Dialog {
    const d = Object.create(PieChartConfigDialogComponent.prototype) as Dialog;
    close = vi.fn();
    Object.assign(d, {
      categoryColorRows: [],
      nextCategoryColorId: 1,
      filters: [],
      form: { dataSourceType: 'constructionKitQuery', chartType: 'pie', categoryField: '', valueField: '', displayMode: 'labels', legendPosition: 'right', ckQueryTarget: 'models', ckGroupBy: 'modelState', labelPosition: undefined, hideLabelsBelowPercent: 0 },
      windowRef: { close }
    });
    return d;
  }

  it('adds and removes category colour rows and saves only complete ones', () => {
    const d = dialog();
    d.addCategoryColor();
    d.addCategoryColor();
    d.addCategoryColor();
    d.categoryColorRows[0].category = 'PAID';
    d.categoryColorRows[0].color = '#2fb37a';
    d.categoryColorRows[1].category = 'OPEN';
    d.removeCategoryColor(d.categoryColorRows[2].id);
    expect(d.categoryColorRows.length).toBe(2);
    d.form.labelPosition = 'outside';
    d.form.hideLabelsBelowPercent = 3;
    d.onSave();
    const result = close.mock.calls[0][0] as PieChartConfigResult;
    expect(result.categoryColors).toEqual({ PAID: '#2fb37a' });
    expect(result.labelPosition).toBe('outside');
    expect(result.hideLabelsBelowPercent).toBe(3);
  });

  it('leaves the new settings out when nothing was configured (unchanged boards)', () => {
    const d = dialog();
    d.onSave();
    const result = close.mock.calls[0][0] as PieChartConfigResult;
    expect('categoryColors' in result).toBe(false);
    expect('labelPosition' in result).toBe(false);
    expect('hideLabelsBelowPercent' in result).toBe(false);
  });

  it('feeds only #rrggbb values to the native colour picker', () => {
    const d = dialog();
    expect(d.swatchValue('#2FB37A')).toBe('#2FB37A');
    expect(d.swatchValue('--brand')).toBe('#000000');
  });
});
