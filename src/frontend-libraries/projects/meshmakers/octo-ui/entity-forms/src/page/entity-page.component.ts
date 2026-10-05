import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
  NotificationDisplayService,
  UnsavedChangesMessages,
} from '@meshmakers/shared-ui';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { arrowLeftIcon, saveIcon, trashIcon } from '@progress/kendo-svg-icons';
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
  ResolvedEntityForm,
} from '../models/entity-form.models';
import { EntityFormDataService } from '../services/entity-form-data.service';
import { EntityFormService } from '../services/entity-form.service';
import { entityListIncludesDerivedTypes } from '../list/entity-list-data-source.directive';
import { EntityListComponent, EntityListCreateRequest, EntityListOpenRequest } from '../list/entity-list.component';

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

/** Which part of the page is shown. */
export type EntityPageView = 'loading' | 'list' | 'form' | 'error';

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
 */
@Component({
  selector: 'mm-entity-page',
  standalone: true,
  imports: [EntityListComponent, EntityFormComponent, EntityIdInfoComponent, ButtonComponent],
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
  private readonly breadCrumbService = inject(BreadCrumbService, { optional: true });

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

  /** Emitted for every list / create / edit transition. */
  readonly navigate = output<EntityPageNavigateEvent>();

  // Queried by template reference so specs can swap in stubs with the same selector.
  private readonly form = viewChild<EntityFormComponent>('entityForm');
  private readonly list = viewChild<EntityListComponent>('entityList');

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

  protected readonly saveIcon = saveIcon;
  protected readonly backIcon = arrowLeftIcon;
  protected readonly deleteIcon = trashIcon;

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

  protected readonly isSingleton = computed(() => !!this.baseModel()?.singleton);
  protected readonly readOnly = computed(() => this.mode() === 'view');
  protected readonly canDeleteEntity = computed(() =>
    this.mode() === 'edit' && !this.isSingleton() && this.effectiveCanWrite() && !!this.formModel()?.capabilities.canDelete,
  );
  protected readonly title = computed(() => {
    const m = this.msgs();
    if (this.mode() === 'create') {
      return this.isSingleton() ? (this.formModel()?.title ?? m.createTitle) : m.createTitle;
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
  }

  // ---------------------------------------------------------------------------------------------
  // HasUnsavedChanges
  // ---------------------------------------------------------------------------------------------

  hasUnsavedChanges(): boolean {
    if (this.suppressGuard || this.view() !== 'form' || this.mode() === 'view') {
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
    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const wellKnownName = this.singletonWellKnownName();
        if (wellKnownName) {
          changeSet = { ...changeSet, rtWellKnownName: wellKnownName, isEmpty: false };
        }
        const rtId = await this.dataService.create(model, ckTypeId, changeSet);
        this.notificationService.showSuccess(m.createSuccess, 3000);
        if (this.isSingleton()) {
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
        return true;
      }
      await this.dataService.update(rtId, ckTypeId, changeSet);
      this.notificationService.showSuccess(m.saveSuccess, 3000);
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
    await this.go({ kind: 'create', ckTypeId: event.ckTypeId });
  }

  protected async onOpenRequested(event: EntityListOpenRequest): Promise<void> {
    await this.go({ kind: 'edit', rtId: event.rtId, ckTypeId: event.ckTypeId });
  }

  protected async onDelete(): Promise<void> {
    const rtId = this.entityRtId();
    const ckTypeId = this.entityCkTypeId();
    if (!rtId || !ckTypeId || !this.canDeleteEntity()) {
      return;
    }
    const m = this.msgs();
    const confirmed = await this.confirmationService.showYesNoConfirmationDialog(
      m.confirmDeleteTitle,
      formatEntityFormsMessage(m.confirmDeleteMessage, { name: this.entityName() ?? rtId }),
    );
    if (!confirmed) {
      return;
    }
    try {
      const ok = await this.dataService.delete([{ rtId, ckTypeId }]);
      if (!ok) {
        this.notificationService.showError(m.deleteError);
        return;
      }
      this.notificationService.showSuccess(m.deleteSuccess, 3000);
      this.suppressGuard = true;
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
      void this.breadCrumbService?.updateBreadcrumbLabels({ entityFormTitle: model.title });

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
    this.state.set({
      values: {},
      secretPresence: {},
      associations: {},
      rtWellKnownName: singletonWellKnownName,
    });
    this.mode.set('create');
    this.view.set('form');
    void this.breadCrumbService?.updateBreadcrumbLabels({
      entityFormTitle: this.baseModel()?.title ?? formModel.title,
      entityName: this.msgs().createTitle,
    });
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
    this.applyLoaded(loaded.rtId, loaded.ckTypeId || formModel.rtCkTypeId, loaded.state, loaded.rtDisplayName);
    const writable = this.effectiveCanWrite() && formModel.capabilities.canEdit;
    this.mode.set(writable ? 'edit' : 'view');
    this.view.set('form');
    return true;
  }

  private applyLoaded(rtId: string, ckTypeId: string, state: EntityFormValueState, rtDisplayName?: string | null): void {
    this.entityRtId.set(rtId);
    this.entityCkTypeId.set(ckTypeId);
    this.state.set(state);
    const name = displayNameOf(state, rtId, rtDisplayName);
    this.entityName.set(name);
    void this.breadCrumbService?.updateBreadcrumbLabels({
      entityFormTitle: this.baseModel()?.title ?? this.formModel()?.title ?? '',
      entityName: name,
    });
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
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.view.set('error');
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
function displayNameOf(state: EntityFormValueState, rtId: string, rtDisplayName?: string | null): string {
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
