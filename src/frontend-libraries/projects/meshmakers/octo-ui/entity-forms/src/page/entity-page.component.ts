import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { FieldFilterDto, FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { EntityIdInfoComponent } from '@meshmakers/octo-ui';
import { BreadCrumbService } from '@meshmakers/shared-services';
import {
  ConfirmationService,
  HAS_UNSAVED_CHANGES,
  HasUnsavedChanges,
  MM_ACTION_ICONS,
  NotificationDisplayService,
  resolveListRowLabel,
  UnsavedChangesMessages,
} from '@meshmakers/shared-ui';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { KENDO_DIALOG } from '@progress/kendo-angular-dialog';
import { arrowLeftIcon, saveIcon } from '@progress/kendo-svg-icons';
import { NgTemplateOutlet } from '@angular/common';
import { CommandItem } from '@meshmakers/shared-services';
import { firstValueFrom } from 'rxjs';
import {
  EntityFormsMessages,
  formatEntityFormsMessage,
  mergeEntityFormsMessages,
} from '../entity-forms.messages';
import { EntityFormComponent } from '../form/entity-form.component';
import { EntityFormGetListDtoGQL } from '../graphQL/getEntityFormList';
import {
  CkRecordInfo,
  EntityFormMode,
  EntityFormValueState,
  EntityListSortDescriptor,
  ResolvedEntityForm,
} from '../models/entity-form.models';
import {
  ENTITY_FORM_LABEL_RESOLVER,
  EntityFormLabelResolver,
  localizeEntityForm,
  localizeEntityFormTitle,
} from '../core/entity-form-labels';
import { EntityFormPrefillValues } from '../core/entity-form-prefill';
import { EntityPageActionsContext, EntityPageActionsDirective } from './entity-page-actions.directive';
import { EntityFormDataService } from '../services/entity-form-data.service';
import { EntityFormService } from '../services/entity-form.service';
import { entityListIncludesDerivedTypes } from '../list/entity-list-data-source.directive';
import { entityListCreateLabel } from '../list/entity-list.component';
import {
  EntityListComponent,
  EntityListCreateRequest,
  EntityListOpenRequest,
  EntityListBooleanDisplay,
  EntityListRowClass,
} from '../list/entity-list.component';
import {
  confirmEntityFormAction,
  confirmEntityFormDanger,
  ENTITY_FORM_ACTION_CONFIRMATION,
  ENTITY_FORM_DANGER_CONFIRMATION,
  entityDeleteConfirmation,
} from '../core/action-confirmation';
import { ENTITY_FORM_BEFORE_SAVE, EntityFormBeforeSaveHook, runEntityFormBeforeSave } from '../core/before-save';

/** Value of the `rtId` input / route parameter that opens the create form. */
export const ENTITY_PAGE_NEW = 'new';

/**
 * Query parameter carrying the concrete runtime CK type of the entity to create or open
 * (`new?type=…` after the subtype picker of an abstract type, `:rtId?type=…` for an entity of
 * a derived type). Named `type`, not `ckTypeId`, so that `withComponentInputBinding` never
 * binds it onto the page's `ckTypeId` input (the form's target type).
 */
export const ENTITY_PAGE_TYPE_QUERY_PARAM = 'type';

/** Event of {@link EntityPageComponent.navigate}. */
export interface EntityPageNavigateEvent {
  kind: 'list' | 'create' | 'edit';
  rtId?: string;
  ckTypeId?: string;
}

/** Event of {@link EntityPageComponent.saved}: an entity was created or updated. */
export interface EntityPageSavedEvent {
  kind: 'create' | 'update';
  rtId: string;
  ckTypeId: string;
}

/** Event of {@link EntityPageComponent.deleted}. */
export interface EntityPageDeletedEvent {
  rtId: string;
  ckTypeId: string;
}

/** Which part of the page is shown. */
export type EntityPageView = 'loading' | 'list' | 'form' | 'error';

/** Where the form's Save / Cancel / Delete buttons sit (AB#5623). */
export type EntityPageActionBarPosition = 'top' | 'bottom';

/**
 * How create / edit of a list row opens (AB#5623): `'page'` (navigate to the `new` / `:rtId`
 * route, default) or `'dialog'` (a dialog over the list; the URL does not change).
 */
export type EntityPageEditMode = 'page' | 'dialog';

/**
 * Prefill of the create form (AB#5623): the values, or a function of the concrete type to create
 * (called once per create form; may return `null`).
 */
export type EntityPageInitialValues =
  | EntityFormPrefillValues
  | ((context: { ckTypeId: string }) => EntityFormPrefillValues | null | undefined);

interface PageContext {
  formKey?: string;
  ckTypeId?: string;
  rtId?: string;
  type?: string;
}

/**
 * `<mm-entity-page>` — route component that combines `<mm-entity-list>` and `<mm-entity-form>`
 * for one form (by `formKey`) or CK type (by `ckTypeId`).
 *
 * - No `rtId` → list (or, for a singleton form, the singleton entity directly).
 * - `rtId === 'new'` → create form (`?type=` carries the concrete subtype of an abstract type).
 * - any other `rtId` → edit form (or view form without write permission).
 *
 * Inputs can be bound by `withComponentInputBinding()` from route params / data; without it the
 * page falls back to `ActivatedRoute` (params, data of this route and its parents, query params).
 * Navigation is relative (`..`, `new`, `:rtId`), so it works under any mount point; set
 * `routerNavigation` to `false` and handle {@link navigate} to drive it yourself.
 *
 * Host extensions (AB#5623, all optional, defaults = unchanged behaviour): `actionBarPosition`
 * (Save / Cancel at the bottom), page actions via `<ng-template mmEntityPageActions>`, list
 * `listToolbarActions` / `listRowActions` / `listRowMenuActions`, `defaultSort`, `labelResolver`
 * (translated labels and enum texts), `initialValues` (create prefill),
 * {@link patchFormValues} (prefill from a host action), `beforeSave` (normalise / veto the
 * change set before it is saved), `listRowClass` (CSS classes per row) and `editMode: 'dialog'`
 * (create / edit in a dialog over the list).
 *
 * Dialog mode (`editMode: 'dialog'`, AB#5623): "New", row click and Edit / View open the form in
 * a Kendo dialog over the list instead of navigating. The same form, hooks and texts apply
 * (`beforeSave`, `initialValues`, `labelResolver`, secrets, page actions with `view: 'form'`);
 * actions sit in the dialog's bottom bar (page actions, Cancel, Delete, Save — Cancel left of the
 * primary Save). Cancel, the close button and Escape ask before discarding unsaved changes; a
 * route change while the dialog has changes goes through the unsaved-changes guard. After a save
 * or delete the dialog closes and the list reloads; focus returns to the element that opened the
 * dialog. No `navigate` events are emitted for dialog transitions. The `new` / `:rtId` routes keep
 * working as pages (deep links); singleton forms always use the page.
 */
@Component({
  selector: 'mm-entity-page',
  standalone: true,
  imports: [EntityListComponent, EntityFormComponent, EntityIdInfoComponent, ButtonComponent, NgTemplateOutlet, KENDO_DIALOG],
  providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: EntityPageComponent }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-page.component.html',
  styleUrl: './entity-page.component.scss',
})
export class EntityPageComponent implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formService = inject(EntityFormService);
  private readonly dataService = inject(EntityFormDataService);
  private readonly listGQL = inject(EntityFormGetListDtoGQL);
  private readonly notificationService = inject(NotificationDisplayService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly actionConfirmation = inject(ENTITY_FORM_ACTION_CONFIRMATION, { optional: true });
  private readonly dangerConfirmation = inject(ENTITY_FORM_DANGER_CONFIRMATION, { optional: true });
  private readonly breadCrumbService = inject(BreadCrumbService, { optional: true });
  private readonly injectedLabelResolver = inject(ENTITY_FORM_LABEL_RESOLVER, { optional: true });
  private readonly injectedBeforeSave = inject(ENTITY_FORM_BEFORE_SAVE, { optional: true });

  /** Form key (`form-sftp-configuration` or `sftp-configuration`). Wins over `ckTypeId`. */
  readonly formKey = input<string | undefined>(undefined);
  /** Runtime CK type id of the form's target type (used when no `formKey` is given). */
  readonly ckTypeId = input<string | undefined>(undefined);
  /** Entity to edit; `'new'` opens the create form; absent shows the list. */
  readonly rtId = input<string | undefined>(undefined);
  /** Whether the user may write. Falls back to route data `canWrite`, then `true`. */
  readonly canWrite = input<boolean | undefined>(undefined);
  /** Partial message overrides; falls back to route data `messages`, then English. */
  readonly messages = input<Partial<EntityFormsMessages> | undefined>(undefined);
  /** Perform the default relative Router navigation (in addition to emitting {@link navigate}). */
  readonly routerNavigation = input<boolean>(true);
  /**
   * Where Save / Cancel / Delete sit on the form (AB#5623): `'top'` (header, default) or
   * `'bottom'` (a bar below the form, right-aligned). Falls back to route data
   * `entityPageActionBarPosition`.
   */
  readonly actionBarPosition = input<EntityPageActionBarPosition | undefined>(undefined);
  /** Translates labels, titles and enum texts (AB#5623); wins over `ENTITY_FORM_LABEL_RESOLVER`. */
  readonly labelResolver = input<EntityFormLabelResolver | null | undefined>(undefined);
  /** List order while the user has not sorted (AB#5623). Falls back to route data `entityListDefaultSort`, then the form's `listDefaultSort`. */
  readonly defaultSort = input<readonly EntityListSortDescriptor[] | null | undefined>(undefined);
  /** Prefill of the create form (AB#5623). Falls back to route data `entityFormInitialValues`. */
  readonly initialValues = input<EntityPageInitialValues | null | undefined>(undefined);
  /**
   * Hook run before every save (AB#5623): may modify the change set or veto the save. Wins over
   * route data `entityFormBeforeSave` and `ENTITY_FORM_BEFORE_SAVE`. See {@link EntityFormBeforeSaveHook}.
   */
  readonly beforeSave = input<EntityFormBeforeSaveHook | null | undefined>(undefined);
  /** Host toolbar actions of the list (AB#5623); "New {form title}" sits in the page header (AB#6211). */
  readonly listToolbarActions = input<readonly CommandItem[]>([]);
  /** Host row actions of the list (icon buttons after Edit / View, AB#5623). */
  readonly listRowActions = input<readonly CommandItem[]>([]);
  /** Host row menu entries of the list (context menu, AB#5623). */
  readonly listRowMenuActions = input<readonly CommandItem[]>([]);
  /**
   * How create / edit opens (AB#5623): `'page'` (default) or `'dialog'` (over the list). Falls back
   * to route data `entityPageEditMode`. Ignored for singleton forms.
   */
  readonly editMode = input<EntityPageEditMode | undefined>(undefined);
  /**
   * CSS classes per list row (AB#5623), passed to `mm-entity-list`'s `rowClass`. Falls back to
   * route data `entityListRowClass`, then `ENTITY_LIST_ROW_CLASS`.
   */
  readonly listRowClass = input<EntityListRowClass | null | undefined>(undefined);
  /**
   * How the list renders BOOLEAN columns (AB#5623), passed to `mm-entity-list`'s `booleanDisplay`:
   * `'text'` (default) or `'icon'`. Falls back to route data `entityListBooleanDisplay`.
   */
  readonly listBooleanDisplay = input<EntityListBooleanDisplay | undefined>(undefined);
  /**
   * Field naming a row / entity for people (AB#5623): passed to `mm-entity-list`'s
   * `rowLabelField` (row action names, delete confirmation) and used for the dialog / page title
   * ("Edit <label>") and the delete confirmation of the open entity. Falls back to route data
   * `entityListRowLabelField`; absent = today's behaviour (`name`, well-known name, display name, rtId).
   */
  readonly listRowLabelField = input<string | undefined>(undefined);

  /** Emitted for every list / create / edit transition. */
  readonly navigate = output<EntityPageNavigateEvent>();
  /** Emitted after a successful create or update (not for "no changes"). Hosts refresh their lists on it. */
  readonly saved = output<EntityPageSavedEvent>();
  /** Emitted after the open entity was deleted from the form (before the navigation to the list). */
  readonly deleted = output<EntityPageDeletedEvent>();

  // Queried by template reference so specs can swap in stubs with the same selector.
  private readonly form = viewChild<EntityFormComponent>('entityForm');
  /** Why Save / Create is disabled (e.g. a required secret without key ring, Q17), or `null`. */
  protected readonly saveBlockedReason = computed(() => this.form()?.saveBlockedReason() ?? null);
  private readonly list = viewChild<EntityListComponent>('entityList');
  private readonly listElement = viewChild('entityList', { read: ElementRef });
  /** Host page actions (`<ng-template mmEntityPageActions>`, AB#5623). */
  protected readonly pageActions = contentChild(EntityPageActionsDirective);

  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParamMap = toSignal(this.route.queryParamMap);
  private readonly routeData = toSignal(this.route.data);

  protected readonly view = signal<EntityPageView>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  /** The form resolved for the page's type (list + breadcrumb title). */
  protected readonly baseModel = signal<ResolvedEntityForm | null>(null);
  /** The form resolved for the entity's concrete type (create / edit). */
  protected readonly formModel = signal<ResolvedEntityForm | null>(null);
  protected readonly mode = signal<EntityFormMode>('create');
  protected readonly state = signal<EntityFormValueState | undefined>(undefined);
  protected readonly entityRtId = signal<string | null>(null);
  protected readonly entityCkTypeId = signal<string | null>(null);
  protected readonly entityName = signal<string | null>(null);
  protected readonly saving = signal(false);
  /** Record metadata of the form's type (type conversion of record sub-values in the form). */
  protected readonly records = signal<Record<string, CkRecordInfo>>({});
  /** Well-known name forced onto a singleton that is created on first save. */
  protected readonly singletonWellKnownName = signal<string | null>(null);
  /** The create / edit dialog over the list is shown (`editMode: 'dialog'`, AB#5623). */
  protected readonly dialogOpen = signal(false);

  protected readonly saveIcon = saveIcon;
  protected readonly backIcon = arrowLeftIcon;
  protected readonly deleteIcon = MM_ACTION_ICONS.delete;
  protected readonly addIcon = MM_ACTION_ICONS.add;

  protected readonly msgs = computed(() =>
    mergeEntityFormsMessages(this.messages() ?? (this.inheritedData('messages') as Partial<EntityFormsMessages> | undefined)),
  );

  protected readonly effectiveCanWrite = computed(() => {
    const bound = this.canWrite();
    if (bound !== undefined) {
      return bound;
    }
    const fromData = this.inheritedData('canWrite');
    return fromData === undefined ? true : fromData !== false;
  });

  protected readonly effectiveLabelResolver = computed(() => this.labelResolver() ?? this.injectedLabelResolver ?? null);

  /** The effective before-save hook: input, else route data `entityFormBeforeSave`, else the token. */
  private effectiveBeforeSave(): EntityFormBeforeSaveHook | null {
    const bound = this.beforeSave();
    if (bound) {
      return bound;
    }
    const fromData = this.inheritedData('entityFormBeforeSave');
    if (typeof fromData === 'function') {
      return fromData as EntityFormBeforeSaveHook;
    }
    return this.injectedBeforeSave ?? null;
  }
  /** `'dialog'` only for non-singleton forms with `editMode` (input, else route data) `'dialog'`. */
  protected readonly effectiveEditMode = computed<EntityPageEditMode>(() => {
    this.routeData();
    const mode = this.editMode() ?? this.inheritedData('entityPageEditMode');
    return mode === 'dialog' && !this.isSingleton() ? 'dialog' : 'page';
  });
  protected readonly effectiveActionBarPosition = computed<EntityPageActionBarPosition>(() => {
    this.routeData();
    return (this.actionBarPosition() ?? this.inheritedData('entityPageActionBarPosition')) === 'bottom' ? 'bottom' : 'top';
  });
  /** `undefined` = no page-level default (the list falls back to the form's `listDefaultSort`). */
  protected readonly effectiveDefaultSort = computed<readonly EntityListSortDescriptor[] | undefined>(() => {
    this.routeData();
    return this.defaultSort() ?? (this.inheritedData('entityListDefaultSort') as EntityListSortDescriptor[] | undefined);
  });
  /** The list's row class callback: input, else route data `entityListRowClass` (else the list's token). */
  protected readonly effectiveListRowClass = computed<EntityListRowClass | undefined>(() => {
    this.routeData();
    const bound = this.listRowClass();
    if (bound) {
      return bound;
    }
    const fromData = this.inheritedData('entityListRowClass');
    return typeof fromData === 'function' ? fromData as EntityListRowClass : undefined;
  });
  /** Row label field: input, else route data `entityListRowLabelField`, else none (default naming). */
  protected readonly effectiveRowLabelField = computed<string | undefined>(() => {
    this.routeData();
    const bound = this.listRowLabelField() ?? this.inheritedData('entityListRowLabelField');
    return typeof bound === 'string' && bound.trim() ? bound.trim() : undefined;
  });
  /** Boolean columns of the list: input, else route data `entityListBooleanDisplay`, else text. */
  protected readonly effectiveListBooleanDisplay = computed<EntityListBooleanDisplay>(() => {
    this.routeData();
    return (this.listBooleanDisplay() ?? this.inheritedData('entityListBooleanDisplay')) === 'icon' ? 'icon' : 'text';
  });
  /** The prefill of the current create form (AB#5623), computed when the form opens. */
  protected readonly createInitialValues = signal<EntityFormPrefillValues | null>(null);
  /** Base model with translated title / description (list header). */
  protected readonly localizedBase = computed(() => {
    const model = this.baseModel();
    return model ? localizeEntityForm(model, this.effectiveLabelResolver()) : null;
  });
  /**
   * Breadcrumb labels (`{{entityFormTitle}}` / `{{entityName}}`), derived from the page state so
   * they follow a language change of the label resolver or the messages (AB#5623). `null` while
   * nothing is resolved.
   */
  protected readonly breadcrumbLabels = computed<Record<string, string> | null>(() => {
    this.routeData();
    const base = this.baseModel();
    const view = this.view();
    if (!base || view === 'loading') {
      return null;
    }
    if (view !== 'form') {
      const listLabels: Record<string, string> = { entityFormTitle: asString(this.inheritedData('entityListTitle')) ?? this.formTitle(base) ?? base.title };
      return listLabels;
    }
    const entityFormTitle = this.formTitle(base) ?? this.formTitle(this.formModel()) ?? '';
    const entityName = this.mode() === 'create' && !this.entityRtId() ? this.msgs().createTitle : this.entityName() ?? '';
    return { entityFormTitle, entityName };
  });

  /** Context of the host page actions template. */
  protected readonly actionsContext = computed<EntityPageActionsContext>(() =>
    this.buildActionsContext(this.view() === 'form' ? 'form' : 'list'));
  /** Context of the host page actions in the create / edit dialog (always the form view). */
  protected readonly dialogActionsContext = computed<EntityPageActionsContext>(() => this.buildActionsContext('form'));

  private buildActionsContext(view: 'list' | 'form'): EntityPageActionsContext {
    const ctx: EntityPageActionsContext = {
      view,
      mode: view === 'form' ? this.mode() : null,
      rtId: view === 'form' ? this.entityRtId() : null,
      ckTypeId: view === 'form' ? this.entityCkTypeId() : this.baseModel()?.rtCkTypeId ?? null,
      model: view === 'form' ? this.formModel() : this.baseModel(),
      saving: this.saving(),
      page: this,
    } as EntityPageActionsContext;
    ctx.$implicit = ctx;
    return ctx;
  }

  protected readonly isSingleton = computed(() => !!this.baseModel()?.singleton);
  /**
   * The list's create action sits in the page header as the page's one solid primary (AB#6211,
   * Studio action guideline §9): only with write permission and a creatable form.
   */
  protected readonly canCreateFromList = computed(() =>
    this.effectiveCanWrite() && !!this.baseModel()?.capabilities.canCreate);
  /** "New {form title}" (AB#6211), e.g. "New Discord configuration". */
  protected readonly createLabel = computed(() =>
    entityListCreateLabel(this.msgs(), this.localizedBase()?.title));

  /** Header create action: same flow as the list's former toolbar "New" (subtype picker, dialog mode). */
  protected onCreateFromHeader(): void {
    void this.list()?.requestCreate();
  }
  /** Host heading override (`entityListTitle` route data), else the resolved form title. */
  protected readonly listTitle = computed(() => {
    this.routeData();
    return asString(this.inheritedData('entityListTitle')) ?? this.localizedBase()?.title ?? '';
  });
  /** `entityListTypeColumn` route data: show the row's CK type in the list. */
  protected readonly showTypeColumn = computed(() => {
    this.routeData();
    return this.inheritedData('entityListTypeColumn') === true;
  });
  protected readonly readOnly = computed(() => this.mode() === 'view');
  protected readonly canDeleteEntity = computed(() =>
    this.mode() === 'edit' && !this.isSingleton() && this.effectiveCanWrite() && !!this.formModel()?.capabilities.canDelete,
  );
  protected readonly title = computed(() => {
    const m = this.msgs();
    if (this.mode() === 'create' && !this.isSingleton()) {
      return m.createTitle;
    }
    // A singleton is "the" setting (e.g. Tenant mode): its form name, not "Edit <entity name>".
    if (this.isSingleton()) {
      return asString(this.inheritedData('entityListTitle')) ?? this.formTitle(this.formModel()) ?? this.localizedBase()?.title ?? m.viewTitle;
    }
    const name = this.entityName() ?? '';
    return this.mode() === 'edit' ? formatEntityFormsMessage(m.editTitle, { name }) : name || m.viewTitle;
  });

  /** The effective navigation context (inputs win over the route). */
  private readonly context = computed<PageContext>(() => {
    const params = this.paramMap();
    const query = this.queryParamMap();
    // Read the route data signal so a data change re-evaluates the context.
    this.routeData();
    return {
      // Route params come last: a host can mount the routes under `:formKey` (Refinery Studio
      // settings, AB#5523); the param reaches the child routes by params inheritance.
      formKey: this.formKey() ?? asString(this.inheritedData('formKey')) ?? paramValue(params, 'formKey'),
      ckTypeId: this.ckTypeId() ?? asString(this.inheritedData('ckTypeId')) ?? paramValue(params, 'ckTypeId'),
      rtId: this.rtId() ?? paramValue(params, 'rtId') ?? asString(this.route.snapshot?.data?.['rtId']),
      type: paramValue(query, ENTITY_PAGE_TYPE_QUERY_PARAM),
    };
  });

  private loadToken = 0;
  private suppressGuard = false;
  /** Where the next loaded form is shown: the page, or the dialog over the list. */
  private formTarget: 'page' | 'dialog' = 'page';
  /** Element focused when the dialog opened; focused again when it closes. */
  private dialogTrigger: HTMLElement | null = null;

  constructor() {
    let lastKey: string | null = null;
    effect(() => {
      const ctx = this.context();
      const key = JSON.stringify(ctx);
      if (key === lastKey) {
        return;
      }
      lastKey = key;
      untracked(() => void this.load(ctx));
    });
    effect(() => {
      const labels = this.breadcrumbLabels();
      if (labels) {
        untracked(() => void this.breadCrumbService?.updateBreadcrumbLabels(labels));
      }
    });
  }

  // ---------------------------------------------------------------------------------------------
  // HasUnsavedChanges
  // ---------------------------------------------------------------------------------------------

  hasUnsavedChanges(): boolean {
    const formShown = this.view() === 'form' || this.dialogOpen();
    if (this.suppressGuard || !formShown || this.mode() === 'view') {
      return false;
    }
    return !!this.form()?.isDirty();
  }

  unsavedChangesMessages(): UnsavedChangesMessages {
    return { title: this.msgs().unsavedChangesTitle };
  }

  /**
   * Validates and saves the form. Creates the entity in create mode (then switches to its edit
   * route), updates only the changed attributes in edit mode. Resolves `false` when the form is
   * invalid or the server rejected the change.
   */
  async saveChanges(): Promise<boolean> {
    const form = this.form();
    const model = this.formModel();
    const ckTypeId = this.entityCkTypeId();
    const m = this.msgs();
    if (!form || !model || !ckTypeId || this.mode() === 'view' || this.saving()) {
      return false;
    }
    if (!form.isValid()) {
      form.markAllAsTouched();
      this.notificationService.showWarning(m.formInvalid);
      return false;
    }
    let changeSet = form.getChangeSet();
    const isCreate = this.mode() === 'create';
    if (isCreate) {
      const wellKnownName = this.singletonWellKnownName();
      if (wellKnownName) {
        changeSet = { ...changeSet, rtWellKnownName: wellKnownName, isEmpty: false };
      }
    }
    this.saving.set(true);
    try {
      // Nothing changed on an edit form: nothing to normalise either (the hook is skipped).
      const hook = isCreate || !changeSet.isEmpty ? this.effectiveBeforeSave() : null;
      const outcome = await runEntityFormBeforeSave(hook, changeSet, {
        mode: isCreate ? 'create' : 'edit',
        ckTypeId,
        ...(isCreate ? {} : { rtId: this.entityRtId() ?? undefined }),
        form: model,
      });
      if (outcome.kind === 'veto') {
        this.notificationService.showWarning(outcome.message || m.saveVetoed || m.saveError);
        return false;
      }
      if (outcome.kind === 'error') {
        // Never log the change set: it may hold a secret the user typed.
        console.error('mm-entity-page: beforeSave failed; nothing was saved', outcome.error);
        this.notificationService.showError(m.saveError, outcome.error instanceof Error ? outcome.error.message : undefined);
        return false;
      }
      changeSet = outcome.changeSet;

      if (isCreate) {
        const rtId = await this.dataService.create(model, ckTypeId, changeSet);
        this.notificationService.showSuccess(m.createSuccess, 3000);
        this.saved.emit({ kind: 'create', rtId, ckTypeId });
        if (this.dialogOpen()) {
          this.closeDialog(true);
        } else if (this.isSingleton()) {
          this.singletonWellKnownName.set(null);
          await this.openEntity(model, { rtId }, this.loadToken);
        } else {
          this.suppressGuard = true;
          await this.go({ kind: 'edit', rtId, ckTypeId }, true);
        }
        return true;
      }

      const rtId = this.entityRtId();
      if (!rtId) {
        return false;
      }
      if (changeSet.isEmpty) {
        this.notificationService.showInfo(m.noChanges, 2000);
        if (this.dialogOpen()) {
          this.closeDialog(false);
        }
        return true;
      }
      await this.dataService.update(rtId, ckTypeId, changeSet);
      this.notificationService.showSuccess(m.saveSuccess, 3000);
      this.saved.emit({ kind: 'update', rtId, ckTypeId });
      if (this.dialogOpen()) {
        this.closeDialog(true);
        return true;
      }
      const reloaded = await this.dataService.load(model, { rtId });
      if (reloaded) {
        this.applyLoaded(reloaded.rtId, reloaded.ckTypeId, reloaded.state, reloaded.rtDisplayName);
      }
      return true;
    } catch (error) {
      console.error('mm-entity-page: save failed', error);
      this.notificationService.showError(m.saveError, error instanceof Error ? error.message : undefined);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Template handlers
  // ---------------------------------------------------------------------------------------------

  protected async onSave(): Promise<void> {
    await this.saveChanges();
  }

  protected async onBack(): Promise<void> {
    await this.go({ kind: 'list' });
  }

  protected async onCreateRequested(event: EntityListCreateRequest): Promise<void> {
    if (this.effectiveEditMode() === 'dialog') {
      await this.openDialog({ kind: 'create', ckTypeId: event.ckTypeId });
      return;
    }
    await this.go({ kind: 'create', ckTypeId: event.ckTypeId });
  }

  protected async onOpenRequested(event: EntityListOpenRequest): Promise<void> {
    if (this.effectiveEditMode() === 'dialog') {
      await this.openDialog({ kind: 'edit', rtId: event.rtId, ckTypeId: event.ckTypeId });
      return;
    }
    await this.go({ kind: 'edit', rtId: event.rtId, ckTypeId: event.ckTypeId });
  }

  /** Cancel, the dialog's close button and Escape: asks before discarding unsaved changes. */
  protected async onDialogCancel(): Promise<void> {
    if (!this.dialogOpen() || this.saving()) {
      return;
    }
    if (this.hasUnsavedChanges()) {
      const m = this.msgs();
      const discard = await this.confirmationService.showYesNoConfirmationDialog(
        m.unsavedChangesTitle,
        m.unsavedChangesMessage,
        undefined,
        { yes: m.discardChanges, no: m.keepEditing },
      );
      if (!discard) {
        return;
      }
    }
    this.closeDialog(false);
  }

  protected async onDelete(): Promise<void> {
    const rtId = this.entityRtId();
    const ckTypeId = this.entityCkTypeId();
    if (!rtId || !ckTypeId || !this.canDeleteEntity()) {
      return;
    }
    const request = { action: 'delete' as const, ckTypeId, count: 1, description: 'delete 1 entity' };
    if (!await confirmEntityFormAction(this.actionConfirmation, request)) {
      return;
    }
    const m = this.msgs();
    const options = entityDeleteConfirmation(m, [this.entityName() || rtId]);
    if (!await confirmEntityFormDanger(this.dangerConfirmation, this.confirmationService, options, request)) {
      return;
    }
    try {
      const ok = await this.dataService.delete([{ rtId, ckTypeId }]);
      if (!ok) {
        this.notificationService.showError(m.deleteError);
        return;
      }
      this.notificationService.showSuccess(m.deleteSuccess, 3000);
      if (this.dialogOpen()) {
        this.deleted.emit({ rtId, ckTypeId });
        this.closeDialog(true);
        return;
      }
      this.suppressGuard = true;
      this.deleted.emit({ rtId, ckTypeId });
      await this.go({ kind: 'list' });
    } catch (error) {
      console.error('mm-entity-page: delete failed', error);
      this.notificationService.showError(m.deleteError, error instanceof Error ? error.message : undefined);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------------------------

  private async load(ctx: PageContext): Promise<void> {
    const token = ++this.loadToken;
    this.suppressGuard = false;
    this.formTarget = 'page';
    this.dialogOpen.set(false);
    this.dialogTrigger = null;
    this.view.set('loading');
    this.errorMessage.set(null);
    const m = this.msgs();
    try {
      let model: ResolvedEntityForm | null = null;
      if (ctx.formKey) {
        model = await this.formService.resolveByFormKey(ctx.formKey);
      } else if (ctx.ckTypeId) {
        model = await this.formService.resolve(ctx.ckTypeId);
      }
      if (token !== this.loadToken) {
        return;
      }
      if (!model) {
        this.fail(m.formNotFound);
        return;
      }
      this.baseModel.set(model);

      if (!ctx.rtId) {
        if (model.singleton) {
          await this.openSingleton(model, token);
        } else {
          this.resetEntity();
          this.view.set('list');
        }
        return;
      }

      if (ctx.rtId === ENTITY_PAGE_NEW) {
        await this.openCreate(model, ctx.type, token);
        return;
      }

      const formModel = await this.modelForType(model, ctx.type);
      if (token !== this.loadToken) {
        return;
      }
      await this.openEntity(formModel, { rtId: ctx.rtId }, token);
    } catch (error) {
      if (token === this.loadToken) {
        console.error('mm-entity-page: load failed', error);
        this.fail(m.loadError);
      }
    }
  }

  private async openCreate(model: ResolvedEntityForm, type: string | undefined, token: number): Promise<void> {
    const m = this.msgs();
    if (!this.effectiveCanWrite() || !model.capabilities.canCreate) {
      this.fail(m.readOnlyNotice);
      return;
    }
    if (model.capabilities.createRequiresSubtype && (!type || type === model.rtCkTypeId)) {
      // An abstract type cannot be instantiated: go through the list's subtype picker.
      this.resetEntity();
      this.view.set('list');
      return;
    }
    const formModel = await this.modelForType(model, type);
    if (token !== this.loadToken) {
      return;
    }
    await this.startCreate(formModel, null, token);
  }

  private async openSingleton(model: ResolvedEntityForm, token: number): Promise<void> {
    const wellKnownName = model.singleton?.wellKnownName;
    if (wellKnownName) {
      const loaded = await this.openEntity(model, { wellKnownName }, token, true);
      if (loaded || token !== this.loadToken) {
        return;
      }
    } else {
      const firstRtId = await this.firstEntityRtId(model);
      if (token !== this.loadToken) {
        return;
      }
      if (firstRtId) {
        await this.openEntity(model, { rtId: firstRtId }, token);
        return;
      }
    }
    if (!this.effectiveCanWrite() || !model.capabilities.canCreate) {
      this.fail(this.msgs().entityNotFound);
      return;
    }
    await this.startCreate(model, wellKnownName ?? null, token);
  }

  private async startCreate(formModel: ResolvedEntityForm, singletonWellKnownName: string | null, token: number): Promise<void> {
    const records = await this.recordsFor(formModel);
    if (token !== this.loadToken) {
      return;
    }
    this.records.set(records);
    this.formModel.set(formModel);
    this.singletonWellKnownName.set(singletonWellKnownName);
    this.entityRtId.set(null);
    this.entityCkTypeId.set(formModel.rtCkTypeId);
    this.entityName.set(null);
    this.createInitialValues.set(this.initialValuesFor(formModel.rtCkTypeId));
    this.state.set({
      values: {},
      secretPresence: {},
      associations: {},
      rtWellKnownName: singletonWellKnownName,
    });
    this.mode.set('create');
    this.showForm();
  }

  /**
   * Loads an entity into the form. When the entity turns out to be of a different (derived)
   * type than the model, the form for that type is resolved and the values are read again with
   * its attribute list. Resolves `false` when the entity does not exist.
   */
  private async openEntity(
    model: ResolvedEntityForm,
    key: { rtId: string } | { wellKnownName: string },
    token: number,
    quietWhenMissing = false,
  ): Promise<boolean> {
    let formModel = model;
    let loaded = await this.dataService.load(formModel, key);
    if (token !== this.loadToken) {
      return false;
    }
    if (loaded && loaded.ckTypeId && loaded.ckTypeId !== formModel.rtCkTypeId) {
      formModel = await this.formService.resolve(loaded.ckTypeId);
      loaded = await this.dataService.load(formModel, { rtId: loaded.rtId });
      if (token !== this.loadToken) {
        return false;
      }
    }
    if (!loaded) {
      if (!quietWhenMissing) {
        this.fail(this.msgs().entityNotFound);
      }
      return false;
    }
    const records = await this.recordsFor(formModel);
    if (token !== this.loadToken) {
      return false;
    }
    this.records.set(records);
    this.formModel.set(formModel);
    this.singletonWellKnownName.set(null);
    this.createInitialValues.set(null);
    this.applyLoaded(loaded.rtId, loaded.ckTypeId || formModel.rtCkTypeId, loaded.state, loaded.rtDisplayName);
    const writable = this.effectiveCanWrite() && formModel.capabilities.canEdit;
    this.mode.set(writable ? 'edit' : 'view');
    this.showForm();
    return true;
  }

  private applyLoaded(rtId: string, ckTypeId: string, state: EntityFormValueState, rtDisplayName?: string | null): void {
    this.entityRtId.set(rtId);
    this.entityCkTypeId.set(ckTypeId);
    this.state.set(state);
    const name = displayNameOf(state, rtId, rtDisplayName, untracked(() => this.effectiveRowLabelField()));
    this.entityName.set(name);
  }

  private async recordsFor(model: ResolvedEntityForm): Promise<Record<string, CkRecordInfo>> {
    try {
      const type = await this.formService.getCkType(model.rtCkTypeId);
      return type ? await this.formService.getRecordsFor(type) : {};
    } catch (error) {
      console.warn('mm-entity-page: record metadata could not be loaded', error);
      return {};
    }
  }

  private async modelForType(model: ResolvedEntityForm, type: string | undefined): Promise<ResolvedEntityForm> {
    if (!type || type === model.rtCkTypeId) {
      return model;
    }
    return this.formService.resolve(type);
  }

  /** rtId of the first entity of the type (singleton forms without a well-known name). */
  private async firstEntityRtId(model: ResolvedEntityForm): Promise<string | null> {
    const fieldFilters: FieldFilterDto[] = entityListIncludesDerivedTypes(model)
      ? []
      : [{ attributePath: 'ckTypeId', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: model.rtCkTypeId }];
    const result = await firstValueFrom(
      this.listGQL.fetch({
        variables: {
          ckTypeId: model.rtCkTypeId,
          first: 1,
          fieldFilters: fieldFilters.length > 0 ? fieldFilters : null,
          // An empty list reads no attributes at all (never omit the variable: that reads all).
          attributeNames: [],
        },
        fetchPolicy: 'network-only',
      }),
    );
    const item = result.data?.runtime?.runtimeEntities?.items?.find((i) => !!i?.rtId);
    return item ? String(item.rtId) : null;
  }

  private resetEntity(): void {
    this.formModel.set(null);
    this.state.set(undefined);
    this.entityRtId.set(null);
    this.entityCkTypeId.set(null);
    this.entityName.set(null);
    this.singletonWellKnownName.set(null);
    this.createInitialValues.set(null);
  }

  private fail(message: string): void {
    if (this.formTarget === 'dialog') {
      // The list stays: tell the user and reload it (the entity may be gone).
      this.notificationService.showError(message);
      this.closeDialog(true);
      return;
    }
    this.errorMessage.set(message);
    this.view.set('error');
  }

  /** Shows the loaded form: on the page, or in the dialog over the list. */
  private showForm(): void {
    if (this.formTarget === 'dialog') {
      this.dialogOpen.set(true);
    } else {
      this.view.set('form');
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Dialog mode (AB#5623)
  // ---------------------------------------------------------------------------------------------

  /** Loads the create / edit form into the dialog over the list. */
  private async openDialog(target: { kind: 'create'; ckTypeId: string } | { kind: 'edit'; rtId: string; ckTypeId: string }): Promise<void> {
    const base = this.baseModel();
    if (!base || this.dialogOpen()) {
      return;
    }
    const m = this.msgs();
    if (target.kind === 'create' && (!this.effectiveCanWrite() || !base.capabilities.canCreate)) {
      this.notificationService.showWarning(m.readOnlyNotice);
      return;
    }
    this.dialogTrigger = activeElement();
    const token = ++this.loadToken;
    this.formTarget = 'dialog';
    try {
      const formModel = await this.modelForType(base, target.ckTypeId);
      if (token !== this.loadToken) {
        return;
      }
      if (target.kind === 'create') {
        await this.startCreate(formModel, null, token);
      } else {
        await this.openEntity(formModel, { rtId: target.rtId }, token);
      }
    } catch (error) {
      if (token === this.loadToken) {
        console.error('mm-entity-page: dialog load failed', error);
        this.fail(m.loadError);
      }
    }
  }

  /**
   * Closes the dialog without asking, optionally reloads the list, and gives the focus back to
   * the element that opened the dialog (or the list when that element is gone).
   */
  private closeDialog(refresh: boolean): void {
    this.loadToken++;
    this.formTarget = 'page';
    this.dialogOpen.set(false);
    this.resetEntity();
    if (refresh) {
      this.list()?.refresh();
    }
    const trigger = this.dialogTrigger;
    this.dialogTrigger = null;
    const listElement = this.listElement()?.nativeElement as HTMLElement | undefined;
    setTimeout(() => {
      const target = trigger?.isConnected
        ? trigger
        : listElement?.querySelector<HTMLElement>('.k-grid [tabindex="0"], .k-grid-table, .k-grid') ?? null;
      target?.focus?.();
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------------------------

  private async go(event: EntityPageNavigateEvent, replaceUrl = false): Promise<void> {
    this.navigate.emit(event);
    if (!this.routerNavigation()) {
      return;
    }
    const atList = !this.context().rtId;
    const prefix = atList ? [] : ['..'];
    let commands: string[];
    switch (event.kind) {
      case 'list':
        commands = prefix;
        break;
      case 'create':
        commands = [...prefix, ENTITY_PAGE_NEW];
        break;
      default:
        commands = [...prefix, event.rtId ?? ''];
    }
    const baseType = this.baseModel()?.rtCkTypeId;
    const queryParams = event.kind !== 'list' && event.ckTypeId && event.ckTypeId !== baseType
      ? { [ENTITY_PAGE_TYPE_QUERY_PARAM]: event.ckTypeId }
      : {};
    await this.router.navigate(commands, { relativeTo: this.route, queryParams, replaceUrl });
  }

  /** Reads a route data key from this route or the nearest ancestor that defines it. */
  private inheritedData(key: string): unknown {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const value = snapshot.data?.[key];
      if (value !== undefined) {
        return value;
      }
      snapshot = snapshot.parent as typeof snapshot;
    }
    return undefined;
  }

  /** Reloads the list (when the list is shown). */
  refreshList(): void {
    this.list()?.refresh();
  }

  /**
   * Sets values of the open form from the host (AB#5623), e.g. a "Prefill from user" page action.
   * See `EntityFormComponent.patchValues`: the values always count as user edits (the form gets
   * dirty, the unsaved-changes guard applies and Save sends them); secret and read-only fields are
   * skipped. Returns the field keys that were set (`[]` when no writable form is shown).
   */
  patchFormValues(values: EntityFormPrefillValues): string[] {
    if ((this.view() !== 'form' && !this.dialogOpen()) || this.mode() === 'view') {
      return [];
    }
    return this.form()?.patchValues(values) ?? [];
  }

  /** Translated title of a model (AB#5623). */
  private formTitle(model: ResolvedEntityForm | null): string | undefined {
    return model ? localizeEntityFormTitle(model, this.effectiveLabelResolver()) : undefined;
  }

  /** The host prefill for a create form of the given type. */
  private initialValuesFor(ckTypeId: string): EntityFormPrefillValues | null {
    const source = this.initialValues() ?? (this.inheritedData('entityFormInitialValues') as EntityPageInitialValues | undefined);
    if (!source) {
      return null;
    }
    try {
      return (typeof source === 'function' ? source({ ckTypeId }) : source) ?? null;
    } catch (error) {
      console.error('mm-entity-page: initialValues failed', error);
      return null;
    }
  }
}

/** The focused element (the dialog's trigger), or `null` outside a browser. */
function activeElement(): HTMLElement | null {
  const element = typeof document !== 'undefined' ? document.activeElement : null;
  return element instanceof HTMLElement && element !== document.body ? element : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function paramValue(map: ParamMap | undefined, key: string): string | undefined {
  return asString(map?.get(key) ?? undefined);
}

/**
 * Entity label: `name` attribute, then `rtWellKnownName`, then a computed `rtDisplayName`
 * (the backend's synthetic `<ckTypeId>@<rtId>` form counts as absent), then the rtId.
 */
function displayNameOf(state: EntityFormValueState, rtId: string, rtDisplayName?: string | null, labelField?: string): string {
  const label = labelField ? resolveListRowLabel(state.values, labelField, []) : '';
  if (label) {
    return label;
  }
  const name = state.values['name'];
  if (typeof name === 'string' && name) {
    return name;
  }
  if (state.rtWellKnownName) {
    return state.rtWellKnownName;
  }
  if (rtDisplayName && !rtDisplayName.endsWith(`@${rtId}`)) {
    return rtDisplayName;
  }
  return rtId;
}
