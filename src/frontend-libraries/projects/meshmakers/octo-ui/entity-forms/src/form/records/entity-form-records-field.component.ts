import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GridModule } from '@progress/kendo-angular-grid';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { DialogCloseResult, DialogService } from '@progress/kendo-angular-dialog';
import { arrowDownIcon, arrowUpIcon, pencilIcon, plusIcon, trashIcon, eyeIcon } from '@progress/kendo-svg-icons';
import type { CkRecordInfo } from '../../models/entity-form.models';
import { EntityFormsMessages, mergeEntityFormsMessages } from '../../entity-forms.messages';
import { EntityFormService } from '../../services/entity-form.service';
import { buildRecordFieldModels, formatRecordCell, humanizeAttributeName } from './entity-form-record-row';
import { EntityFormRecordRowDialogComponent } from './entity-form-record-row-dialog.component';

/** Grid column of the records editor. */
export interface EntityFormRecordColumn {
  path: string;
  label: string;
}

/** Number of columns derived from the record metadata when the form lists none. */
const DERIVED_COLUMN_COUNT = 4;

/** Grid row: the stored dict plus its position (rows have no identity of their own). */
interface GridRow {
  index: number;
  row: Record<string, unknown>;
}

/**
 * Records editor of `mm-entity-form` for RECORD and RECORD_ARRAY attributes.
 *
 * - **Value:** `Record<string, unknown>[]`, one flat camelCase dict per record
 *   (`{ key: 'a', order: 1 }`, the write shape of the value mapper). A single RECORD uses an array
 *   of at most one entry (`single = true`); `[]` means "no record".
 * - **Grid:** add / edit / move up / move down / remove. Edit and add open
 *   `EntityFormRecordRowDialogComponent`, whose fields come from `EntityFormService.getCkRecord()`.
 * - **Limits:** `single` disables "add" once one row exists. Nested RECORD / RECORD_ARRAY sub-fields
 *   are read-only in the row dialog and their values are passed through unchanged.
 */
@Component({
  selector: 'mm-entity-form-records-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridModule, ButtonsModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EntityFormRecordsFieldComponent), multi: true }
  ],
  template: `
    <div class="mm-efrec">
      @if (!isDisabled()) {
        <div class="mm-efrec-toolbar">
          <button kendoButton type="button" size="small" [svgIcon]="icons.plus" class="mm-efrec-add"
                  [disabled]="!canAdd()" (click)="addRow()">{{ msg().add }}</button>
        </div>
      }
      <kendo-grid [data]="gridRows()" [sortable]="false" [pageable]="false" [scrollable]="'none'" class="mm-efrec-grid">
        @for (column of effectiveColumns(); track column.path) {
          <kendo-grid-column [title]="column.label">
            <ng-template kendoGridCellTemplate let-dataItem>
              <span class="mm-efrec-cell">{{ cellText(dataItem.row, column.path) }}</span>
            </ng-template>
          </kendo-grid-column>
        }
        <kendo-grid-column [title]="msg().columnActions" [width]="isDisabled() ? 60 : 170">
          <ng-template kendoGridCellTemplate let-dataItem>
            <div class="mm-efrec-actions">
              @if (isDisabled()) {
                <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="icons.view"
                        [title]="msg().viewTitle" [attr.aria-label]="msg().viewTitle" (click)="editRow(dataItem.index)"></button>
              } @else {
                <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="icons.edit" class="mm-efrec-edit"
                        [title]="msg().edit" [attr.aria-label]="msg().edit" (click)="editRow(dataItem.index)"></button>
                <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="icons.up" class="mm-efrec-up"
                        [title]="msg().moveUp" [attr.aria-label]="msg().moveUp" [disabled]="dataItem.index === 0"
                        (click)="moveUp(dataItem.index)"></button>
                <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="icons.down" class="mm-efrec-down"
                        [title]="msg().moveDown" [attr.aria-label]="msg().moveDown" [disabled]="dataItem.index === rows().length - 1"
                        (click)="moveDown(dataItem.index)"></button>
                <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="icons.remove" class="mm-efrec-remove"
                        [title]="msg().remove" [attr.aria-label]="msg().remove" (click)="removeRow(dataItem.index)"></button>
              }
            </div>
          </ng-template>
        </kendo-grid-column>
        <ng-template kendoGridNoRecordsTemplate>
          <span class="mm-efrec-empty">{{ msg().emptyRecords }}</span>
        </ng-template>
      </kendo-grid>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .mm-efrec { display: flex; flex-direction: column; gap: 6px; }
    .mm-efrec-toolbar { display: flex; justify-content: flex-end; }
    .mm-efrec-actions { display: flex; gap: 2px; justify-content: flex-end; }
    .mm-efrec-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
    .mm-efrec-empty { color: var(--theme-text-secondary); font-style: italic; }
  `]
})
export class EntityFormRecordsFieldComponent implements ControlValueAccessor {
  private readonly entityFormService = inject(EntityFormService);
  private readonly dialogService = inject(DialogService);

  readonly ckRecordId = input.required<string>();
  readonly columns = input<EntityFormRecordColumn[] | null | undefined>([]);
  readonly single = input(false);
  readonly readOnly = input(false);
  readonly messages = input<Partial<EntityFormsMessages>>({});

  protected readonly icons = { plus: plusIcon, edit: pencilIcon, up: arrowUpIcon, down: arrowDownIcon, remove: trashIcon, view: eyeIcon };
  protected readonly msg = computed(() => mergeEntityFormsMessages(this.messages()));

  protected readonly rows = signal<Record<string, unknown>[]>([]);
  private readonly disabledByForm = signal(false);
  protected readonly isDisabled = computed(() => this.readOnly() || this.disabledByForm());
  /** CK metadata of the record, loaded per `ckRecordId`; `null` until loaded or when unknown. */
  readonly record = signal<CkRecordInfo | null>(null);

  protected readonly gridRows = computed<GridRow[]>(() => this.rows().map((row, index) => ({ index, row })));
  readonly canAdd = computed(() => !this.isDisabled() && (!this.single() || this.rows().length === 0));

  /** Configured columns, or the first record attributes when the form lists none. */
  readonly effectiveColumns = computed<EntityFormRecordColumn[]>(() => {
    const configured = this.columns() ?? [];
    if (configured.length > 0) {
      return configured;
    }
    return (this.record()?.attributes ?? [])
      .slice(0, DERIVED_COLUMN_COUNT)
      .map(a => ({ path: a.attributeName, label: humanizeAttributeName(a.attributeName) }));
  });

  private readonly enumOptionsByAttribute = computed(() => {
    const result = new Map<string, { key: number; name: string }[]>();
    for (const field of buildRecordFieldModels(this.record()?.attributes ?? [])) {
      if (field.enumOptions) {
        result.set(field.attributeName.toLowerCase(), field.enumOptions);
      }
    }
    return result;
  });

  private onChange: (value: Record<string, unknown>[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private recordRequest = 0;

  constructor() {
    effect(() => {
      const id = this.ckRecordId();
      void this.loadRecord(id);
    });
  }

  /** Current value (a shallow copy). */
  getValue(): Record<string, unknown>[] {
    return this.rows().map(r => ({ ...r }));
  }

  writeValue(value: Record<string, unknown>[] | Record<string, unknown> | null | undefined): void {
    if (Array.isArray(value)) {
      this.rows.set(value.filter(r => r !== null && typeof r === 'object').map(r => ({ ...r })));
    } else if (value && typeof value === 'object') {
      // Tolerate a bare dict for a single RECORD.
      this.rows.set([{ ...value }]);
    } else {
      this.rows.set([]);
    }
  }

  registerOnChange(fn: (value: Record<string, unknown>[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }

  protected cellText(row: Record<string, unknown>, path: string): string {
    const key = Object.keys(row).find(k => k.toLowerCase() === path.toLowerCase()) ?? path;
    return formatRecordCell(row[key], this.enumOptionsByAttribute().get(path.toLowerCase()));
  }

  /** Opens the row dialog for a new row and appends the result. No-op when the limit is reached. */
  async addRow(): Promise<void> {
    if (!this.canAdd()) {
      return;
    }
    const row = await this.openRowDialog(null);
    if (row && this.canAdd()) {
      this.commit([...this.rows(), row]);
    }
  }

  /** Opens the row dialog for an existing row; in read-only mode the dialog only displays it. */
  async editRow(index: number): Promise<void> {
    const current = this.rows()[index];
    if (!current) {
      return;
    }
    const row = await this.openRowDialog(current);
    if (row && !this.isDisabled()) {
      const next = [...this.rows()];
      next[index] = row;
      this.commit(next);
    }
  }

  removeRow(index: number): void {
    if (this.isDisabled() || index < 0 || index >= this.rows().length) {
      return;
    }
    this.commit(this.rows().filter((_, i) => i !== index));
  }

  moveUp(index: number): void {
    this.swap(index, index - 1);
  }

  moveDown(index: number): void {
    this.swap(index, index + 1);
  }

  /**
   * Opens `EntityFormRecordRowDialogComponent` and resolves with the edited row, or `undefined` when
   * cancelled. Protected seam so specs can stub the dialog.
   */
  protected async openRowDialog(row: Record<string, unknown> | null): Promise<Record<string, unknown> | undefined> {
    const record = this.record() ?? await this.loadRecord(this.ckRecordId());
    const m = this.msg();
    const dialogRef = this.dialogService.open({
      content: EntityFormRecordRowDialogComponent,
      title: row ? (this.isDisabled() ? m.viewTitle : m.recordRowDialogTitleEdit) : m.recordRowDialogTitleAdd,
      minWidth: 420,
      maxWidth: '90vw',
      maxHeight: '90vh'
    });
    const content = dialogRef.content;
    if (content) {
      content.setInput('record', record ?? { ckRecordId: this.ckRecordId(), attributes: [] });
      content.setInput('row', row);
      content.setInput('readOnly', this.isDisabled());
      content.setInput('messages', this.messages());
    }
    const result = await firstValueFrom(dialogRef.result);
    if (result && typeof result === 'object' && !(result instanceof DialogCloseResult)) {
      return result as unknown as Record<string, unknown>;
    }
    return undefined;
  }

  private swap(from: number, to: number): void {
    const rows = this.rows();
    if (this.isDisabled() || from < 0 || to < 0 || from >= rows.length || to >= rows.length) {
      return;
    }
    const next = [...rows];
    [next[from], next[to]] = [next[to], next[from]];
    this.commit(next);
  }

  private commit(next: Record<string, unknown>[]): void {
    this.rows.set(next);
    this.onTouched();
    this.onChange(this.getValue());
  }

  private async loadRecord(ckRecordId: string): Promise<CkRecordInfo | null> {
    const request = ++this.recordRequest;
    if (!ckRecordId) {
      this.record.set(null);
      return null;
    }
    try {
      const info = (await this.entityFormService.getCkRecord(ckRecordId)) ?? null;
      if (request === this.recordRequest) {
        this.record.set(info);
      }
      return info;
    } catch (error) {
      console.warn(`[entity-forms] Record metadata for ${ckRecordId} could not be loaded.`, error);
      if (request === this.recordRequest) {
        this.record.set(null);
      }
      return null;
    }
  }
}
