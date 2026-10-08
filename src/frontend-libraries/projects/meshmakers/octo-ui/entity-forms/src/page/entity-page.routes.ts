import { Route, Routes } from '@angular/router';
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';
import { SVGIcon } from '@progress/kendo-svg-icons';
import { EntityFormsMessages } from '../entity-forms.messages';
import { EntityListSortDescriptor } from '../models/entity-form.models';
import { EntityFormPrefillValues } from '../core/entity-form-prefill';
import { EntityFormBeforeSaveHook } from '../core/before-save';
import type { EntityListRowClass } from '../list/entity-list.component';

/**
 * Options of {@link entityFormRoutes}.
 *
 * Route parameter contract (stable, relied upon by the Refinery Studio, AB#5523):
 *
 * | Path      | Page state                                                          |
 * |-----------|---------------------------------------------------------------------|
 * | `''`      | list (a singleton form opens its entity directly)                   |
 * | `new`     | create form; `?type=<rtCkTypeId>` = concrete type (abstract forms)   |
 * | `:rtId`   | edit form (view form without write permission); optional `?type=`   |
 *
 * Route `data` carries `formKey` / `ckTypeId` / `canWrite` / `messages` (bound to the page
 * inputs by `withComponentInputBinding()`, read from `ActivatedRoute` otherwise), the `new`
 * route additionally `rtId: 'new'`, and the `breadcrumb` items with the `{{entityFormTitle}}` /
 * `{{entityName}}` labels the page fills via `BreadCrumbService.updateBreadcrumbLabels`.
 */
export interface EntityFormRoutesOptions {
  /** Form key (`form-sftp-configuration` or `sftp-configuration`). Wins over `ckTypeId`. */
  formKey?: string;
  /** Runtime CK type id of the target type, used when no `formKey` is given. */
  ckTypeId?: string;
  /**
   * Write permission for every user who can reach the routes. Hosts with role-dependent
   * permissions bind `canWrite` on their own wrapper or pass it as route data of a parent.
   */
  canWrite?: boolean;
  /** Message overrides passed to the page. */
  messages?: Partial<EntityFormsMessages>;
  /**
   * Breadcrumb URL of the list (relative to the host's breadcrumb root, e.g.
   * `communication/sftp`). Without it no breadcrumb items are added.
   */
  breadcrumbUrl?: string;
  /** Label of the list breadcrumb. Default `{{entityFormTitle}}` (the resolved form title). */
  breadcrumbLabel?: string;
  /**
   * Heading of the list (and of the singleton form) instead of the resolved form's title — e.g.
   * "All configurations" for a generic list over a base type whose `form-default` title would be
   * the type name. Route data key `entityListTitle`.
   */
  title?: string;
  /**
   * Adds a "Type" column (short CK type name of each row) to the list — for lists over a base type
   * with derived types. Route data key `entityListTypeColumn`.
   */
  showTypeColumn?: boolean;
  /**
   * Order of the list while the user has not sorted by a column (AB#5623). Wins over the form's
   * `listDefaultSort`. Route data key `entityListDefaultSort`.
   */
  defaultSort?: EntityListSortDescriptor[];
  /**
   * Where the form's Save / Cancel / Delete buttons sit (AB#5623): `'top'` (header, default) or
   * `'bottom'` (bar below the form). Route data key `entityPageActionBarPosition`.
   */
  actionBarPosition?: 'top' | 'bottom';
  /** Prefill of the create form (AB#5623). Route data key `entityFormInitialValues`. */
  initialValues?: EntityFormPrefillValues;
  /**
   * Hook run before every save (AB#5623): normalise / derive values or veto the save. Route data
   * key `entityFormBeforeSave`. See `EntityFormBeforeSaveHook`.
   */
  beforeSave?: EntityFormBeforeSaveHook;
  /**
   * CSS classes per list row (AB#5623), e.g. to style disabled rows. Route data key
   * `entityListRowClass`. See `EntityListRowClass`.
   */
  rowClass?: EntityListRowClass;
  /**
   * `'dialog'` opens create / edit of a list row in a dialog over the list instead of navigating
   * to `new` / `:rtId` (AB#5623; those routes still work as pages). Default `'page'`. Route data
   * key `entityPageEditMode`.
   */
  editMode?: 'page' | 'dialog';
  /**
   * `'icon'` renders the list's BOOLEAN columns as check / x icons (AB#5623). Default `'text'`.
   * Route data key `entityListBooleanDisplay`.
   */
  booleanDisplay?: 'text' | 'icon';
  /** Label of the create breadcrumb. Default `New`. */
  newBreadcrumbLabel?: string;
  /** Label of the edit breadcrumb. Default `{{entityName}}`. */
  entityBreadcrumbLabel?: string;
  /** Icon of the list breadcrumb. */
  svgIcon?: SVGIcon;
  /** Additional route data merged into all three routes (e.g. `roles`). */
  data?: Record<string, unknown>;
}

/**
 * Builds the three child routes of an entity form page: `''` (list), `new` (create) and
 * `:rtId` (edit), each rendering `EntityPageComponent` lazily and guarded by
 * `UnsavedChangesGuard`. Mount them under any path:
 *
 * ```ts
 * { path: 'sftp', children: entityFormRoutes({ formKey: 'sftp-configuration', breadcrumbUrl: 'communication/sftp' }) }
 * ```
 */
export function entityFormRoutes(opts: EntityFormRoutesOptions = {}): Routes {
  const {
    formKey,
    ckTypeId,
    canWrite,
    messages,
    breadcrumbUrl,
    breadcrumbLabel = '{{entityFormTitle}}',
    newBreadcrumbLabel = 'New',
    entityBreadcrumbLabel = '{{entityName}}',
    svgIcon,
    title,
    showTypeColumn,
    defaultSort,
    actionBarPosition,
    initialValues,
    beforeSave,
    rowClass,
    editMode,
    booleanDisplay,
    data = {},
  } = opts;

  const baseData: Record<string, unknown> = {
    ...data,
    ...(formKey !== undefined && { formKey }),
    ...(ckTypeId !== undefined && { ckTypeId }),
    ...(canWrite !== undefined && { canWrite }),
    ...(messages !== undefined && { messages }),
    ...(title !== undefined && { entityListTitle: title }),
    ...(showTypeColumn !== undefined && { entityListTypeColumn: showTypeColumn }),
    ...(defaultSort !== undefined && { entityListDefaultSort: defaultSort }),
    ...(actionBarPosition !== undefined && { entityPageActionBarPosition: actionBarPosition }),
    ...(initialValues !== undefined && { entityFormInitialValues: initialValues }),
    ...(beforeSave !== undefined && { entityFormBeforeSave: beforeSave }),
    ...(rowClass !== undefined && { entityListRowClass: rowClass }),
    ...(editMode !== undefined && { entityPageEditMode: editMode }),
    ...(booleanDisplay !== undefined && { entityListBooleanDisplay: booleanDisplay }),
  };

  const listCrumb = breadcrumbUrl !== undefined
    ? { label: breadcrumbLabel, url: breadcrumbUrl, ...(svgIcon && { svgIcon }) }
    : null;
  const crumbs = (extra?: { label: string; url: string }): Record<string, unknown> => {
    if (!listCrumb) {
      return {};
    }
    return { breadcrumb: extra ? [listCrumb, extra] : [listCrumb] };
  };

  const loadComponent = () => import('./entity-page.component').then((m) => m.EntityPageComponent);

  const listRoute: Route = {
    path: '',
    loadComponent,
    canDeactivate: [UnsavedChangesGuard],
    data: { ...baseData, ...crumbs() },
  };
  const newRoute: Route = {
    path: 'new',
    loadComponent,
    canDeactivate: [UnsavedChangesGuard],
    data: {
      ...baseData,
      rtId: 'new',
      ...crumbs({ label: newBreadcrumbLabel, url: `${breadcrumbUrl}/new` }),
    },
  };
  const editRoute: Route = {
    path: ':rtId',
    loadComponent,
    canDeactivate: [UnsavedChangesGuard],
    data: {
      ...baseData,
      ...crumbs({ label: entityBreadcrumbLabel, url: `${breadcrumbUrl}/:rtId` }),
    },
  };
  return [listRoute, newRoute, editRoute];
}
