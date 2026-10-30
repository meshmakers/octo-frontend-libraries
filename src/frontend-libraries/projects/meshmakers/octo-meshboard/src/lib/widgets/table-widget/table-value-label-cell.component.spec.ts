import { TestBed } from '@angular/core/testing';
import { TableValueLabelCellComponent } from './table-value-label-cell.component';

describe('TableValueLabelCellComponent (AB#7655)', () => {
  function render(text: string, color?: string): HTMLElement {
    TestBed.configureTestingModule({ imports: [TableValueLabelCellComponent] });
    const fixture = TestBed.createComponent(TableValueLabelCellComponent);
    fixture.componentRef.setInput('text', text);
    if (color !== undefined) {
      fixture.componentRef.setInput('color', color);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the label as plain text in the theme colour when no colour is set', () => {
    const span = render('L2').querySelector('span.mm-table-value-label') as HTMLElement;
    expect(span.textContent).toBe('L2');
    expect(span.style.color).toBe('');
  });

  it('applies the configured colour', () => {
    const span = render('L3', 'rgb(200, 0, 0)').querySelector('span') as HTMLElement;
    expect(span.style.color).toBe('rgb(200, 0, 0)');
  });

  it('renders an empty cell for an empty text', () => {
    const element = render('');
    expect(element.querySelector('span')).toBeNull();
    expect(element.textContent).toBe('');
  });
});
