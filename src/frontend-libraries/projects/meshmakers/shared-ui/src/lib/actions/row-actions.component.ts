import {ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, numberAttribute, output} from '@angular/core';
import {Router} from '@angular/router';
import {DropDownButtonModule} from '@progress/kendo-angular-buttons';
import {SVGIconModule} from '@progress/kendo-angular-icons';
import {moreVerticalIcon} from '@progress/kendo-svg-icons';
import {ActionButtonComponent} from './action-button.component';
import {
  MM_ROW_ACTIONS_MAX_INLINE,
  MmAction,
  MmActionEvent,
  isActionDisabled,
  splitRowActions,
} from './action.model';

/** Overflow menu item handed to the Kendo DropDownButton. */
interface RowActionMenuItem<TId extends string> {
  text: string;
  svgIcon?: MmAction<TId>['icon'];
  disabled: boolean;
  cssClass?: string;
  action: MmAction<TId>;
}

/**
 * The actions of one table row (AB#5570): icon buttons (16 px) with tooltip and an accessible
 * name that includes the row ("Edit Mesh Adapter"), from one shared action definition.
 * At most `maxInline` slots (default 3): when the actions do not fit, the last slot becomes a
 * "More actions for …" menu. Disabled actions stay focusable and announce their reason;
 * in the menu the reason is shown under the item text.
 *
 * The component only emits — destructive handlers confirm first (danger dialog naming the target).
 *
 * ```html
 * <td class="actions">
 *   <mm-row-actions [actions]="rowActions(run)" [rowLabel]="runLabel(run)" (triggered)="onAction($event, run)" />
 * </td>
 * ```
 */
@Component({
  selector: 'mm-row-actions',
  standalone: true,
  imports: [DropDownButtonModule, SVGIconModule, ActionButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {class: 'mm-row-actions', role: 'group', '[attr.aria-label]': 'groupLabel()'},
  template: `
    @for (action of split().inline; track action.id) {
      <mm-action-button [action]="action" [targetLabel]="rowLabel()" context="row" display="icon"
                        (triggered)="triggered.emit($event)" />
    }
    @if (menuItems().length) {
      <kendo-dropdownbutton
        class="mm-row-actions__more"
        [data]="menuItems()"
        [svgIcon]="moreIcon"
        size="small"
        fillMode="flat"
        themeColor="base"
        [buttonAttributes]="{ title: moreLabel(), 'aria-label': moreLabel(), 'data-action': 'more' }"
        (itemClick)="onMenuItem($event)"
      >
        <ng-template kendoDropDownButtonItemTemplate let-item>
          <span class="mm-row-actions__item" [class.mm-row-actions__item--danger]="!!item.action.danger"
                [attr.data-action]="item.action.id">
            @if (item.svgIcon) {
              <kendo-svgicon [icon]="item.svgIcon" />
            }
            <span class="mm-row-actions__item-text">
              <span>{{ item.text }}</span>
              @if (item.disabled) {
                <span class="mm-row-actions__item-reason">{{ item.action.disabledReason }}</span>
              }
            </span>
          </span>
        </ng-template>
      </kendo-dropdownbutton>
    }
  `,
  styles: [`
    .mm-row-actions { display: inline-flex; align-items: center; gap: var(--theme-space-1, 4px); }
    .mm-row-actions__item { display: inline-flex; align-items: flex-start; gap: var(--theme-space-2, 8px); }
    .mm-row-actions__item-text { display: inline-flex; flex-direction: column; }
    .mm-row-actions__item-reason { font-size: 0.85em; color: var(--theme-text-muted, #75829a); white-space: normal; max-width: 280px; }
    .mm-row-actions__item--danger { color: var(--theme-status-error, #c0385f); }
  `],
})
export class RowActionsComponent<TId extends string = string> {
  /** Action definitions for this row (hidden ones are filtered out). */
  readonly actions = input.required<readonly MmAction<TId>[]>();
  /** Human name of the row ("Mesh Adapter", "Encrypt run 2026-10-06 17:09"); part of every accessible name. */
  readonly rowLabel = input.required<string>();
  /** Slots incl. the overflow button. */
  readonly maxInline = input(MM_ROW_ACTIONS_MAX_INLINE, {transform: numberAttribute});

  /** Fires for enabled actions only, inline or from the menu. */
  readonly triggered = output<MmActionEvent<TId>>();

  private readonly router = inject(Router, {optional: true});
  protected readonly moreIcon = moreVerticalIcon;
  protected readonly split = computed(() => splitRowActions(this.actions(), this.maxInline()));
  protected readonly menuItems = computed<RowActionMenuItem<TId>[]>(() =>
    this.split().menu.map((action) => ({
      text: action.label,
      svgIcon: action.icon,
      disabled: isActionDisabled(action),
      cssClass: action.danger ? 'mm-row-actions__menu-item--danger' : undefined,
      action,
    })));
  protected readonly moreLabel = computed(() => `More actions for ${this.rowLabel()}`);
  protected readonly groupLabel = computed(() => `Actions for ${this.rowLabel()}`);

  protected onMenuItem(item: RowActionMenuItem<TId>): void {
    if (!item || item.disabled) {
      return;
    }
    const link = item.action.link;
    if (link && this.router) {
      const commands = typeof link.commands === 'string' ? [link.commands] : [...link.commands];
      void this.router.navigate(commands, {queryParams: link.queryParams});
    }
    this.triggered.emit({id: item.action.id, action: item.action});
  }
}
