import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { SVGIcon } from '@progress/kendo-svg-icons';
import { isPositiveMarkerValue } from '../../utils/meshboard-table-row-action';

/**
 * Cell of a marker column (AB#7728): an icon with tooltip when the value is a number above zero,
 * nothing otherwise. With `showValue` the value follows the icon as text, outside the image, so
 * screen readers announce it after the tooltip. Rendered by `mm-list-view` as a `dataType: 'component'` cell.
 */
@Component({
  selector: 'mm-table-value-marker-cell',
  standalone: true,
  imports: [SVGIconModule],
  template: `
    @if (marked) {
      <!-- Only the icon is the image; the value stays outside it, so screen readers announce it. -->
      <span class="value-marker" [title]="tooltip" [style.color]="color">
        <span
          class="value-marker-icon"
          [attr.role]="tooltip ? 'img' : null"
          [attr.aria-label]="tooltip || null"
          [attr.aria-hidden]="tooltip ? null : 'true'">
          <kendo-svgicon [icon]="icon!"></kendo-svgicon>
        </span>
        @if (showValue) {
          <span class="value-marker-value">{{ value }}</span>
        }
      </span>
    }
  `,
  styles: [`
    .value-marker {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: default;
    }
    .value-marker-icon {
      display: inline-flex;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableValueMarkerCellComponent {
  @Input() value: unknown;
  @Input() icon?: SVGIcon;
  @Input() tooltip = '';
  @Input() color?: string;
  @Input() showValue = false;

  get marked(): boolean {
    return !!this.icon && isPositiveMarkerValue(this.value);
  }
}
