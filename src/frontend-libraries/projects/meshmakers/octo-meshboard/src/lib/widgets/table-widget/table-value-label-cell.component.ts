import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Cell of a table widget column with `valueLabels` (AB#7655): plain text like every other cell,
 * optionally in the configured colour. Without a colour it inherits the theme text colour; an
 * empty text renders an empty cell.
 */
@Component({
  selector: 'mm-table-value-label-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (text) {<span class="mm-table-value-label" [style.color]="color || null">{{ text }}</span>}`
})
export class TableValueLabelCellComponent {
  /** Text of the cell: the label, or the raw value when unmapped; `''` for null / missing. */
  @Input() text = '';
  /** Optional CSS colour of the text. */
  @Input() color?: string;
}
