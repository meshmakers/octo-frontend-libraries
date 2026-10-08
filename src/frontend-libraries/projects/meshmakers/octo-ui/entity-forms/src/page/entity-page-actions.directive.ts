import { Directive, TemplateRef, inject } from '@angular/core';
import { EntityFormMode, ResolvedEntityForm } from '../models/entity-form.models';

/** Template context of {@link EntityPageActionsDirective} (AB#5623). */
export interface EntityPageActionsContext {
  /** The context object itself (`let-ctx`). */
  $implicit: EntityPageActionsContext;
  /** Which part of the page is shown. */
  view: 'list' | 'form';
  /** Form mode (`null` on the list). */
  mode: EntityFormMode | null;
  /** rtId of the open entity (`null` on the list and in create mode). */
  rtId: string | null;
  /** Runtime CK type of the open entity, else of the list. */
  ckTypeId: string | null;
  /** The resolved form of the open entity, else of the list. */
  model: ResolvedEntityForm | null;
  /** True while a save is running. */
  saving: boolean;
  /**
   * The page (typed loosely to avoid a circular import): call `saveChanges()`, `patchFormValues()`
   * or `refreshList()` on it, e.g. `(ctx.page as EntityPageComponent).patchFormValues({...})`.
   */
  page: unknown;
}

/**
 * Host page actions of `<mm-entity-page>` (AB#5623): the template is rendered next to the page's
 * own buttons — in the list header, and in the form's action bar (header or bottom bar, see
 * `actionBarPosition`) before Cancel / Delete / Save.
 *
 * ```html
 * <mm-entity-page formKey="form-company-profile">
 *   <ng-template mmEntityPageActions let-ctx>
 *     @if (ctx.view === 'form') {
 *       <button kendoButton fillMode="flat" (click)="export(ctx.rtId)">Export</button>
 *     }
 *   </ng-template>
 * </mm-entity-page>
 * ```
 */
@Directive({
  selector: 'ng-template[mmEntityPageActions]',
  standalone: true,
})
export class EntityPageActionsDirective {
  readonly templateRef = inject<TemplateRef<EntityPageActionsContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: EntityPageActionsDirective, _ctx: unknown): _ctx is EntityPageActionsContext {
    return true;
  }
}
