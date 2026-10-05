import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import type { CkRecordInfo } from '../../models/entity-form.models';
import { EntityFormsMessages, mergeEntityFormsMessages } from '../../entity-forms.messages';
import {
  buildRecordFieldModels,
  buildRow,
  formatRecordCell,
  RecordFieldModel,
  toControlValue
} from './entity-form-record-row';

/**
 * Row editor of `mm-entity-form-records-field`. Fields are generated from the record's CK
 * attributes with the auto-editor rules; every sub-field is optional (see
 * `buildRecordFieldModels`). Nested RECORD / RECORD_ARRAY sub-fields and unsupported value types
 * are shown read-only and their values are passed through unchanged.
 *
 * Closes its `DialogRef` with the resulting flat camelCase row, or with `undefined` on cancel.
 */
@Component({
  selector: 'mm-entity-form-record-row-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonsModule, InputsModule, DateInputsModule, DropDownsModule],
  template: `
    <form class="mm-efr-dialog" [formGroup]="form()" (ngSubmit)="onApply()">
      @for (field of fields(); track field.attributeName) {
        <div class="mm-efr-field" [attr.data-attribute]="field.attributeName">
          <label class="mm-efr-label" [attr.for]="'efr-' + field.attributeName">{{ field.label }}</label>
          @switch (field.editor) {
            @case ('text') {
              <kendo-textbox [id]="'efr-' + field.attributeName" [formControlName]="field.attributeName"></kendo-textbox>
            }
            @case ('number') {
              <kendo-numerictextbox [id]="'efr-' + field.attributeName" [formControlName]="field.attributeName"
                                    [spinners]="false" format="#.##########"></kendo-numerictextbox>
            }
            @case ('toggle') {
              <kendo-switch [id]="'efr-' + field.attributeName" [formControlName]="field.attributeName"></kendo-switch>
            }
            @case ('datetime') {
              <kendo-datetimepicker [id]="'efr-' + field.attributeName" [formControlName]="field.attributeName"></kendo-datetimepicker>
            }
            @case ('enum') {
              <kendo-dropdownlist [id]="'efr-' + field.attributeName" [formControlName]="field.attributeName"
                                  [data]="field.enumOptions ?? []" textField="name" valueField="key"
                                  [valuePrimitive]="true" [defaultItem]="enumDefaultItem()"></kendo-dropdownlist>
            }
            @case ('chips') {
              <kendo-multiselect [id]="'efr-' + field.attributeName" [formControlName]="field.attributeName"
                                 [data]="[]" [allowCustom]="true" [placeholder]="msg().chipsPlaceholder"></kendo-multiselect>
            }
            @default {
              <div class="mm-efr-readonly" [id]="'efr-' + field.attributeName">
                <span class="mm-efr-readonly-value">{{ display(field) }}</span>
                <span class="mm-efr-hint">{{ field.editor === 'nested' ? msg().nestedRecordReadOnly : msg().unsupportedEditor }}</span>
              </div>
            }
          }
          @if (field.description) {
            <small class="mm-efr-help">{{ field.description }}</small>
          }
        </div>
      }
      <div class="mm-efr-actions">
        <button kendoButton type="button" (click)="onCancel()">{{ msg().cancel }}</button>
        @if (!readOnly()) {
          <button kendoButton type="submit" themeColor="primary">{{ msg().apply }}</button>
        }
      </div>
    </form>
  `,
  styles: [`
    :host { display: block; }
    .mm-efr-dialog { display: flex; flex-direction: column; gap: 12px; min-width: 320px; }
    .mm-efr-field { display: flex; flex-direction: column; gap: 4px; }
    .mm-efr-label { font-weight: 500; color: var(--theme-text-primary, inherit); }
    .mm-efr-help, .mm-efr-hint { color: var(--theme-text-secondary, inherit); font-size: 0.85em; }
    .mm-efr-readonly { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
    .mm-efr-readonly-value { font-family: monospace; word-break: break-all; }
    .mm-efr-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `]
})
export class EntityFormRecordRowDialogComponent {
  private readonly dialogRef = inject(DialogRef, { optional: true });

  /** CK metadata of the record; set by the opener (`ComponentRef.setInput`). */
  readonly record = input<CkRecordInfo | null>(null);
  /** Row being edited; `null` adds a new row. */
  readonly row = input<Record<string, unknown> | null>(null);
  readonly readOnly = input(false);
  readonly messages = input<Partial<EntityFormsMessages>>({});

  protected readonly msg = computed(() => mergeEntityFormsMessages(this.messages()));
  protected readonly fields = computed<RecordFieldModel[]>(() => buildRecordFieldModels(this.record()?.attributes ?? []));
  protected readonly enumDefaultItem = computed(() => ({ key: null, name: this.msg().enumPlaceholder }));

  /** Rebuilt whenever the record metadata, the row or the read-only state changes. */
  readonly form = computed(() => this.buildForm(this.fields(), this.row(), this.readOnly()));

  /** The row resulting from the current form state (original keys preserved). */
  result(): Record<string, unknown> {
    return buildRow(this.fields(), this.row(), this.form().getRawValue());
  }

  protected display(field: RecordFieldModel): string {
    return formatRecordCell(this.row()?.[field.attributeName], field.enumOptions);
  }

  protected onApply(): void {
    if (this.readOnly()) {
      this.onCancel();
      return;
    }
    this.dialogRef?.close(this.result());
  }

  protected onCancel(): void {
    this.dialogRef?.close(undefined);
  }

  private buildForm(
    fields: RecordFieldModel[],
    row: Record<string, unknown> | null,
    readOnly: boolean
  ): FormGroup<Record<string, FormControl<unknown>>> {
    const form = new FormGroup<Record<string, FormControl<unknown>>>({});
    for (const field of fields) {
      if (field.readOnly) {
        continue;
      }
      const control = new FormControl<unknown>(toControlValue(field, row?.[field.attributeName]));
      if (readOnly) {
        control.disable({ emitEvent: false });
      }
      form.addControl(field.attributeName, control, { emitEvent: false });
    }
    return form;
  }
}
