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
import {EntitySelectDataSource} from "@meshmakers/shared-services";
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl, NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NgControl,
  ValidationErrors,
  Validator
} from "@angular/forms";
import {of, Subject} from "rxjs";
import {MatInput} from "@angular/material/input";
import {FocusMonitor} from "@angular/cdk/a11y";
import {coerceBooleanProperty} from "@angular/cdk/coercion";
import {debounceTime, filter, switchMap, tap} from "rxjs/operators";
import {MatAutocompleteActivatedEvent, MatAutocompleteSelectedEvent} from "@angular/material/autocomplete";
import {MatFormFieldControl} from "@angular/material/form-field";
import {COMMA, ENTER} from "@angular/cdk/keycodes";

@Component({
  selector: 'ia-multiple-entity-select',
  templateUrl: './ia-multiple-entity-select-input.component.html',
  styleUrls: ['./ia-multiple-entity-select-input.component.css'],
  host: {
    '[id]': 'id',
    '[attr.aria-describedby]': 'describedBy'
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IaMultipleEntitySelectInput),
      multi: true
    },
    {
      provide: MatFormFieldControl,
      useExisting: IaMultipleEntitySelectInput
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => IaMultipleEntitySelectInput),
      multi: true
    }
  ]
})
export class IaMultipleEntitySelectInput implements OnInit, OnDestroy, DoCheck, ControlValueAccessor, MatFormFieldControl<Array<any>>, Validator {

  private static nextId = 0;
  public readonly valuesFormControl: FormControl;
  public readonly searchFormControl: FormControl;
  public isLoading: boolean;
  public filteredEntities: any[] = [];
  public ngControl: NgControl | null;
  public errorState: boolean;
  public focused: boolean;
  public readonly stateChanges = new Subject<void>();
  @HostBinding() public readonly id = `ia-multiple-entity-select-${IaMultipleEntitySelectInput.nextId++}`;
  public valuesChange: EventEmitter<Array<any>> = new EventEmitter<Array<any>>();
  private _selectedEntities: Array<any> | null;
  @ViewChild('input') private readonly inputField: MatInput | null;
  @HostBinding('attr.aria-describedby') private describedBy = '';
  private activatedValue: any;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  constructor(public elRef: ElementRef, private injector: Injector, private fm: FocusMonitor) {
    this.ngControl = null;
    this.errorState = false;
    this.inputField = null;
    this._dataSource = null;
    this._placeholder = "";
    this._prefix = "";
    this._selectedEntities = null;

    this.valuesFormControl = new FormControl();
    this.searchFormControl = new FormControl();
    this.isLoading = false;
    this._disabled = false;
    this.focused = false;
    fm.monitor(elRef.nativeElement, true).subscribe(origin => {
      this.focused = !!origin;
      this.stateChanges.next();
    });
  }

  private _dataSource: EntitySelectDataSource<any> | null;

  public get dataSource(): EntitySelectDataSource<any> | null {
    return this._dataSource;
  }

  @Input()
  public set dataSource(value: EntitySelectDataSource<any> | null) {
    this._dataSource = value;
  }

  private _disabled = false;

  @Input()
  public get disabled() {
    return this._disabled;
  }

  public set disabled(dis) {
    this._disabled = coerceBooleanProperty(dis);
    this._disabled ? this.searchFormControl.disable() : this.searchFormControl.enable();
    this.stateChanges.next();
  }

  private _placeholder: string;

  @Input()
  public get placeholder() {
    return this._placeholder;
  }

  public set placeholder(plh) {
    this._placeholder = plh;
    this.stateChanges.next();
  }

  private _required = false;

  @Input()
  public get required() {
    return this._required;
  }

  public set required(req) {
    this._required = coerceBooleanProperty(req);
    if (this.inputField) {
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

  public get value(): Array<any> | null {
    return this._selectedEntities;
  }

  public set value(value: Array<any> | null) {
    if (value !== this._selectedEntities) {
      this.valuesFormControl.setValue(value);
      this.setValue(value);
    }
  }

  public get empty() {
    let n = this.valuesFormControl.value;
    return !n;
  }

  @HostBinding('class.floating')
  public get shouldLabelFloat() {
    return this.focused || !this.empty;
  }

  ngOnInit() {
    this.ngControl = this.injector.get(NgControl, null);
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }

    // If prefix defined, usually this is used for a code scanner.
    // The goal is to select the entity in direct way.
    if (this._prefix) {
      this.searchFormControl
        .valueChanges
        .pipe(
          debounceTime(300),
          filter(value => typeof value === 'string'),
          filter(value => value.startsWith(this._prefix)),
          tap(() => this.isLoading = true),
          switchMap(value => this._dataSource?.onFilter(value.replace(this._prefix, "").trim()) ?? of(null))
        )
        .subscribe(resultSet => {

          if (resultSet && resultSet.list) {
            this.filteredEntities = resultSet.list;
          }
          this.isLoading = false;
        });
    }

    // This is the search functionality when search by human.
    this.searchFormControl
      .valueChanges
      .pipe(
        debounceTime(300),
        tap(() => this.filteredEntities = []),
        filter(value => typeof value === 'string'),
        filter(value => value.toString().length >= 3),
        tap(() => this.isLoading = true),
        switchMap(value => this._dataSource?.onFilter(value) ?? of(null))
      )
      .subscribe(resultSet => {

          const resultList = new Array<any>();

          if (resultSet && resultSet.list) {

            resultSet.list.forEach(value1 => {
              if (!this.value?.find(value2 =>
                this._dataSource?.getIdEntity(value2) === this._dataSource?.getIdEntity(value1))) {
                resultList.push(value1);
              }
            })
          }

          this.filteredEntities = resultList;
          this.isLoading = false;
        }
      );
  }

  ngOnDestroy(): void {
    this.stateChanges.complete();
    this.fm.stopMonitoring(this.elRef.nativeElement);
  }

  ngDoCheck(): void {
    if (this.ngControl) {
      this.errorState = (this.ngControl.invalid && this.ngControl.touched) ?? false;
      this.stateChanges.next();
    }
  }

  public clear() {
    this.filteredEntities = [];
    this.searchFormControl.reset(null);
  }

  public focus() {
    this.elRef.nativeElement.querySelector('input').focus();
  }

  public onEntitySelected(event: MatAutocompleteSelectedEvent) {

    let list = this.value;
    if (!list) {
      list = new Array<any>();
    }
    list.push(event.option.value);
    this.value = list;

    this.filteredEntities = [];
    this.searchFormControl.setValue(null);
    this.valuesFormControl.updateValueAndValidity();
  }

  public onEntityActivated(event: MatAutocompleteActivatedEvent) {
    this.activatedValue = event.option?.value;
  }

  public onEntityClosed() {

    if (this.activatedValue) {

      this.value = this.activatedValue;
      this.activatedValue = null;

    }
  }

  public reset() {
    this.value = new Array<any>();
  }

  public onFocusOut() {

    // if (this.filteredEntities.length === 1) {
    //   this.activatedValue = this.filteredEntities[0];
    //   this.value = this.filteredEntities[0];
    // }
  }

  public onTouched() {

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
    if ((event.target as Element).tagName.toLowerCase() != 'input') {
      this.focus();
    }
  }

  public setDescribedByIds(ids: string[]): void {
    this.describedBy = ids.join(' ');
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const selection: any = control.value;
    if (typeof selection === 'string') {
      return {incorrect: true};
    }
    return null;
  }

  remove(value: any) {
    const list = this.value;
    if (list) {
      const index = list.indexOf(value);
      if (index !== -1) {
        list.splice(index, 1);
      }
      this.valuesFormControl.updateValueAndValidity();
    }
  }

  private _propagateChange = (_: Array<any>) => {
  };

  private _onTouched = () => {
  };

  private setValue(values: Array<any> | null) {
    if (values !== this._selectedEntities) {
      this._selectedEntities = values;
      this.valuesChange.emit(values ?? []);
      this._propagateChange(this._selectedEntities ?? []);
      this.stateChanges.next();
    }
  }
}
