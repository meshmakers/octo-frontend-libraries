import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { plusIcon } from '@progress/kendo-svg-icons';

/**
 * Empty state of a MeshBoard without widgets. Editable boards offer
 * "Add Your First Widget"; read-only boards (`meshBoardReadonly`, e.g. a host's
 * end-user view) only say that the board is empty — offering an action the
 * viewer cannot perform would be dead UI.
 */
@Component({
  selector: 'mm-meshboard-empty-state',
  standalone: true,
  imports: [ButtonModule, SVGIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <div class="empty-state-content">
        @if (readonly()) {
          <h3>No Widgets</h3>
          <p>This MeshBoard has no widgets yet.</p>
        } @else {
          <kendo-svg-icon [icon]="plusIcon" size="xlarge"></kendo-svg-icon>
          <h3>No Widgets</h3>
          <p>Get started by adding widgets to your MeshBoard.</p>
          <button kendoButton type="button" [svgIcon]="plusIcon" (click)="addWidget.emit()" themeColor="primary">
            Add Your First Widget
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .empty-state {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      height: calc(100% - 80px);
      width: 100%;
      padding-top: 4rem;
    }
    .empty-state-content { text-align: center; padding: 2rem; }
    kendo-svg-icon { color: var(--kendo-color-subtle, #9e9e9e); margin-bottom: 1rem; }
    h3 { margin: 1rem 0 0.5rem; color: var(--kendo-color-on-app-surface, #424242); font-size: 1.25rem; font-weight: 500; }
    p { margin: 0 0 1.5rem; color: var(--kendo-color-subtle, #757575); }
  `]
})
export class MeshBoardEmptyStateComponent {
  /** Read-only boards show no add action. */
  readonly readonly = input(false);
  /** "Add Your First Widget" was clicked (editable boards only). */
  readonly addWidget = output<void>();

  protected readonly plusIcon = plusIcon;
}
