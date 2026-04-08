import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  ViewChild,
  inject,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  ReactiveFormsModule,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  Validator,
  AbstractControl,
  ValidationErrors,
  NG_VALIDATORS
} from '@angular/forms';
import { AutoCompleteModule, AutoCompleteComponent, PopupSettings } from '@progress/kendo-angular-dropdowns';
import { LoaderModule } from '@progress/kendo-angular-indicators';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { IconsModule, SVGIconModule } from '@progress/kendo-angular-icons';
import { searchIcon } from '@progress/kendo-svg-icons';
import {
  CkTypeSelectorService,
  CkTypeSelectorItem,
  CkTypeSelectorResult
} from '@meshmakers/octo-services';
import { Subject, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
  catchError,
  map
} from 'rxjs/operators';
import { of } from 'rxjs';
import { CkTypeSelectorDialogService } from '../ck-type-selector-dialog/ck-type-selector-dialog.service';

@Component({
  selector: 'mm-ck-type-selector-input',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AutoCompleteModule,
    LoaderModule,
    ButtonsModule,
    IconsModule,
    SVGIconModule
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CkTypeSelectorInputComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CkTypeSelectorInputComponent),
      multi: true
    }
  ],
  template: `
    <div class="ck-type-select-wrapper" [class.disabled]="disabled">
      <kendo-autocomplete
        #autocomplete
        [formControl]="searchFormControl"
        [data]="filteredTypes"
        [loading]="isLoading"
        [placeholder]="placeholder"
        [suggest]="true"
        [clearButton]="true"
        [filterable]="true"
        [popupSettings]="popupSettings"
        (filterChange)="onFilterChange($event)"
        (valueChange)="onSelectionChange($event)"
        (blur)="onBlur()"
        (focus)="onFocus()"
        class="ck-type-autocomplete">

        <ng-template kendoAutoCompleteItemTemplate let-dataItem>
          <div class="ck-type-item">
            {{ dataItem }}
          </div>
        </ng-template>

        <ng-template kendoAutoCompleteNoDataTemplate>
          <div class="no-data-message">
            <span *ngIf="!isLoading && searchFormControl.value && searchFormControl.value.length >= minSearchLength">
              No types found for "{{ searchFormControl.value }}"
            </span>
            <span *ngIf="!isLoading && (!searchFormControl.value || searchFormControl.value.length < minSearchLength)">
              Type at least {{ minSearchLength }} characters to search...
            </span>
          </div>
        </ng-template>

        <ng-template kendoAutoCompleteFooterTemplate>
          <div class="advanced-search-footer" (click)="openDialog($event)">
            <kendo-svg-icon [icon]="searchIcon" size="small"></kendo-svg-icon>
            <span>{{ advancedSearchLabel }}</span>
          </div>
        </ng-template>

      </kendo-autocomplete>

      <button
        kendoButton
        type="button"
        [svgIcon]="searchIcon"
        [disabled]="disabled"
        [title]="advancedSearchLabel"
        class="dialog-button"
        (click)="openDialog()">
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .ck-type-select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      gap: 4px;
    }

    .ck-type-select-wrapper.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .ck-type-autocomplete {
      flex: 1;
      min-width: 0;
    }

    .dialog-button {
      flex-shrink: 0;
      height: 30px;
      width: 30px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ck-type-item {
      padding: 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .no-data-message {
      padding: 8px 12px;
      color: var(--kendo-color-subtle);
      font-style: italic;
      text-align: center;
    }

    .advanced-search-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      color: var(--kendo-color-primary);
      border-top: 1px solid var(--kendo-color-border);
      background: var(--kendo-color-surface-alt);
      transition: background-color 0.2s;
    }

    .advanced-search-footer:hover {
      background: var(--kendo-color-base-hover);
    }
  `]
})
export class CkTypeSelectorInputComponent implements OnInit, OnDestroy, ControlValueAccessor, Validator {
  @ViewChild('autocomplete', { static: true }) autocomplete!: AutoCompleteComponent;

  @Input() placeholder = 'Select a CK type...';
  @Input() minSearchLength = 2;
  @Input() maxResults = 50;
  @Input() debounceMs = 300;
  @Input() ckModelIds?: string[];
  @Input() allowAbstract = true;
  @Input() dialogTitle = 'Select Construction Kit Type';
  @Input() advancedSearchLabel = 'Advanced Search...';
  @Input() derivedFromRtCkTypeId?: string;

  private _disabled = false;
  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: boolean) {
    this._disabled = !!value;
    if (this._disabled) {
      this.searchFormControl.disable();
    } else {
      this.searchFormControl.enable();
    }
  }

  private _required = false;
  @Input()
  get required(): boolean {
    return this._required;
  }
  set required(value: boolean) {
    this._required = !!value;
  }

  @Output() ckTypeSelected = new EventEmitter<CkTypeSelectorItem>();
  @Output() ckTypeCleared = new EventEmitter<void>();

  public searchFormControl = new FormControl();
  public filteredTypes: string[] = [];
  public selectedCkType: CkTypeSelectorItem | null = null;
  public isLoading = false;
  private typeMap = new Map<string, CkTypeSelectorItem>();

  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();
  private onChange: (value: CkTypeSelectorItem | null) => void = () => { /* noop */ };
  private onTouched: () => void = () => { /* noop */ };

  protected readonly searchIcon = searchIcon;
  protected popupSettings: PopupSettings = { appendTo: 'root', popupClass: 'mm-ck-type-popup' };

  private static popupStyleInjected = false;
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private readonly dialogService = inject(CkTypeSelectorDialogService, { optional: true });
  private readonly elementRef = inject(ElementRef);

  ngOnInit(): void {
    this.setupSearch();
    this.injectPopupStyles();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.searchSubject.complete();
  }

  // ControlValueAccessor implementation
  writeValue(value: CkTypeSelectorItem | null): void {
    if (value !== this.selectedCkType) {
      this.selectedCkType = value;
      if (value) {
        // Ensure the value is in the data list so the autocomplete can display it
        if (!this.typeMap.has(value.rtCkTypeId)) {
          this.typeMap.set(value.rtCkTypeId, value);
          this.filteredTypes = [value.rtCkTypeId];
        }
        this.searchFormControl.setValue(value.rtCkTypeId, { emitEvent: false });
      } else {
        this.searchFormControl.setValue('', { emitEvent: false });
      }
    }
  }

  registerOnChange(fn: (value: CkTypeSelectorItem | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Validator implementation
  validate(control: AbstractControl): ValidationErrors | null {
    if (this.required && !this.selectedCkType) {
      return { required: true };
    }

    const value = control.value;
    if (value && typeof value === 'string') {
      return { invalidCkType: true };
    }

    return null;
  }

  // Event handlers
  onFilterChange(filter: string): void {
    if (!filter || filter.length < this.minSearchLength) {
      this.filteredTypes = [];
      return;
    }

    this.searchSubject.next(filter);
  }

  onSelectionChange(value: string): void {
    if (value && typeof value === 'string') {
      const ckType = this.typeMap.get(value);
      if (ckType) {
        this.selectCkType(ckType);
      }
    } else if (!value && this.selectedCkType) {
      this.clear();
    }
  }

  onFocus(): void {
    const currentValue = this.searchFormControl.value;
    if (currentValue && currentValue.length >= this.minSearchLength && this.filteredTypes.length === 0) {
      this.searchSubject.next(currentValue);
    }
  }

  onBlur(): void {
    this.onTouched();

    if (this.filteredTypes.length === 1 && !this.selectedCkType) {
      const displayText = this.filteredTypes[0];
      const ckType = this.typeMap.get(displayText);
      if (ckType) {
        this.selectCkType(ckType);
      }
    }
  }

  // Public methods
  public clear(): void {
    this.selectedCkType = null;
    this.filteredTypes = [];
    this.typeMap.clear();
    this.searchFormControl.setValue('', { emitEvent: false });
    this.onChange(null);
    this.ckTypeCleared.emit();
    this.autocomplete.focus();
  }

  public focus(): void {
    if (this.autocomplete) {
      this.autocomplete.focus();
    }
  }

  public reset(): void {
    this.clear();
  }

  // Private methods
  private setupSearch(): void {
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(this.debounceMs),
        distinctUntilChanged(),
        tap(() => {
          this.isLoading = true;
          this.filteredTypes = [];
        }),
        switchMap(filter => {
          const source$ = this.derivedFromRtCkTypeId
            ? this.getDerivedTypes(filter)
            : this.ckTypeSelectorService.getCkTypes({
                ckModelIds: this.ckModelIds,
                searchText: filter,
                first: this.maxResults
              });
          return source$.pipe(
            catchError(error => {
              console.error('CK type search error:', error);
              return of({ items: [], totalCount: 0 });
            })
          );
        })
      ).subscribe((result: CkTypeSelectorResult) => {
        this.isLoading = false;

        // Filter out abstract types if not allowed
        let items = result.items;
        if (!this.allowAbstract) {
          items = items.filter((item: CkTypeSelectorItem) => !item.isAbstract);
        }

        this.filteredTypes = items.map((item: CkTypeSelectorItem) => item.rtCkTypeId);
        this.typeMap = new Map(
          items.map((item: CkTypeSelectorItem) => [item.rtCkTypeId, item])
        );
      })
    );
  }

  private getDerivedTypes(filter: string) {
    const derivedService = this.ckTypeSelectorService as {
      getDerivedCkTypes?: (
        rtCkTypeId: string,
        options?: {
          searchText?: string;
          ignoreAbstractTypes?: boolean;
          includeSelf?: boolean;
        }
      ) => import('rxjs').Observable<CkTypeSelectorResult>;
    };

    if (derivedService.getDerivedCkTypes) {
      return derivedService.getDerivedCkTypes(this.derivedFromRtCkTypeId!, {
        searchText: filter
      });
    }

    return this.ckTypeSelectorService
      .getCkTypes({
        searchText: filter,
        first: this.maxResults,
        skip: 0
      })
      .pipe(
        map(result =>
          this.filterDerivedTypesFallback(result, this.derivedFromRtCkTypeId!)
        )
      );
  }

  private filterDerivedTypesFallback(
    result: CkTypeSelectorResult,
    baseRtCkTypeId: string
  ): CkTypeSelectorResult {
    const allowed = new Set<string>([baseRtCkTypeId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const item of result.items) {
        if (
          item.baseTypeRtCkTypeId &&
          allowed.has(item.baseTypeRtCkTypeId) &&
          !allowed.has(item.rtCkTypeId)
        ) {
          allowed.add(item.rtCkTypeId);
          changed = true;
        }
      }
    }

    const items = result.items.filter(item =>
      allowed.has(item.rtCkTypeId) && (this.allowAbstract || !item.isAbstract)
    );

    return { items, totalCount: items.length };
  }

  private injectPopupStyles(): void {
    if (CkTypeSelectorInputComponent.popupStyleInjected) return;
    const style = document.createElement('style');
    style.setAttribute('data-mm-ck-type-popup', '');
    style.textContent = `
      .mm-ck-type-popup {
        max-width: 500px !important;
        min-width: 0 !important;
      }
      .mm-ck-type-popup .k-child-animation-container {
        max-width: 500px !important;
      }
      .mm-ck-type-popup .k-list-item {
        padding: 4px 12px !important;
        min-height: 0 !important;
        font-size: 13px !important;
        line-height: 20px !important;
      }
    `;
    document.head.appendChild(style);
    CkTypeSelectorInputComponent.popupStyleInjected = true;
  }

  private selectCkType(ckType: CkTypeSelectorItem): void {
    this.selectedCkType = ckType;
    this.searchFormControl.setValue(ckType.rtCkTypeId, { emitEvent: false });
    this.filteredTypes = [];
    this.onChange(ckType);
    this.ckTypeSelected.emit(ckType);
    this.autocomplete.toggle(false);
  }

  // Dialog
  public async openDialog(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!this.dialogService) {
      console.warn('CkTypeSelectorDialogService not available');
      return;
    }

    this.autocomplete.toggle(false);

    const result = await this.dialogService.openCkTypeSelector({
      selectedCkTypeId: this.selectedCkType?.fullName,
      ckModelIds: this.ckModelIds,
      dialogTitle: this.dialogTitle,
      allowAbstract: this.allowAbstract,
      derivedFromRtCkTypeId: this.derivedFromRtCkTypeId
    });

    if (result.confirmed && result.selectedCkType) {
      this.selectCkType(result.selectedCkType);
    }
  }
}
