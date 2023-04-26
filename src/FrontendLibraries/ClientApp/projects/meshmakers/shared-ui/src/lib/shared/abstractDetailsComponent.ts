import {FormGroup} from "@angular/forms";
import {IsoDateTime} from "@meshmakers/shared-services";

export abstract class AbstractDetailsComponent<TEntity> {

  public loading: boolean;
  protected entity: TEntity | null;

  protected constructor(formGroup: FormGroup) {
    this.loading = true;
    this.entity = null;
    this._ownerForm = formGroup;
  }

  private _ownerForm: FormGroup;

  public get ownerForm(): FormGroup {
    return this._ownerForm;
  }

  public get isLoaded(): boolean {
    return this.entity !== null;
  }

  public hasError = (controlName: string, errorName: string) => {
    return this.ownerForm?.controls[controlName].hasError(errorName);
  };

  public hasFormError = (errorName: string) => {
    return this.ownerForm?.hasError(errorName);
  };

  public updateDateTime(controlName: string) {
    this.ownerForm?.get(controlName)?.setValue(IsoDateTime.utcToLocalDateTimeIso(IsoDateTime.currentUtcDateTimeIso()));
  }

  public copyInputMessage(inputElement : any) {
    inputElement.select();
    document.execCommand('copy');
    inputElement.setSelectionRange(0, 0);
  }

  protected onProgressStarting() {
    this.loading = true;
    this.ownerForm?.disable();
    this.ownerForm?.updateValueAndValidity();
  }

  protected onProgressCompleted() {
    this.ownerForm?.enable();
    this.loading = false;
  }
}
