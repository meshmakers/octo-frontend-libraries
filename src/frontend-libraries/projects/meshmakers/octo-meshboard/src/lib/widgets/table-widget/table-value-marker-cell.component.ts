import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { SVGIcon } from '@progress/kendo-svg-icons';
import { isPositiveMarkerValue } from '../../utils/meshboard-table-row-action';

/**
 * Cell of a marker column (AB#7728): an icon with tooltip when the value is a number above zero,
 * nothing otherwise. Rendered by `mm-list-view` as a `dataType: 'component'` cell.
 */
@Component({
  selector: 'mm-table-value-marker-cell',
  standalone: true,
  imports: [SVGIconModule],
  template: `
    @if (marked) {
      <span
        class="value-marker"
        role="img"
        [title]="tooltip"
        [attr.aria-label]="tooltip || null"
        [style.color]="color">
        <kendo-svgicon [icon]="icon!"></kendo-svgicon>
      </span>
    }
  `,
  styles: [`
    .value-marker {
      display: inline-flex;
      align-items: center;
      cursor: default;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableValueMarkerCellComponent {
  @Input() value: unknown;
  @Input() icon?: SVGIcon;
  @Input() tooltip = '';
  @Input() color?: string;

  get marked(): boolean {
    return !!this.icon && isPositiveMarkerValue(this.value);
  }
}
