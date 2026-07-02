import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DropDownListModule } from '@progress/kendo-angular-dropdowns';
import { PerspectiveDefinition } from '../../services/tree-navigation-config.service';

/**
 * Small toolbar control that lets the user switch the active tree perspective
 * (AB#4263). Theme-neutral (Kendo CSS variables only). Renders nothing when
 * there is a single perspective, so a zero-config tenant sees no switcher.
 */
@Component({
  selector: 'mm-perspective-switcher',
  standalone: true,
  imports: [DropDownListModule],
  template: `
    @if (perspectives().length > 1) {
      <div class="perspective-switcher">
        <span class="switcher-label">{{ label() }}</span>
        <kendo-dropdownlist
          [data]="perspectives()"
          [textField]="'displayName'"
          [valueField]="'key'"
          [valuePrimitive]="true"
          [value]="activeKey()"
          (valueChange)="perspectiveChange.emit($event)"
        ></kendo-dropdownlist>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .perspective-switcher {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
      }

      .switcher-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--kendo-color-subtle, #6c757d);
        white-space: nowrap;
      }
    `,
  ],
})
export class PerspectiveSwitcherComponent {
  /** All selectable perspectives (built-in spatial first). */
  perspectives = input<PerspectiveDefinition[]>([]);
  /** Currently active perspective key. */
  activeKey = input<string>('Spatial');
  /** Label shown before the dropdown. */
  label = input<string>('Perspective');
  /** Emits the selected perspective key. */
  perspectiveChange = output<string>();
}
