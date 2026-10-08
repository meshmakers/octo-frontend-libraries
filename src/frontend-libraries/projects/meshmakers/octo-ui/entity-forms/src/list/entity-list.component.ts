import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  InjectionToken,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CkTypeSelectorDialogService } from '@meshmakers/octo-ui';
import { CommandItem, CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import {
  BadgeMappingTable,
  ConfirmationService,
  ListViewComponent,
  MM_ACTION_ICONS,
  NotificationDisplayService,
  RowClassFn,
  TableColumn,
} from '@meshmakers/shared-ui';
import {
  EntityFormsMessages,
  formatEntityFormsMessage,
  mergeEntityFormsMessages,
} from '../entity-forms.messages';
import { CkAttributeInfo, EntityListSortDescriptor, ResolvedEntityForm, ResolvedListColumn } from '../models/entity-form.models';
import { ENTITY_FORM_LABEL_RESOLVER, EntityFormLabelResolver, localizeEntityListColumns } from '../core/entity-form-labels';
import { formatReferenceDisplayValue } from '../form/reference/reference-display-format';
import { EntityFormDataService } from '../services/entity-form-data.service';
import { EntityFormService } from '../services/entity-form.service';
import { ckTypeDisplayName, entityFormTypeTitles } from '../core/entity-form-catalog';
import { humanizeCkTypeName } from '../core/ck-type-name';
import { EntityListDataSourceDirective, EntityListRow } from './entity-list-data-source.directive';
import { EntityListMonoCellComponent } from './entity-list-mono-cell.component';
import {
  confirmEntityFormAction,
  confirmEntityFormDanger,
  ENTITY_FORM_ACTION_CONFIRMATION,
  ENTITY_FORM_DANGER_CONFIRMATION,
  entityDeleteConfirmation,
} from '../core/action-confirmation';
import {
  ENTITY_FORM_UNSET_PLACEHOLDER_VALUES,
  EntityFormUnsetPlaceholderLookup,
  entityFormUnsetPlaceholderLookup,
} from '../core/unset-placeholders';
import { isSecretValueType } from '@meshmakers/octo-services';

/** Payload of {@link EntityListComponent.createRequested}: the concrete type to create. */
export interface EntityListCreateRequest {
  ckTypeId: string;
}

/** Payload of {@link EntityListComponent.openRequested}. */
export interface EntityListOpenRequest {
  rtId: string;
  ckTypeId: string;
}

/**
 * CSS classes of one list row (AB#5623), e.g. `{ 'row-disabled': row['enabled'] === false }`.
 * Same shapes as Angular's `[ngClass]`; `null` / `undefined` = no class. The classes are set on the
 * row's `<tr>` of the Kendo grid, so style them with global (or `::ng-deep`) CSS of the host.
 */
export type EntityListRowClass = (row: EntityListRow) => string | string[] | Record<string, boolean> | null | undefined;

/**
 * App-wide default of {@link EntityListComponent.rowClass} (AB#5623). The input (and
 * `mm-entity-page`'s `listRowClass` / route data `entityListRowClass`) wins.
 */
export const ENTITY_LIST_ROW_CLASS = new InjectionToken<EntityListRowClass>('ENTITY_LIST_ROW_CLASS');

/**
 * Maps an {@link EntityListRowClass} onto `mm-list-view`'s `rowClass`. A throwing callback is
 * logged and yields no class, so a host bug never breaks the list.
 */
export function toListViewRowClass(rowClass: EntityListRowClass | null | undefined): RowClassFn | undefined {
  if (!rowClass) {
    return undefined;
  }
  return ({ dataItem }) => {
    try {
      return rowClass(dataItem as EntityListRow) ?? {};
    } catch (error) {
      console.error('mm-entity-list: rowClass failed', error);
      return {};
    }
  };
}

/** Labels of boolean list cells (default "Yes" / "No"). */
export interface EntityListCellLabels {
  yes?: string;
  no?: string;
  /** Text of a cell holding an unset placeholder (AB#5623). Default "Not configured". */
  notConfigured?: string;
}

/** Whether a column's cells need formatting by CK value type (enum names, yes/no). */
function isFormattedType(column: ResolvedListColumn): boolean {
  const type = (column.valueType ?? '').toUpperCase().replace(/_ARRAY$/, '');
  return type === 'ENUM' || type === 'BOOLEAN';
}

/**
 * Badge mapping of a `chip` column over an ENUM / BOOLEAN attribute: the raw key (`0`, `true`)
 * shows the enum value name / yes-no label in the neutral pill (AB#5547).
 */
function chipLabels(column: ResolvedListColumn, labels: EntityListCellLabels): BadgeMappingTable | undefined {
  const type = (column.valueType ?? '').toUpperCase();
  if (type === 'ENUM' && column.enumOptions?.length) {
    const table: BadgeMappingTable = {};
    for (const option of column.enumOptions) {
      table[String(option.key)] = { label: option.name };
      table[option.name] = { label: option.name };
    }
    return table;
  }
  if (type === 'BOOLEAN') {
    return { true: { label: labels.yes ?? 'Yes' }, false: { label: labels.no ?? 'No' } };
  }
  return undefined;
}

/**
 * Maps a resolved list column onto an `mm-list-view` column definition. Cells are formatted by the
 * CK value type like the reference display of the form (AB#5547): ENUM → the enum value's name
 * (the API returns the key), BOOLEAN → yes/no, dates → localized date and time.
 */
export function toEntityListColumn(
  column: ResolvedListColumn,
  labels: EntityListCellLabels = {},
  unsetPlaceholders?: EntityFormUnsetPlaceholderLookup,
): TableColumn {
  // AB#5623: a placeholder value of a non-secret attribute reads "Not configured".
  const placeholderValues = column.kind === 'attribute' && unsetPlaceholders && !isSecretValueType(column.valueType)
    ? [...unsetPlaceholders.global, ...(unsetPlaceholders.attributes.get(column.field.toLowerCase()) ?? [])]
    : [];
  const notConfigured = labels.notConfigured ?? 'Not configured';
  const isUnset = (value: unknown): boolean => typeof value === 'string' && placeholderValues.includes(value);
  const base: TableColumn = {
    field: column.field,
    displayName: column.label,
    ...(column.width ? { width: column.width } : { minWidth: 120 }),
  };
  const attribute: CkAttributeInfo | undefined = column.valueType
    ? { attributeName: column.field, valueType: column.valueType, isOptional: true, defaultValues: [], secret: false, enumOptions: column.enumOptions }
    : undefined;
  const format = (value: unknown): string => formatReferenceDisplayValue(value, attribute, labels) ?? '';
  switch (column.display) {
    case 'chip': {
      let badgeMapping = chipLabels(column, labels);
      if (placeholderValues.length) {
        badgeMapping = { ...(badgeMapping ?? {}) };
        for (const value of placeholderValues) {
          badgeMapping[value] = { label: notConfigured };
        }
      }
      return { ...base, dataType: 'badge', ...(badgeMapping ? { badgeMapping } : {}) };
    }
    case 'date':
      return { ...base, dataType: 'iso8601', format: 'medium' };
    case 'mono':
      return {
        ...base,
        dataType: 'component',
        cellComponent: EntityListMonoCellComponent,
        cellInputs: (item: unknown) => {
          const value = (item as Record<string, unknown>)[column.field];
          if (isUnset(value)) {
            return { value: notConfigured };
          }
          return { value: isFormattedType(column) ? format(value) : value };
        },
      };
    default:
      if (placeholderValues.length) {
        return {
          ...base,
          dataType: 'text',
          truncate: true,
          formatter: (value: unknown) => isUnset(value)
            ? notConfigured
            : isFormattedType(column) ? format(value) : value === null || value === undefined ? '' : String(value),
        };
      }
      return { ...base, dataType: 'text', truncate: true, ...(isFormattedType(column) ? { formatter: format } : {}) };
  }
}

/**
 * `<mm-entity-list>` — the list view of a resolved entity form.
 *
 * Columns come from the form's `ListColumns` (secret columns are never listed or queried).
 * Row click and the "Edit"/"View" action emit {@link openRequested}; "New" emits
 * {@link createRequested} — for an abstract type only after the user picked a concrete
 * subtype. The context menu carries the Copy ID submenu (RtId / CkTypeId / RtCkTypeId /
 * RtEntityId) and, when `canDelete && canWrite`, Delete with a confirmation.
 *
 * Host extensions (AB#5623): `toolbarActions` (after New), `rowActions` (icon buttons in the
 * actions column after Edit/View), `rowMenuActions` (context menu between Copy ID and Delete) —
 * plain `CommandItem`s as in `mm-list-view`; `onClick` receives the row (`EntityListRow`) as
 * `e.data`. `rowClass` sets CSS classes per row (e.g. disabled rows). `defaultSort` (or the form's `listDefaultSort`) orders the list while the user has not
 * sorted by a column; `labelResolver` translates column titles and enum texts.
 *
 * The component does not navigate; `<mm-entity-page>` (or the host) reacts to the outputs.
 */
@Component({
  selector: 'mm-entity-list',
  standalone: true,
  imports: [ListViewComponent, EntityListDataSourceDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-list.component.html',
  styleUrl: './entity-list.component.scss',
})
export class EntityListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly dangerConfirmation = inject(ENTITY_FORM_DANGER_CONFIRMATION, { optional: true });
  private readonly actionConfirmation = inject(ENTITY_FORM_ACTION_CONFIRMATION, { optional: true });
  private readonly notificationService = inject(NotificationDisplayService);
  private readonly dataService = inject(EntityFormDataService);
  private readonly ckTypeSelectorDialog = inject(CkTypeSelectorDialogService, { optional: true });
  /** Resolves `EntityFormService` lazily: only the Type column needs the form titles. */
  private readonly injector = inject(Injector);
  private readonly injectedLabelResolver = inject(ENTITY_FORM_LABEL_RESOLVER, { optional: true });
  private readonly injectedRowClass = inject(ENTITY_LIST_ROW_CLASS, { optional: true });
  private readonly unsetPlaceholders = entityFormUnsetPlaceholderLookup(inject(ENTITY_FORM_UNSET_PLACEHOLDER_VALUES, { optional: true }));
  /** Form titles per CK type (lower-case id) for the Type column (AB#5524). */
  private readonly typeTitles = signal<ReadonlyMap<string, string>>(new Map());
  private typeTitlesRequested = false;

  /** The resolved form (`EntityFormService.resolve` / `resolveByFormKey`). */
  readonly model = input.required<ResolvedEntityForm>();
  /** Whether the current user may write (mapped from roles by the host). Default `true`. */
  readonly canWrite = input<boolean>(true);
  /** Partial message overrides; missing keys use the English defaults. */
  readonly messages = input<Partial<EntityFormsMessages>>({});
  /** `mm-list-view` state persistence key; defaults to the route path. */
  readonly listStateKey = input<string | undefined>(undefined);
  /**
   * Appends a "Type" column with the display name of each row's CK type (lists over a base type):
   * the title of the type's entity form, else the humanized type name (AB#5524).
   */
  readonly showTypeColumn = input<boolean>(false);
  /**
   * Order while the user has not sorted by a column (AB#5623). Wins over the form's
   * `listDefaultSort`; `[]` = server order. A sort the user picked (also a remembered one from
   * `listStateKey`) always wins. The column header shows no sort marker for the default order.
   */
  readonly defaultSort = input<readonly EntityListSortDescriptor[] | null | undefined>(undefined);
  /** Translates column titles and enum texts (AB#5623); wins over `ENTITY_FORM_LABEL_RESOLVER`. */
  readonly labelResolver = input<EntityFormLabelResolver | null | undefined>(undefined);
  /** Host toolbar actions, shown after "New" (AB#5623). */
  readonly toolbarActions = input<readonly CommandItem[]>([]);
  /**
   * Host row actions (AB#5623): icon buttons in the actions column after Edit / View. Set
   * `svgIcon` and `text` (tooltip / aria-label); `onClick` gets the row as `e.data`.
   */
  readonly rowActions = input<readonly CommandItem[]>([]);
  /** Host row menu entries (AB#5623): context menu, between Copy ID and Delete. */
  readonly rowMenuActions = input<readonly CommandItem[]>([]);
  /**
   * CSS classes per row (AB#5623), e.g. to style disabled rows. Wins over `ENTITY_LIST_ROW_CLASS`;
   * absent = no row classes (unchanged). See {@link EntityListRowClass}.
   */
  readonly rowClass = input<EntityListRowClass | null | undefined>(undefined);

  /** "New" was confirmed; carries the concrete type (after the subtype picker for abstract types). */
  readonly createRequested = output<EntityListCreateRequest>();
  /** A row was opened. */
  readonly openRequested = output<EntityListOpenRequest>();
  /** Entities were deleted. */
  readonly deleted = output<EntityListOpenRequest[]>();

  private readonly dataSource = viewChild(EntityListDataSourceDirective);

  protected readonly msgs = computed(() => mergeEntityFormsMessages(this.messages()));

  protected readonly listViewMessages = computed(() => ({
    searchPlaceholder: this.msgs().searchPlaceholder,
    noRecords: this.msgs().emptyList,
  }));

  protected readonly columns = computed<TableColumn[]>(() => {
    const m = this.msgs();
    const labels: EntityListCellLabels = { yes: m.toggleOn, no: m.toggleOff, notConfigured: m.notConfigured };
    const model = this.model();
    const secrets = new Set(model.secretFields.map((f) => f.toLowerCase()));
    const columns = localizeEntityListColumns(model, this.labelResolver() ?? this.injectedLabelResolver)
      .map((c) => toEntityListColumn(c, labels, secrets.has(c.field.toLowerCase()) ? undefined : this.unsetPlaceholders));
    if (this.showTypeColumn() && !columns.some((c) => c.field === 'ckTypeId')) {
      const titles = this.typeTitles();
      const changed = columns.findIndex((c) => c.field === 'rtChangedDateTime');
      const typeColumn: TableColumn = {
        field: 'ckTypeId',
        displayName: this.msgs().typeColumn,
        dataType: 'text',
        sortable: false,
        filterable: false,
        formatter: (value) => ckTypeDisplayName(String(value ?? ''), titles),
      };
      columns.splice(changed >= 0 ? changed : columns.length, 0, typeColumn);
    }
    return columns;
  });

  protected readonly canCreate = computed(() => this.canWrite() && this.model().capabilities.canCreate);
  protected readonly canDelete = computed(() => this.canWrite() && this.model().capabilities.canDelete);
  protected readonly editable = computed(() => this.canWrite() && this.model().capabilities.canEdit);

  /** Copy ID submenu (Studio convention, see the refinery-studio CLAUDE.md). */
  readonly copyIdMenuItem = computed<CommandItem>(() => {
    const m = this.msgs();
    return {
      id: 'copyId',
      type: 'link',
      text: m.copyId,
      svgIcon: MM_ACTION_ICONS.copy,
      children: [
        { id: 'copyRtId', type: 'link', text: m.copyRtId, onClick: (e) => this.copy(e, 'rtId') },
        { id: 'copyCkTypeId', type: 'link', text: m.copyCkTypeId, onClick: (e) => this.copy(e, 'ckTypeId') },
        { id: 'copyRtCkTypeId', type: 'link', text: m.copyRtCkTypeId, onClick: (e) => this.copy(e, 'rtCkTypeId') },
        { id: 'copyRtEntityId', type: 'link', text: m.copyRtEntityId, onClick: (e) => this.copy(e, 'rtEntityId') },
      ],
    };
  });

  /**
   * Context menu: Copy ID, the host's `rowMenuActions`, then (only with `canDelete && canWrite`)
   * separator + Delete.
   */
  readonly contextMenuItems = computed<CommandItem[]>(() => {
    const items: CommandItem[] = [this.copyIdMenuItem(), ...this.rowMenuActions()];
    if (this.canDelete()) {
      items.push(
        { id: 'separator1', type: 'separator' },
        {
          id: 'delete',
          type: 'link',
          text: this.msgs().delete,
          svgIcon: MM_ACTION_ICONS.delete,
          danger: true,
          onClick: (e) => this.onDelete(e),
        },
      );
    }
    return items;
  });

  /** Row action column: Edit (or View when read-only), then the host's `rowActions`. */
  readonly actionItems = computed<CommandItem[]>(() => [
    {
      id: 'open',
      type: 'link',
      text: this.editable() ? this.msgs().edit : this.msgs().viewTitle,
      svgIcon: this.editable() ? MM_ACTION_ICONS.edit : MM_ACTION_ICONS.view,
      onClick: async (e) => this.open(e.data as EntityListRow | undefined),
    },
    ...this.rowActions(),
  ]);

  /** The `mm-list-view` row class callback (input, else the token, else none). */
  protected readonly listViewRowClass = computed<RowClassFn | undefined>(() =>
    toListViewRowClass(this.rowClass() ?? this.injectedRowClass));

  /** Width of the actions column: Edit/View + the row menu, plus one icon button per host row action. */
  protected readonly actionsColumnWidth = computed(() => 80 + 40 * this.rowActions().length);

  /** Toolbar: New (only with `canCreate && canWrite`), then the host's `toolbarActions`. */
  readonly toolbarItems = computed<CommandItem[]>(() => [
    ...(this.canCreate()
      ? [{ id: 'new', type: 'link', text: this.msgs().new, svgIcon: MM_ACTION_ICONS.add, onClick: async () => this.requestCreate() } as CommandItem]
      : []),
    ...this.toolbarActions(),
  ]);

  /** The order used while the user has not sorted: the input, else the form's `listDefaultSort`. */
  protected readonly effectiveDefaultSort = computed<readonly EntityListSortDescriptor[]>(() =>
    this.defaultSort() ?? this.model().listDefaultSort ?? []);

  constructor() {
    effect(() => {
      const ds = this.dataSource();
      const model = this.model();
      const defaultSort = this.effectiveDefaultSort();
      ds?.setModel(model, defaultSort);
    });
    effect(() => {
      if (this.showTypeColumn()) {
        untracked(() => void this.loadTypeTitles());
      }
    });
  }

  /** Loads the form titles of the Type column once; without them the type names are humanized. */
  private async loadTypeTitles(): Promise<void> {
    if (this.typeTitlesRequested) {
      return;
    }
    this.typeTitlesRequested = true;
    try {
      const forms = await this.injector.get(EntityFormService).getForms();
      this.typeTitles.set(entityFormTypeTitles(forms));
    } catch (error) {
      console.warn('mm-entity-list: form titles for the Type column could not be loaded', error);
    }
  }

  /** Reloads the list. */
  refresh(): void {
    this.dataSource()?.fetchAgain();
  }

  /**
   * Starts "New". For an abstract type (`createRequiresSubtype`) the concrete-subtype picker
   * opens first; cancelling it emits nothing.
   */
  async requestCreate(): Promise<void> {
    const model = this.model();
    if (!this.canCreate()) {
      return;
    }
    if (!model.capabilities.createRequiresSubtype) {
      this.createRequested.emit({ ckTypeId: model.rtCkTypeId });
      return;
    }
    if (!this.ckTypeSelectorDialog) {
      console.warn('mm-entity-list: CkTypeSelectorDialogService is not provided (provideOctoUi()); cannot pick a subtype.');
      return;
    }
    const result = await this.ckTypeSelectorDialog.openCkTypeSelector({
      derivedFromRtCkTypeId: model.rtCkTypeId,
      allowAbstract: false,
      dialogTitle: this.msgs().selectSubtypeTitle,
    });
    if (result.confirmed && result.selectedCkType) {
      this.createRequested.emit({ ckTypeId: result.selectedCkType.rtCkTypeId });
    }
  }

  protected onRowClicked(rows: unknown[]): void {
    const row = rows?.[rows.length - 1] as EntityListRow | undefined;
    this.open(row);
  }

  private open(row: EntityListRow | undefined): void {
    if (row?.rtId) {
      this.openRequested.emit({ rtId: row.rtId, ckTypeId: row.ckTypeId || this.model().rtCkTypeId });
    }
  }

  private async onDelete(e: CommandItemExecuteEventArgs): Promise<void> {
    if (!this.canDelete()) {
      return;
    }
    const rows = (Array.isArray(e.data) ? e.data : [e.data]).filter(
      (r): r is EntityListRow => !!(r as EntityListRow | undefined)?.rtId,
    );
    if (rows.length === 0) {
      return;
    }
    const request = {
      action: 'delete' as const,
      ckTypeId: rows[0].ckTypeId || this.model().rtCkTypeId,
      count: rows.length,
      description: rows.length === 1 ? 'delete 1 entity' : `delete ${rows.length} entities`,
    };
    if (!await confirmEntityFormAction(this.actionConfirmation, request)) {
      return;
    }
    const m = this.msgs();
    const options = entityDeleteConfirmation(m, rows.map(rowName));
    if (!await confirmEntityFormDanger(this.dangerConfirmation, this.confirmationService, options, request)) {
      return;
    }
    const entities = rows.map((r) => ({ rtId: r.rtId, ckTypeId: r.ckTypeId || this.model().rtCkTypeId }));
    try {
      const ok = await this.dataService.delete(entities);
      if (!ok) {
        this.notificationService.showError(m.deleteError);
        return;
      }
      this.notificationService.showSuccess(m.deleteSuccess, 3000);
      this.deleted.emit(entities);
      this.dataSource()?.fetchAgain();
    } catch (error) {
      console.error('mm-entity-list: delete failed', error);
      this.notificationService.showError(m.deleteError, error instanceof Error ? error.message : undefined);
    }
  }

  private async copy(e: CommandItemExecuteEventArgs, kind: 'rtId' | 'ckTypeId' | 'rtCkTypeId' | 'rtEntityId'): Promise<void> {
    const row = e.data as EntityListRow | undefined;
    if (!row?.rtId) {
      return;
    }
    const m = this.msgs();
    // Rows carry the runtime ckTypeId only; it is both the CkTypeId and the RtCkTypeId here.
    const ckTypeId = row.ckTypeId || this.model().rtCkTypeId;
    const values = {
      rtId: { value: row.rtId, label: m.copyRtId },
      ckTypeId: { value: ckTypeId, label: m.copyCkTypeId },
      rtCkTypeId: { value: ckTypeId, label: m.copyRtCkTypeId },
      rtEntityId: { value: `${ckTypeId}@${row.rtId}`, label: m.copyRtEntityId },
    } as const;
    const { value, label } = values[kind];
    try {
      await navigator.clipboard.writeText(value);
      this.notificationService.showSuccess(formatEntityFormsMessage(m.copiedId, { label }), 2000);
    } catch (error) {
      console.error('mm-entity-list: failed to copy to clipboard', error);
      this.notificationService.showError(m.copyFailed);
    }
  }
}

function rowName(row: EntityListRow): string {
  const name = row['name'];
  if (typeof name === 'string' && name) {
    return name;
  }
  return row.rtWellKnownName || row.rtDisplayName || row.rtId;
}

/**
 * `System.Communication/SftpConfiguration` → `SFTP configuration`.
 * @deprecated Use `humanizeCkTypeName` (or `ckTypeDisplayName` with form titles).
 */
export function shortTypeName(ckTypeId: string): string {
  return humanizeCkTypeName(ckTypeId) || ckTypeId;
}
