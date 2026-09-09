import {Directive, TemplateRef, inject} from '@angular/core';

/**
 * Marks an `<ng-template>` whose contents the list view renders inside its
 * toolbar, between the host's toolbar actions and the search box.
 *
 * It exists so a page can put its own scope/filter controls — view switches,
 * "only in clarification" toggles and the like — in the SAME band as the
 * table's search and options, instead of stacking a second strip above the
 * grid. Those controls steer the table, so they belong with the table's own
 * controls.
 *
 * A directive rather than plain `<ng-content>`: the toolbar itself lives in a
 * `kendoGridToolbarTemplate`, and content projected with `<ng-content>` cannot
 * be placed inside an `<ng-template>`. Capturing a TemplateRef and rendering it
 * with `ngTemplateOutlet` is the way to reach that spot.
 *
 * ```html
 * <mm-list-view ...>
 *   <ng-template mmListViewFilters>
 *     <kendo-buttongroup selection="single" [attr.aria-label]="'Ansicht'">…</kendo-buttongroup>
 *   </ng-template>
 * </mm-list-view>
 * ```
 */
@Directive({
  selector: '[mmListViewFilters]',
  standalone: true,
})
export class ListViewFiltersDirective {
  public readonly templateRef = inject(TemplateRef<unknown>);
}
