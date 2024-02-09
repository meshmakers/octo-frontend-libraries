import {
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostBinding,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { MatFormFieldControl } from '@angular/material/form-field';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NgControl,
  ValidationErrors,
  Validator
} from '@angular/forms';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { debounceTime, filter, map, switchMap, tap } from 'rxjs/operators';
import {
  MatAutocompleteActivatedEvent,
  MatAutocompleteSelectedEvent
} from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { of, Subject } from 'rxjs';
import { FocusMonitor } from '@angular/cdk/a11y';
import { AutoCompleteDataSource } from '@meshmakers/shared-services';

@Component({
  selector: 'ia-autocomplete',
  templateUrl: './ia-autocomplete-input.html',
  styleUrls: ['./ia-autocomplete-input.css'],
  host: {
    '[id]': 'id',
    '[attr.aria-describedby]': 'describedBy'
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IaAutocompleteInput),
      multi: true
    },
    {
      provide: MatFormFieldControl,
      useExisting: IaAutocompleteInput
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => IaAutocompleteInput),
      multi: true
    }
  ]
})
export class IaAutocompleteInput
  implements
    OnInit,
    OnDestroy,
    DoCheck,
    ControlValueAccessor,
    MatFormFieldControl<any>,
    Validator
{
  private static nextId = 0;
  public readonly searchFormControl: FormControl;
  public isLoading: boolean;
  public filteredStrings: string[] = [];
  public ngControl: NgControl | null;
  public errorState: boolean;
  public focused: boolean;
  public readonly stateChanges = new Subject<void>();
  @HostBinding()
  public readonly id = `ia-autocomplete-${IaAutocompleteInput.nextId++}`;

  public valueChange: EventEmitter<any> = new EventEmitter<any>();
  private _selectedString: string | null;
  @ViewChild('input') private readonly inputField: MatInput | null;
  @HostBinding('attr.aria-describedby') private describedBy = '';
  private activatedValue: any;

  constructor(
    public elRef: ElementRef<HTMLElement>,
    private readonly injector: Injector,
    private readonly fm: FocusMonitor
  ) {
    this.ngControl = null;
    this.errorState = false;
    this._selectedString = null;
    this.inputField = null;
    this._dataSource = null;
    this._placeholder = '';
    this._prefix = '';

    this.searchFormControl = new FormControl();
    this.isLoading = false;
    this._disabled = false;
    this.focused = false;
    fm.monitor(elRef.nativeElement, true).subscribe((origin) => {
      this.focused = !!origin;
      this.stateChanges.next();
    });
  }

  private _dataSource: AutoCompleteDataSource | null;

  public get dataSource(): AutoCompleteDataSource | null {
    return this._dataSource;
  }

  @Input()
  public set dataSource(value: AutoCompleteDataSource | null) {
    this._dataSource = value;
  }

  private _disabled = false;

  @Input()
  public get disabled(): boolean {
    return this._disabled;
  }

  public set disabled(dis) {
    this._disabled = coerceBooleanProperty(dis);
    this._disabled
      ? this.searchFormControl.disable()
      : this.searchFormControl.enable();
    this.stateChanges.next();
  }

  private _placeholder: string;

  @Input()
  public get placeholder(): string {
    return this._placeholder;
  }

  public set placeholder(plh: string) {
    this._placeholder = plh;
    this.stateChanges.next();
  }

  private _required = false;

  @Input()
  public get required(): boolean {
    return this._required;
  }

  public set required(req) {
    this._required = coerceBooleanProperty(req);
    if (this.inputField != null) {
      this.inputField.required = this._required;
    }
    this.stateChanges.next();
  }

  private _prefix: string;

  @Input()
  public get prefix(): string {
    return this._prefix;
  }

  public set prefix(value: string) {
    if (value !== this._prefix) {
      this._prefix = value;
    }
  }

  public get value(): any {
    return this._selectedString;
  }

  public set value(value: any) {
    if (value !== this._selectedString) {
      this._selectedString = value;
      this.searchFormControl.setValue(value);
      this.valueChange.emit(value);
      this._propagateChange(this._selectedString);
      this.stateChanges.next();
    }
  }

  public get empty(): boolean {
    const n = this.searchFormControl.value;
    return !n;
  }

  @HostBinding('class.floating')
  public get shouldLabelFloat(): boolean {
    return this.focused || !this.empty;
  }

  ngOnInit(): void {
    this.ngControl = this.injector.get(NgControl, null);
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }

    // If prefix defined, usually this is used for a code scanner.
    // The goal is to select the entity in direct way.
    if (this._prefix) {
      this.searchFormControl.valueChanges
        .pipe(
          debounceTime(300),
          filter((value) => typeof value === 'string'),
          filter((value) => value.startsWith(this._prefix)),
          tap(() => (this.value = null)),
          tap(() => (this.isLoading = true)),
          map(
            (value: string) =>
              this._dataSource?.onPreprocessSearchString(value) ?? ''
          ),
          switchMap((value) => this._dataSource?.onFilter(value) ?? of(null))
        )
        .subscribe((resultSet) => {
          if (resultSet?.list != null) {
            if (resultSet.list.length === 1) {
              this.value = resultSet.list[0];
            } else {
              this.filteredStrings = resultSet.list;
              this.searchFormControl.patchValue(resultSet.searchTerm, {
                emitEvent: false
              });
            }
          }
          this.isLoading = false;
        });
    }

    // This is the search functionality when search by human.
    this.searchFormControl.valueChanges
      .pipe(
        debounceTime(300),
        tap((_) => {
          this.filteredStrings = [];
        }),
        filter((value) => value != null && value.toString().length >= 1),
        tap(() => (this.isLoading = true)),
        map((value: string) =>
          this._dataSource?.onPreprocessSearchString(value)
        ),
        tap((value) => (this.value = value)),
        switchMap((value) => {
          if (value !== null) {
            return this._dataSource?.onFilter(String(value)) ?? of(null);
          }
          return of(null);
        })
      )
      .subscribe((resultSet) => {
        if (resultSet?.list != null) {
          this.filteredStrings = resultSet.list;
          this.searchFormControl.patchValue(resultSet.searchTerm, {
            emitEvent: false
          });
        }
        this.isLoading = false;
      });
  }

  ngOnDestroy(): void {
    this.stateChanges.complete();
    this.fm.stopMonitoring(this.elRef.nativeElement);
  }

  ngDoCheck(): void {
    if (this.ngControl != null) {
      this.errorState =
        (this.ngControl.invalid && this.ngControl.touched) ?? false;
      this.stateChanges.next();
    }
  }

  public clear(): void {
    this.filteredStrings = [];
    this.searchFormControl.reset(null);
  }

  public focus(): void {
    this.elRef.nativeElement.querySelector('input')?.focus();
  }

  public onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    this.value = event.option.value;
    this.filteredStrings = [];
  }

  public onOptionActivated(event: MatAutocompleteActivatedEvent): void {
    this.activatedValue = event.option?.value;
  }

  public onAutoCompleteClosed(): void {
    if (this.activatedValue) {
      this.value = this.activatedValue;
      this.activatedValue = null;
    }
  }

  public reset(): void {
    this.value = null;
  }

  public onFocusOut(): void {
    if (this.filteredStrings.length === 1) {
      this.activatedValue = this.filteredStrings[0];
      this.value = this.filteredStrings[0];
    }
  }

  public onTouched(): void {
    this._onTouched();
    this.stateChanges.next();
  }

  public registerOnChange(fn: any): void {
    this._propagateChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public writeValue(obj: any): void {
    this.clear();
    this.value = obj;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  public onContainerClick(event: MouseEvent): void {
    if ((event.target as Element).tagName.toLowerCase() !== 'input') {
      this.focus();
    }
  }

  public setDescribedByIds(ids: string[]): void {
    this.describedBy = ids.join(' ');
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const selection: any = control.value;
    if (typeof selection === 'string' && selection.length < 1) {
      return { incorrect: true };
    }
    return null;
  }

  private _propagateChange = (_: any): void => {};

  private readonly _onTouched = (): void => {};
}
