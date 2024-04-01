import { FormGroup } from '@angular/forms';
import { IsoDateTime } from '@meshmakers/shared-services';

export abstract class AbstractDetailsComponent<TEntity> {
  private _loading: boolean;
  private readonly _ownerForm: FormGroup;
  private _entity: TEntity | null;

  protected constructor(formGroup: FormGroup) {
    this._loading = true;
    this._entity = null;
    this._ownerForm = formGroup;
  }

  public get loading(): boolean {
    return this._loading;
  }

  public set loading(value: boolean) {
    this._loading = value;
  }

  public get entity(): TEntity | null {
    return this._entity;
  }

  public set entity(value: TEntity | null) {
    this._entity = value;
  }

  public get ownerForm(): FormGroup {
    return this._ownerForm;
  }

  public get isLoaded(): boolean {
    return this._entity !== null;
  }

  public hasError = (controlName: string, errorName: string): boolean => {
    return this.ownerForm?.controls[controlName].hasError(errorName);
  };

  public hasFormError = (errorName: string): boolean => {
    return this.ownerForm?.hasError(errorName);
  };

  public updateDateTime(controlName: string): void {
    this.ownerForm?.get(controlName)?.setValue(IsoDateTime.utcToLocalDateTimeIso(IsoDateTime.currentUtcDateTimeIso()));
  }

  public copyInputMessage(inputElement: any): void {
    inputElement.select();
    document.execCommand('copy');
    inputElement.setSelectionRange(0, 0);
  }

  protected onProgressStarting(): void {
    this._loading = true;
    this.ownerForm?.disable();
    this.ownerForm?.updateValueAndValidity();
  }

  protected onProgressCompleted(): void {
    this.ownerForm?.enable();
    this._loading = false;
  }
}
