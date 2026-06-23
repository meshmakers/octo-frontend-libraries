import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogRef, DialogModule, DialogContentBase } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import {
  SaveAsDialogOptions,
  SaveAsDialogResult,
  SaveAsDialogDataSource,
  NameAvailabilityResult
} from './save-as-dialog-data-source';
import {
  SaveAsDialogMessages,
  DEFAULT_SAVE_AS_DIALOG_MESSAGES,
} from './save-as-dialog.messages';

@Component({
  selector: 'mm-save-as-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonsModule,
    InputsModule,
    LabelModule,
    IndicatorsModule
  ],
  template: `
    <div class="save-as-container">
      <div class="form-group">
        <kendo-label [for]="nameInput" [text]="nameLabel"></kendo-label>
        <kendo-textbox
          #nameInput
          [formControl]="nameControl"
          [placeholder]="placeholder"
          [maxlength]="maxLength"
          class="name-input">
        </kendo-textbox>

        <div class="validation-container">
          <div class="validation-message error" *ngIf="nameControl.touched && nameControl.errors?.['required']">
            {{ _messages.nameRequired }}
          </div>
          <div class="validation-message error" *ngIf="nameControl.touched && nameControl.errors?.['minlength']">
            {{ formatNameTooShort(minLength) }}
          </div>
          <div class="validation-message error" *ngIf="nameControl.touched && nameControl.errors?.['maxlength']">
            {{ formatNameTooLong(maxLength) }}
          </div>
          <div class="validation-message error" *ngIf="nameControl.touched && nameControl.errors?.['pattern']">
            {{ patternErrorMessage }}
          </div>
          <div class="validation-message error" *ngIf="nameControl.touched && nameControl.errors?.['nameTaken']">
            {{ availabilityMessage }}
          </div>

          <div class="availability-check" *ngIf="isCheckingAvailability">
            <kendo-loader size="small" type="pulsing"></kendo-loader>
            <span>{{ _messages.checkingAvailability }}</span>
          </div>

          <div class="validation-message success" *ngIf="isNameAvailable && !isCheckingAvailability && nameControl.valid">
            {{ _messages.nameAvailable }}
          </div>
        </div>
      </div>
    </div>

    <kendo-dialog-actions>
      <button kendoButton (click)="onCancel()">{{ cancelButtonText }}</button>
      <button
        kendoButton
        themeColor="primary"
        [disabled]="!canSave()"
        (click)="onSave()">
        {{ saveButtonText }}
      </button>
    </kendo-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .save-as-container {
      padding: 20px;
      min-width: 350px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .name-input {
      width: 100%;
    }

    .validation-container {
      min-height: 24px;
    }

    .validation-message {
      font-size: 12px;
      padding: 4px 0;
    }

    .validation-message.error {
      color: var(--kendo-color-error, #dc3545);
    }

    .validation-message.success {
      color: var(--kendo-color-success, #28a745);
    }

    .availability-check {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--kendo-color-subtle, #6c757d);
    }
  `]
})
export class SaveAsDialogComponent extends DialogContentBase implements OnInit, OnDestroy {
  public nameControl = new FormControl('', { nonNullable: true });

  public nameLabel = DEFAULT_SAVE_AS_DIALOG_MESSAGES.nameLabel;
  public placeholder = DEFAULT_SAVE_AS_DIALOG_MESSAGES.placeholder;
  public saveButtonText = DEFAULT_SAVE_AS_DIALOG_MESSAGES.save;
  public cancelButtonText = DEFAULT_SAVE_AS_DIALOG_MESSAGES.cancel;
  public minLength = 1;
  public maxLength = 255;
  public patternErrorMessage = DEFAULT_SAVE_AS_DIALOG_MESSAGES.patternError;

  public isCheckingAvailability = false;
  public isNameAvailable = false;
  public availabilityMessage = '';

  public _messages: SaveAsDialogMessages = { ...DEFAULT_SAVE_AS_DIALOG_MESSAGES };

  private dataSource?: SaveAsDialogDataSource;
  private debounceMs = 300;
  private subscriptions = new Subscription();
  private checkSubject = new Subject<string>();

  constructor() {
    super(inject(DialogRef));
  }

  ngOnInit(): void {
    const options = (this.dialog.content as { instance?: { options?: SaveAsDialogOptions } })?.instance?.options;

    if (options) {
      this._messages = { ...DEFAULT_SAVE_AS_DIALOG_MESSAGES, ...(options.messages ?? {}) };
      this.nameLabel = options.nameLabel || this._messages.nameLabel;
      this.placeholder = options.placeholder || this._messages.placeholder;
      this.saveButtonText = options.saveButtonText || this._messages.save;
      this.cancelButtonText = options.cancelButtonText || this._messages.cancel;
      this.minLength = options.minLength ?? 1;
      this.maxLength = options.maxLength ?? 255;
      this.patternErrorMessage = options.patternErrorMessage || this._messages.patternError;
      this.dataSource = options.dataSource;
      this.debounceMs = options.debounceTime ?? 300;

      const validators = [
        Validators.required,
        Validators.minLength(this.minLength),
        Validators.maxLength(this.maxLength)
      ];

      if (options.pattern) {
        validators.push(Validators.pattern(options.pattern));
      }

      this.nameControl.setValidators(validators);

      if (options.suggestedName) {
        this.nameControl.setValue(options.suggestedName);
      }
    }

    if (this.dataSource) {
      this.setupAvailabilityCheck();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.checkSubject.complete();
  }

  protected formatNameTooShort(min: number): string {
    return this._messages.nameTooShort.replace('{0}', String(min));
  }

  protected formatNameTooLong(max: number): string {
    return this._messages.nameTooLong.replace('{0}', String(max));
  }

  private setupAvailabilityCheck(): void {
    this.subscriptions.add(
      this.checkSubject.pipe(
        debounceTime(this.debounceMs),
        distinctUntilChanged(),
        tap(() => {
          this.isCheckingAvailability = true;
          this.isNameAvailable = false;
        }),
        switchMap(name => this.dataSource!.checkNameAvailability(name))
      ).subscribe({
        next: (result: NameAvailabilityResult) => {
          this.isCheckingAvailability = false;
          this.isNameAvailable = result.isAvailable;
          this.availabilityMessage = result.message || this._messages.nameAlreadyTaken;

          if (!result.isAvailable) {
            this.nameControl.setErrors({ ...this.nameControl.errors, nameTaken: true });
          } else {
            if (this.nameControl.errors?.['nameTaken']) {
              const { nameTaken, ...otherErrors } = this.nameControl.errors;
              this.nameControl.setErrors(Object.keys(otherErrors).length ? otherErrors : null);
            }
          }
        },
        error: () => {
          this.isCheckingAvailability = false;
        }
      })
    );

    this.subscriptions.add(
      this.nameControl.valueChanges.subscribe(value => {
        if (value && value.length >= this.minLength && !this.nameControl.errors?.['pattern']) {
          this.checkSubject.next(value);
        } else {
          this.isNameAvailable = false;
        }
      })
    );
  }

  public canSave(): boolean {
    if (this.isCheckingAvailability) {
      return false;
    }

    if (!this.nameControl.valid) {
      return false;
    }

    if (this.dataSource && !this.isNameAvailable) {
      return false;
    }

    return true;
  }

  public onSave(): void {
    if (!this.canSave()) {
      return;
    }

    const result: SaveAsDialogResult = {
      confirmed: true,
      name: this.nameControl.value
    };
    this.dialog.close(result);
  }

  public onCancel(): void {
    const result: SaveAsDialogResult = {
      confirmed: false
    };
    this.dialog.close(result);
  }
}
