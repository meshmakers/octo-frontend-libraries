/**
 * Backward-compatible CommonValidators for legacy apps.
 */
import { AbstractControl, ValidatorFn, Validators } from '@angular/forms';

export type CompareValueFn<TValue> = (value: TValue) => boolean;

export class CommonValidators {
  public static phoneNumber(): ValidatorFn {
    return Validators.pattern('^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\./0-9]*$');
  }

  public static httpUri(): ValidatorFn {
    return Validators.pattern(
      '^(http:\\/\\/|https:\\/\\/)([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+(\\.[a-zA-Z]{2,11}?)*(:[0-9]{2,5}){0,1}\\/{0,1}$'
    );
  }

  public static ensureSameValue(sourceControlName: string): ValidatorFn {
    return (control: AbstractControl) => {
      const value = control.value;
      return value === control.parent?.get(sourceControlName)?.value ? null : { notSame: true };
    };
  }

  public static conditionalRequired<TCompareValue>(
    sourceControlName: string,
    sourceValueCompareExpression: CompareValueFn<TCompareValue>
  ): ValidatorFn {
    return (control: AbstractControl) => {
      if (control.parent != null && sourceValueCompareExpression((control.parent.get(sourceControlName)?.value as TCompareValue))) {
        const val = control.value;
        const isEmpty = val == null || (typeof val === 'string' && val.length === 0) || (Array.isArray(val) && val.length === 0);
        return isEmpty ? { required: true } : null;
      }
      return null;
    };
  }

  public static dependentControls(controlNames: string[]): ValidatorFn {
    return (control: AbstractControl) => {
      controlNames.forEach((controlName) => {
        control.parent?.get(controlName)?.updateValueAndValidity();
      });
      return null;
    };
  }
}
