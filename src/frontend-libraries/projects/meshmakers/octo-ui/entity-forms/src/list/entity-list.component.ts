import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CkTypeSelectorDialogService } from '@meshmakers/octo-ui';
import { CommandItem, CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import {
  BadgeMappingTable,
  ConfirmationService,
  ListViewComponent,
  NotificationDisplayService,
  TableColumn,
} from '@meshmakers/shared-ui';
import { copyIcon, eyeIcon, pencilIcon, plusIcon, trashIcon } from '@progress/kendo-svg-icons';
import {
  EntityFormsMessages,
  formatEntityFormsMessage,
  mergeEntityFormsMessages,
} from '../entity-forms.messages';
import { CkAttributeInfo, ResolvedEntityForm, ResolvedListColumn } from '../models/entity-form.models';
import { formatReferenceDisplayValue } from '../form/reference/reference-display-format';
import { EntityFormDataService } from '../services/entity-form-data.service';
import { EntityListDataSourceDirective, EntityListRow } from './entity-list-data-source.directive';
import { EntityListMonoCellComponent } from './entity-list-mono-cell.component';
import { confirmEntityFormAction, ENTITY_FORM_ACTION_CONFIRMATION } from '../core/action-confirmation';

/** Payload of {@link EntityListComponent.createRequested}: the concrete type to create. */
export interface EntityListCreateRequest {
  ckTypeId: string;
}

/** Payload of {@link EntityListComponent.openRequested}. */
export interface EntityListOpenRequest {
  rtId: string;
  ckTypeId: string;
}

/** Labels of boolean list cells (default "Yes" / "No"). */
export interface EntityListCellLabels {
  yes?: string;
  no?: string;
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
export function toEntityListColumn(column: ResolvedListColumn, labels: EntityListCellLabels = {}): TableColumn {
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
      const badgeMapping = chipLabels(column, labels);
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
          return { value: isFormattedType(column) ? format(value) : value };
        },
      };
    default:
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
  private readonly actionConfirmation = inject(ENTITY_FORM_ACTION_CONFIRMATION, { optional: true });
  private readonly notificationService = inject(NotificationDisplayService);
  private readonly dataService = inject(EntityFormDataService);
  private readonly ckTypeSelectorDialog = inject(CkTypeSelectorDialogService, { optional: true });

  /** The resolved form (`EntityFormService.resolve` / `resolveByFormKey`). */
  readonly model = input.required<ResolvedEntityForm>();
  /** Whether the current user may write (mapped from roles by the host). Default `true`. */
  readonly canWrite = input<boolean>(true);
  /** Partial message overrides; missing keys use the English defaults. */
  readonly messages = input<Partial<EntityFormsMessages>>({});
  /** `mm-list-view` state persistence key; defaults to the route path. */
  readonly listStateKey = input<string | undefined>(undefined);
  /** Appends a "Type" column with the short CK type name of each row (lists over a base type). */
  readonly showTypeColumn = input<boolean>(false);

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
    const labels: EntityListCellLabels = { yes: m.toggleOn, no: m.toggleOff };
    const columns = this.model().listColumns.map((c) => toEntityListColumn(c, labels));
    if (this.showTypeColumn() && !columns.some((c) => c.field === 'ckTypeId')) {
      const changed = columns.findIndex((c) => c.field === 'rtChangedDateTime');
      const typeColumn: TableColumn = {
        field: 'ckTypeId',
        displayName: this.msgs().typeColumn,
        dataType: 'text',
        sortable: false,
        filterable: false,
        formatter: (value) => shortTypeName(String(value ?? '')),
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
      svgIcon: copyIcon,
      children: [
        { id: 'copyRtId', type: 'link', text: m.copyRtId, onClick: (e) => this.copy(e, 'rtId') },
        { id: 'copyCkTypeId', type: 'link', text: m.copyCkTypeId, onClick: (e) => this.copy(e, 'ckTypeId') },
        { id: 'copyRtCkTypeId', type: 'link', text: m.copyRtCkTypeId, onClick: (e) => this.copy(e, 'rtCkTypeId') },
        { id: 'copyRtEntityId', type: 'link', text: m.copyRtEntityId, onClick: (e) => this.copy(e, 'rtEntityId') },
      ],
    };
  });

  /** Context menu: Copy ID, then (only with `canDelete && canWrite`) separator + Delete. */
  readonly contextMenuItems = computed<CommandItem[]>(() => {
    const items: CommandItem[] = [this.copyIdMenuItem()];
    if (this.canDelete()) {
      items.push(
        { id: 'separator1', type: 'separator' },
        {
          id: 'delete',
          type: 'link',
          text: this.msgs().delete,
          svgIcon: trashIcon,
          onClick: (e) => this.onDelete(e),
        },
      );
    }
    return items;
  });

  /** Row action column: Edit (or View when read-only). */
  readonly actionItems = computed<CommandItem[]>(() => [
    {
      id: 'open',
      type: 'link',
      text: this.editable() ? this.msgs().edit : this.msgs().viewTitle,
      svgIcon: this.editable() ? pencilIcon : eyeIcon,
      onClick: async (e) => this.open(e.data as EntityListRow | undefined),
    },
  ]);

  /** Toolbar: New (only with `canCreate && canWrite`). */
  readonly toolbarItems = computed<CommandItem[]>(() =>
    this.canCreate()
      ? [{ id: 'new', type: 'link', text: this.msgs().new, svgIcon: plusIcon, onClick: async () => this.requestCreate() }]
      : [],
  );

  constructor() {
    effect(() => {
      const ds = this.dataSource();
      const model = this.model();
      ds?.setModel(model);
    });
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
    const allowed = await confirmEntityFormAction(this.actionConfirmation, {
      action: 'delete',
      ckTypeId: rows[0].ckTypeId || this.model().rtCkTypeId,
      count: rows.length,
      description: rows.length === 1 ? 'delete 1 entity' : `delete ${rows.length} entities`,
    });
    if (!allowed) {
      return;
    }
    const m = this.msgs();
    const message = rows.length === 1
      ? formatEntityFormsMessage(m.confirmDeleteMessage, { name: rowName(rows[0]) })
      : formatEntityFormsMessage(m.confirmDeleteManyMessage, { count: rows.length });
    const confirmed = await this.confirmationService.showYesNoConfirmationDialog(m.confirmDeleteTitle, message);
    if (!confirmed) {
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
      this.notificationService.showSuccess(`${label}: ${m.copied}`, 2000);
    } catch (error) {
      console.error('mm-entity-list: failed to copy to clipboard', error);
      this.notificationService.showError('Failed to copy to clipboard');
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

/** `System.Communication/SftpConfiguration` → `Sftp configuration`. */
export function shortTypeName(ckTypeId: string): string {
  const name = ckTypeId.split('/').pop()?.replace(/-\d+$/, '') ?? '';
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ckTypeId;
}
