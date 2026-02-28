import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  ElementRef,
  ViewChild,
  inject
} from '@angular/core';
import {CommonModule} from '@angular/common';
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
import {AutoCompleteModule, AutoCompleteComponent} from '@progress/kendo-angular-dropdowns';
import {LoaderModule} from '@progress/kendo-angular-indicators';
import {ButtonsModule} from '@progress/kendo-angular-buttons';
import {IconsModule, SVGIconModule} from '@progress/kendo-angular-icons';
import {xIcon, searchIcon} from '@progress/kendo-svg-icons';
import {EntitySelectDataSource} from '@meshmakers/shared-services';
import {Subject, of} from 'rxjs';
import {debounceTime, distinctUntilChanged, switchMap, tap, catchError} from 'rxjs/operators';
import {EntitySelectDialogDataSource} from '../entity-select-dialog/entity-select-dialog-data-source';
import {EntitySelectDialogService} from '../entity-select-dialog/entity-select-dialog.service';

@Component({
  selector: 'mm-entity-select-input',
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
      useExisting: forwardRef(() => EntitySelectInputComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => EntitySelectInputComponent),
      multi: true
    }
  ],
  template: `
    <div class="entity-select-wrapper" [class.disabled]="disabled" [class.has-dialog-button]="dialogDataSource">
      <kendo-autocomplete
        #autocomplete
        [formControl]="searchFormControl"
        [data]="filteredEntities"
        [loading]="isLoading"
        [disabled]="disabled"
        [placeholder]="placeholder"
        [suggest]="true"
        [clearButton]="true"
        [filterable]="true"
        (filterChange)="onFilterChange($event)"
        (valueChange)="onSelectionChange($event)"
        (blur)="onBlur()"
        (focus)="onFocus()"
        class="entity-autocomplete">

        <!-- Custom item template -->
        <ng-template kendoAutoCompleteItemTemplate let-dataItem>
          <div class="entity-item">
            {{ dataItem }}
          </div>
        </ng-template>

        <!-- No data template -->
        <ng-template kendoAutoCompleteNoDataTemplate>
          <div class="no-data-message">
            <span *ngIf="!isLoading && searchFormControl.value && searchFormControl.value.length >= minSearchLength">
              No entities found for "{{ searchFormControl.value }}"
            </span>
            <span *ngIf="!isLoading && (!searchFormControl.value || searchFormControl.value.length < minSearchLength)">
              Type at least {{ minSearchLength }} characters to search...
            </span>
          </div>
        </ng-template>

        <!-- Footer template with advanced search link -->
        <ng-template kendoAutoCompleteFooterTemplate *ngIf="dialogDataSource">
          <div class="advanced-search-footer" (click)="openAdvancedSearch($event)">
            <kendo-svg-icon [icon]="searchIcon" size="small"></kendo-svg-icon>
            <span>{{ advancedSearchLabel }}</span>
          </div>
        </ng-template>

      </kendo-autocomplete>

      <!-- Dialog button (always visible when dialogDataSource is set) -->
      <button *ngIf="dialogDataSource"
              kendoButton
              type="button"
              [svgIcon]="searchIcon"
              [disabled]="disabled"
              [title]="advancedSearchLabel"
              class="dialog-button"
              (click)="openAdvancedSearch()">
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .entity-select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      gap: 4px;
    }

    .entity-select-wrapper.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .entity-autocomplete {
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

    .clear-button {
      position: absolute;
      right: 32px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 1;
      padding: 4px;
      min-width: auto;
      height: 20px;
      width: 20px;
    }

    .entity-item {
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

    /* Override Kendo styles for better integration */
    ::ng-deep .entity-autocomplete .k-input-inner {
      padding-right: 60px !important; /* Make room for clear button */
    }

    ::ng-deep .entity-autocomplete.k-disabled .k-input-inner {
      padding-right: 32px !important; /* Normal padding when disabled */
    }
  `]
})
export class EntitySelectInputComponent implements OnInit, OnDestroy, ControlValueAccessor, Validator {
  @ViewChild('autocomplete', {static: true}) autocomplete!: AutoCompleteComponent;

  // Inputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic component accepts any entity type
  @Input() dataSource!: EntitySelectDataSource<any>;
  @Input() placeholder = 'Select an entity...';
  @Input() minSearchLength = 3;
  @Input() maxResults = 50;
  @Input() debounceMs = 300;
  @Input() prefix = '';

  // Dialog inputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic component accepts any entity type
  @Input() dialogDataSource?: EntitySelectDialogDataSource<any>;
  @Input() dialogTitle = 'Select Entity';
  @Input() multiSelect = false;
  @Input() advancedSearchLabel = 'Advanced Search...';

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

  // Outputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic component emits any entity type
  @Output() entitySelected = new EventEmitter<any>();
  @Output() entityCleared = new EventEmitter<void>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic component emits any entity type
  @Output() entitiesSelected = new EventEmitter<any[]>(); // For multi-select from dialog

  // Form control and state
  public searchFormControl = new FormControl();
  public filteredEntities: string[] = [];
  public selectedEntity: unknown = null;
  public isLoading = false;
  private entityMap = new Map<string, unknown>();

  // Private members
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private onChange: (value: unknown) => void = () => { /* noop */ };
  private onTouched: () => void = () => { /* noop */ };

  // Icons
  protected readonly clearIcon = xIcon;
  protected readonly searchIcon = searchIcon;

  // Injected dependencies
  private elRef = inject(ElementRef);
  private dialogService = inject(EntitySelectDialogService, { optional: true });

  ngOnInit(): void {
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ControlValueAccessor implementation
  writeValue(value: unknown): void {
    if (value !== this.selectedEntity) {
      this.selectedEntity = value;
      if (value && this.dataSource) {
        // Set the display value in the input
        const displayText = this.dataSource.onDisplayEntity(value);
        this.searchFormControl.setValue(displayText, {emitEvent: false});
      } else {
        this.searchFormControl.setValue('', {emitEvent: false});
      }
    }
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    this.disabled = _isDisabled;
  }

  // Validator implementation
  validate(control: AbstractControl): ValidationErrors | null {
    if (this.required && !this.selectedEntity) {
      return {required: true};
    }

    // Validate that the value is an actual entity, not just a string
    const value = control.value;
    if (value && typeof value === 'string') {
      return {invalidEntity: true};
    }

    return null;
  }

  // Event handlers
  onFilterChange(event: string): void {
    const filter = event;
    if (!filter || filter.length < this.minSearchLength) {
      this.filteredEntities = [];
      return;
    }

    this.searchSubject.next(filter);
  }

  onSelectionChange(value: string): void {
    if (value && typeof value === 'string') {
      // Find the entity that matches the selected display text
      const entity = this.entityMap.get(value);
      if (entity) {
        this.selectEntity(entity);
      }
    }
  }

  onFocus(): void {
    // Optional: Trigger search on focus if there's already text
    const currentValue = this.searchFormControl.value;
    if (currentValue && currentValue.length >= this.minSearchLength && this.filteredEntities.length === 0) {
      this.searchSubject.next(currentValue);
    }
  }

  onBlur(): void {
    this.onTouched();

    // Auto-select if there's exactly one result
    if (this.filteredEntities.length === 1 && !this.selectedEntity) {
      const displayText = this.filteredEntities[0];
      const entity = this.entityMap.get(displayText);
      if (entity) {
        this.selectEntity(entity);
      }
    }
  }

  // Public methods
  public clear(): void {
    this.selectedEntity = null;
    this.filteredEntities = [];
    this.entityMap.clear();
    this.searchFormControl.setValue('', {emitEvent: false});
    this.onChange(null);
    this.entityCleared.emit();
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
    this.searchSubject.pipe(
      debounceTime(this.debounceMs),
      distinctUntilChanged(),
      tap(() => {
        this.isLoading = true;
        this.filteredEntities = [];
      }),
      switchMap(filter => {
        if (!this.dataSource) {
          return of({totalCount: 0, items: []});
        }

        if (filter.startsWith(this.prefix)) {
          if (typeof filter === 'string') {
            filter = filter.replace(this.prefix, '').trim();
            return this.dataSource.onFilter(filter, this.maxResults).catch(error => {
              console.error('Entity search error:', error);
              return {totalCount: 0, items: []};
            });
          } else {
            return of({totalCount: 0, items: []});
          }
        } else {
          return this.dataSource.onFilter(filter, this.maxResults).catch(error => {
            console.error('Entity search error:', error);
            return {totalCount: 0, items: []};
          });
        }
      }),
      catchError(error => {
        console.error('Search error:', error);
        return of({totalCount: 0, items: []});
      })
    ).subscribe(result => {
      this.isLoading = false;

      if (this.prefix && result.items.length === 1) {
        // Auto-select if exactly one match in prefix mode
        this.selectEntity(result.items[0]);
        return;
      }
      // Store both the display strings and the entities
      this.filteredEntities = result.items.map(entity => this.dataSource.onDisplayEntity(entity));
      this.entityMap = new Map(result.items.map(entity => [this.dataSource.onDisplayEntity(entity), entity]));
    });
  }

  private selectEntity(entity: unknown): void {
    this.selectedEntity = entity;
    const displayText = this.dataSource.onDisplayEntity(entity);
    this.searchFormControl.setValue(displayText, {emitEvent: false});
    this.filteredEntities = [];
    this.onChange(entity);
    this.entitySelected.emit(entity);
    this.autocomplete.closeActionSheet();
  }

  // Advanced search dialog
  public async openAdvancedSearch(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!this.dialogDataSource || !this.dialogService) {
      console.warn('Dialog data source or dialog service not available');
      return;
    }

    // Close the autocomplete dropdown
    this.autocomplete.toggle(false);

    const result = await this.dialogService.open(this.dialogDataSource, {
      title: this.dialogTitle,
      multiSelect: this.multiSelect,
      selectedEntities: this.selectedEntity ? [this.selectedEntity] : []
    });

    if (result && result.selectedEntities.length > 0) {
      if (this.multiSelect) {
        // Multi-select: emit all selected entities
        this.entitiesSelected.emit(result.selectedEntities);
        // For form control, set the first entity
        if (result.selectedEntities.length === 1) {
          this.selectEntity(result.selectedEntities[0]);
        } else {
          // Multiple selected - update display to show count
          const displayText = `${result.selectedEntities.length} selected`;
          this.searchFormControl.setValue(displayText, {emitEvent: false});
          this.selectedEntity = result.selectedEntities;
          this.onChange(result.selectedEntities);
        }
      } else {
        // Single select: use the first (and only) entity
        this.selectEntity(result.selectedEntities[0]);
      }
    }
  }
}
