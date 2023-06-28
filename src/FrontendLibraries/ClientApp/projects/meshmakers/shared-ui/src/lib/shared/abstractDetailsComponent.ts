import { FormGroup } from '@angular/forms';
import { IsoDateTime } from '@meshmakers/shared-services';

export abstract class AbstractDetailsComponent<TEntity> {
  public loading: boolean;
  protected entity: TEntity | null;

  protected constructor(formGroup: FormGroup) {
    this.loading = true;
    this.entity = null;
    this._ownerForm = formGroup;
  }

  private readonly _ownerForm: FormGroup;

  public get ownerForm(): FormGroup {
    return this._ownerForm;
  }

  public get isLoaded(): boolean {
    return this.entity !== null;
  }

  public hasError = (controlName: string, errorName: string): boolean => {
    return this.ownerForm?.controls[controlName].hasError(errorName);
  };

  public hasFormError = (errorName: string): boolean => {
    return this.ownerForm?.hasError(errorName);
  };

  public updateDateTime(controlName: string): void {
    this.ownerForm
      ?.get(controlName)
      ?.setValue(
        IsoDateTime.utcToLocalDateTimeIso(IsoDateTime.currentUtcDateTimeIso())
      );
  }

  public copyInputMessage(inputElement: any): void {
    inputElement.select();
    document.execCommand('copy');
    inputElement.setSelectionRange(0, 0);
  }

  protected onProgressStarting(): void {
    this.loading = true;
    this.ownerForm?.disable();
    this.ownerForm?.updateValueAndValidity();
  }

  protected onProgressCompleted(): void {
    this.ownerForm?.enable();
    this.loading = false;
  }
}
