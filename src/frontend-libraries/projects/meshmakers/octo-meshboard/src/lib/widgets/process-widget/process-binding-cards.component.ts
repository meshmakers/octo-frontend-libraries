import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { chevronDownIcon, chevronRightIcon, plusIcon } from '@progress/kendo-svg-icons';
import { MM_ACTION_ICONS, EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { CkTypeSelectorInputComponent, FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import {
  CkTypeSelectorItem,
  FieldFilterOperatorsDto,
  RuntimeEntityDialogDataSource,
  RuntimeEntityItem,
  RuntimeEntitySelectDataSource
} from '@meshmakers/octo-services';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { EntitySelectorConfig, WidgetFilterConfig } from '../../models/meshboard.models';
import { SdTimeFilterToggleComponent } from '../../components/sd-time-filter-toggle/sd-time-filter-toggle.component';
import { queryFamily } from '../../utils/query-family';
import { DiagramPropertyMapping } from './process-widget-config.model';
import {
  ProcessBindingDraft,
  ProcessBindingSource,
  bindingDisplayName,
  bindingDraftConfigError,
  bindingNameError,
  hasMissingSelector,
  mappingsUsingBinding,
  missingSelectorMessage,
  uniqueBindingName
} from './process-binding-editor';

/** Persistent query as listed by the dialog. */
export interface ProcessBindingQueryItem {
  rtId: string;
  name: string;
  description?: string | null;
  /** The query entity's own CK type (family marker). */
  ckTypeId?: string | null;
  /** CK type the query queries against. */
  queryCkTypeId?: string | null;
}

/** Picker objects of one card (not part of the saved config). */
interface CardUi {
  ckType: CkTypeSelectorItem | null;
  entity: RuntimeEntityItem | null;
  entityDataSource?: RuntimeEntitySelectDataSource;
  entityDialogDataSource?: RuntimeEntityDialogDataSource;
  query: ProcessBindingQueryItem | null;
  filterItems: FieldFilterItem[];
}

interface SelectorOption {
  label: string;
  value: string | null;
}

/** A binding renamed: mappings of `oldName` now refer to `newName`. */
export interface ProcessBindingRename {
  oldName: string;
  newName: string;
}

/**
 * Data Binding tab of the process widget dialog (AB#8025, wireframe section B):
 * the widget's bindings as a list of cards. Each card has a name (required,
 * unique), a source (runtime entity / persistent query), the entity selector it
 * follows (all selectors of the board plus "None") and filters. Duplicate and
 * delete are icon actions on the card header; deleting a binding that mappings
 * use asks first and lists the affected properties.
 *
 * Keyboard: every card header is a tab stop (Enter / Space toggles the card,
 * Delete starts the delete confirmation); the header buttons and every control
 * of an open card are tab stops too.
 *
 * The component edits the `drafts` array of the dialog in place and emits
 * `draftsChange` after every change; renames and deletions are emitted
 * separately so the dialog can follow them in the mappings.
 */
@Component({
  selector: 'mm-process-binding-cards',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DropDownsModule,
    InputsModule,
    SVGIconModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent,
    FieldFilterEditorComponent,
    SdTimeFilterToggleComponent
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="binding-cards">
      @if (drafts.length === 0) {
        <div class="empty-state" data-binding-empty>
          <p>No data binding yet. The diagram shows its static values.</p>
          <button kendoButton type="button" themeColor="primary" [svgIcon]="plusIcon"
                  data-binding-action="add" (click)="add()">Add binding</button>
        </div>
      } @else {
        <div class="card-list" role="list" aria-label="Data bindings">
          @for (draft of drafts; track draft.uid; let i = $index) {
            <div class="binding-card" role="listitem" [class.collapsed]="!draft.expanded"
                 [class.invalid]="!!cardError(draft)" [attr.data-binding-card]="i">
              <div class="card-header" tabindex="0" role="button"
                   [attr.aria-expanded]="draft.expanded"
                   [attr.aria-label]="'Binding ' + headerName(draft)"
                   [attr.data-binding-header]="i"
                   (click)="toggle(draft)"
                   (keydown)="onHeaderKeydown($event, draft)">
                <kendo-svg-icon class="toggle-icon" [icon]="draft.expanded ? chevronDownIcon : chevronRightIcon"></kendo-svg-icon>
                <span class="name">{{ headerName(draft) }}</span>
                <span class="tag">{{ sourceLabel(draft) }}</span>
                @if (missingSelector(draft)) {
                  <span class="tag warn" data-binding-warning>Selector not on this board</span>
                }
                @if (draft.entitySelectorId) {
                  <span class="meta">selector: {{ draft.entitySelectorId }}</span>
                }
                <span class="header-actions">
                  <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="duplicateIcon"
                          data-binding-action="duplicate" title="Duplicate"
                          [attr.aria-label]="'Duplicate binding ' + headerName(draft)"
                          (click)="$event.stopPropagation(); duplicate(draft)"></button>
                  <button kendoButton type="button" fillMode="flat" size="small" themeColor="error" [svgIcon]="deleteIcon"
                          data-binding-action="delete" title="Delete"
                          [attr.aria-label]="'Delete binding ' + headerName(draft)"
                          (click)="$event.stopPropagation(); requestDelete(draft)"></button>
                </span>
              </div>

              @if (confirmUid === draft.uid) {
                <div class="delete-confirm" role="alertdialog" [attr.aria-label]="'Delete binding ' + headerName(draft)"
                     data-binding-confirm>
                  <span>
                    Delete binding "{{ headerName(draft) }}"?
                    @if (affectedProperties(draft).length > 0) {
                      The mappings of {{ affectedProperties(draft).join(', ') }} will be cleared.
                    }
                  </span>
                  <span class="confirm-actions">
                    <button kendoButton type="button" fillMode="flat" data-binding-action="cancel-delete"
                            (click)="cancelDelete(draft)">Cancel</button>
                    <button kendoButton type="button" themeColor="error" data-binding-action="confirm-delete"
                            (click)="confirmDelete(draft)">Delete</button>
                  </span>
                </div>
              }

              @if (draft.expanded) {
                <div class="card-body">
                  <div class="grid2">
                    <div class="form-field">
                      <label [for]="'binding-name-' + draft.uid">Binding name <span class="required">*</span></label>
                      <kendo-textbox [id]="'binding-name-' + draft.uid" [attr.data-binding-name]="i"
                                     [ngModel]="draft.name" (ngModelChange)="onNameChange(draft, $event)"
                                     placeholder="e.g. pv"></kendo-textbox>
                      @if (nameError(draft); as error) {
                        <p class="field-error" role="alert">{{ error }}</p>
                      }
                    </div>
                    <div class="form-field">
                      <label [for]="'binding-source-' + draft.uid">Source</label>
                      <kendo-dropdownlist [id]="'binding-source-' + draft.uid" [attr.data-binding-source]="i"
                                          [data]="sourceOptions" textField="label" valueField="value"
                                          [valuePrimitive]="true" [ngModel]="draft.mode"
                                          (valueChange)="onSourceChange(draft, $event)"></kendo-dropdownlist>
                    </div>
                  </div>

                  @if (draft.mode === 'runtimeEntity') {
                    <div class="form-field">
                      <label>CK type <span class="required">*</span></label>
                      <mm-ck-type-selector-input
                        placeholder="Select a CK type..."
                        [minSearchLength]="2"
                        dialogTitle="Select CK Type"
                        [ngModel]="ui(draft).ckType"
                        (ckTypeSelected)="onCkTypeSelected(draft, $event)"
                        (ckTypeCleared)="onCkTypeCleared(draft)">
                      </mm-ck-type-selector-input>
                    </div>
                    <div class="form-field">
                      <label>Entity @if (!draft.entitySelectorId) { <span class="required">*</span> }</label>
                      @if (ui(draft).entityDataSource) {
                        <mm-entity-select-input
                          [dataSource]="ui(draft).entityDataSource!"
                          [dialogDataSource]="ui(draft).entityDialogDataSource"
                          placeholder="Search for an entity..."
                          dialogTitle="Select Entity"
                          [minSearchLength]="1"
                          [ngModel]="ui(draft).entity"
                          (entitySelected)="onEntitySelected(draft, $event)"
                          (entityCleared)="onEntityCleared(draft)">
                        </mm-entity-select-input>
                      } @else {
                        <kendo-textbox [disabled]="true" placeholder="First select a CK type..."></kendo-textbox>
                      }
                      <p class="field-hint">With an entity selector the entity may stay empty: the selector's current entity is loaded.</p>
                    </div>
                  } @else {
                    <div class="form-field">
                      <label [for]="'binding-query-' + draft.uid">Persistent query <span class="required">*</span></label>
                      <kendo-combobox [id]="'binding-query-' + draft.uid" [attr.data-binding-query]="i"
                                      [data]="persistentQueries" textField="name" valueField="rtId"
                                      [valuePrimitive]="false" [filterable]="true" [loading]="isLoadingQueries"
                                      [ngModel]="ui(draft).query"
                                      (filterChange)="queryFilterChange.emit($event)"
                                      (valueChange)="onQuerySelected(draft, $event)"
                                      placeholder="Select a persistent query...">
                        <ng-template kendoComboBoxItemTemplate let-dataItem>
                          <div class="query-item">
                            <span class="query-name">{{ dataItem.name }}</span>
                            @if (dataItem.description) {
                              <span class="query-description">{{ dataItem.description }}</span>
                            }
                          </div>
                        </ng-template>
                      </kendo-combobox>
                    </div>
                    <mm-sd-time-filter-toggle [family]="draft.queryFamily"
                                              [ignoreTimeFilter]="!!draft.ignoreTimeFilter"
                                              (ignoreTimeFilterChange)="draft.ignoreTimeFilter = $event || undefined; changed()">
                    </mm-sd-time-filter-toggle>
                  }

                  <div class="form-field">
                    <label [for]="'binding-selector-' + draft.uid">Follows entity selector</label>
                    <kendo-dropdownlist [id]="'binding-selector-' + draft.uid" [attr.data-binding-selector]="i"
                                        [data]="selectorOptions(draft)" textField="label" valueField="value"
                                        [valuePrimitive]="true" [ngModel]="draft.entitySelectorId ?? null"
                                        (valueChange)="onSelectorChange(draft, $event)"></kendo-dropdownlist>
                    <p class="field-hint">The selector's current entities scope this binding. "None" = the query's own scope.</p>
                    @if (missingSelector(draft)) {
                      <p class="field-error" role="alert">{{ missingSelectorText(draft) }}</p>
                    }
                  </div>

                  @if (filterCkTypeId(draft); as ckTypeId) {
                    <div class="form-field">
                      <label>Filters (optional)</label>
                      <mm-field-filter-editor
                        [ckTypeId]="ckTypeId"
                        [filters]="ui(draft).filterItems"
                        [enableVariables]="filterVariables.length > 0"
                        [availableVariables]="filterVariables"
                        (filtersChange)="onFiltersChange(draft, $event)">
                      </mm-field-filter-editor>
                    </div>
                  }

                  @if (configError(draft); as error) {
                    <p class="field-hint warning">{{ error }}.</p>
                  }
                </div>
              }
            </div>
          }
        </div>
        <button kendoButton type="button" fillMode="outline" [svgIcon]="plusIcon"
                data-binding-action="add" (click)="add()">Add binding</button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .binding-cards { display: flex; flex-direction: column; gap: 10px; }
    .card-list { display: flex; flex-direction: column; gap: 10px; }
    .binding-card {
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 6px;
      background: var(--kendo-color-surface, #ffffff);
    }
    .binding-card.invalid { border-color: var(--kendo-color-warning, #ffc107); }
    .card-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border-radius: 6px 6px 0 0;
      cursor: pointer;
    }
    .binding-card.collapsed .card-header { border-radius: 6px; }
    .card-header:focus-visible {
      outline: 2px solid var(--kendo-color-primary, #0d6efd);
      outline-offset: -2px;
    }
    .card-header .name { font-weight: 600; }
    .card-header .meta {
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }
    .header-actions { display: inline-flex; gap: 2px; margin-left: auto; }
    .tag {
      font-size: 0.7rem;
      padding: 1px 7px;
      border-radius: 10px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      color: var(--kendo-color-subtle, #6c757d);
    }
    .tag.warn {
      border-color: var(--kendo-color-warning, #ffc107);
      color: var(--kendo-color-warning-emphasis, var(--kendo-color-warning, #8a6d00));
    }
    .delete-confirm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--kendo-color-border, #dee2e6);
      background: var(--kendo-color-error-subtle, var(--kendo-color-surface-alt, #f8f9fa));
      font-size: 0.85rem;
    }
    .confirm-actions { display: inline-flex; gap: 6px; }
    .card-body { padding: 4px 10px 10px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .form-field { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
    .form-field label { font-weight: 600; font-size: 0.85rem; color: var(--kendo-color-on-app-surface, #212529); }
    .required, .field-error { color: var(--kendo-color-error, #dc3545); }
    .field-error { margin: 0; font-size: 0.8rem; }
    .field-hint { margin: 0; font-size: 0.8rem; color: var(--kendo-color-subtle, #6c757d); }
    .field-hint.warning { margin-top: 8px; color: var(--kendo-color-warning-emphasis, var(--kendo-color-warning, #8a6d00)); }
    .empty-state {
      padding: 16px;
      border: 1px dashed var(--kendo-color-border, #dee2e6);
      border-radius: 6px;
      color: var(--kendo-color-subtle, #6c757d);
    }
    .empty-state p { margin: 0 0 8px; }
    .query-item { display: flex; flex-direction: column; gap: 2px; }
    .query-name { font-weight: 500; }
    .query-description { font-size: 0.8rem; color: var(--kendo-color-subtle, #6c757d); }
    /* Narrow dialog: one column, the selector meta moves under the name. */
    @container (max-width: 560px) {
      .grid2 { grid-template-columns: 1fr; }
      .card-header .meta { order: 10; flex-basis: 100%; margin-left: 24px; }
    }
  `]
})
export class ProcessBindingCardsComponent {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  /** The dialog's cards; edited in place. */
  @Input() drafts: ProcessBindingDraft[] = [];
  /** Entity selectors of the board. */
  @Input() selectors: EntitySelectorConfig[] = [];
  /** Persistent queries for the query picker. */
  @Input() persistentQueries: ProcessBindingQueryItem[] = [];
  @Input() isLoadingQueries = false;
  /** MeshBoard variables for the filter editor. */
  @Input() filterVariables: FilterVariable[] = [];
  /** Current mappings (to list the properties a deletion clears). */
  @Input() mappings: DiagramPropertyMapping[] = [];
  /** Source of new card uids (shared with the dialog). */
  @Input() nextUid: () => number = () => ++this.uidSeed;

  @Output() draftsChange = new EventEmitter<ProcessBindingDraft[]>();
  @Output() bindingRenamed = new EventEmitter<ProcessBindingRename>();
  @Output() bindingDeleted = new EventEmitter<string>();
  @Output() queryFilterChange = new EventEmitter<string>();

  /** Card whose delete confirmation is open. */
  confirmUid: number | null = null;

  private uidSeed = 10000;
  private readonly cardUi = new Map<number, CardUi>();

  get plusIcon(): typeof plusIcon { return plusIcon; }
  get chevronDownIcon(): typeof chevronDownIcon { return chevronDownIcon; }
  get chevronRightIcon(): typeof chevronRightIcon { return chevronRightIcon; }
  get duplicateIcon(): typeof MM_ACTION_ICONS.duplicate { return MM_ACTION_ICONS.duplicate; }
  get deleteIcon(): typeof MM_ACTION_ICONS.delete { return MM_ACTION_ICONS.delete; }

  readonly sourceOptions: { value: ProcessBindingSource; label: string }[] = [
    { value: 'persistentQuery', label: 'Persistent query' },
    { value: 'runtimeEntity', label: 'Runtime entity' }
  ];

  // ===========================================================================
  // Rendering helpers
  // ===========================================================================

  headerName(draft: ProcessBindingDraft): string {
    return draft.name.trim() ? bindingDisplayName(draft.name.trim()) : '(no name)';
  }

  sourceLabel(draft: ProcessBindingDraft): string {
    if (draft.mode === 'runtimeEntity') {
      return 'Runtime entity';
    }
    const family = draft.queryFamily;
    return family === 'streamData' ? 'Persistent query · stream data' : family === 'runtime' ? 'Persistent query · runtime' : 'Persistent query';
  }

  nameError(draft: ProcessBindingDraft): string | undefined {
    return bindingNameError(this.drafts, draft);
  }

  configError(draft: ProcessBindingDraft): string | undefined {
    return bindingDraftConfigError(draft);
  }

  missingSelector(draft: ProcessBindingDraft): boolean {
    return hasMissingSelector(draft, this.selectors.map(s => s.id));
  }

  missingSelectorText(draft: ProcessBindingDraft): string {
    return missingSelectorMessage(draft);
  }

  cardError(draft: ProcessBindingDraft): string | undefined {
    return this.nameError(draft) ?? (this.missingSelector(draft) ? this.missingSelectorText(draft) : undefined);
  }

  selectorOptions(draft: ProcessBindingDraft): SelectorOption[] {
    const options: SelectorOption[] = [
      { label: '— None —', value: null },
      ...this.selectors.map(s => ({ label: this.selectorLabel(s), value: s.id }))
    ];
    if (this.missingSelector(draft)) {
      options.push({ label: `${draft.entitySelectorId} (not on this board)`, value: draft.entitySelectorId! });
    }
    return options;
  }

  private selectorLabel(selector: EntitySelectorConfig): string {
    const label = selector.label || selector.id;
    const leader = selector.followsSelectorId ?? selector.scopeSource?.selectorId;
    return leader ? `${label} (follower of ${leader})` : label;
  }

  filterCkTypeId(draft: ProcessBindingDraft): string | undefined {
    return (draft.mode === 'runtimeEntity' ? draft.ckTypeId : draft.queryCkTypeId) || undefined;
  }

  affectedProperties(draft: ProcessBindingDraft): string[] {
    return mappingsUsingBinding(this.mappings, this.committedName(draft));
  }

  /** Picker objects of a card, created from its draft on first use. */
  ui(draft: ProcessBindingDraft): CardUi {
    let state = this.cardUi.get(draft.uid);
    if (!state) {
      state = {
        ckType: draft.ckTypeId ? this.ckTypeItem(draft.ckTypeId) : null,
        entity: draft.rtId ? {
          rtId: draft.rtId,
          ckTypeId: draft.ckTypeId ?? '',
          rtDisplayName: draft.rtDisplayName ?? draft.rtId,
          displayName: draft.rtDisplayName ?? draft.rtId
        } : null,
        query: draft.queryRtId ? this.queryItem(draft) : null,
        filterItems: this.toFilterItems(draft.filters)
      };
      if (draft.ckTypeId) {
        this.setEntityDataSources(state, draft.ckTypeId);
      }
      this.cardUi.set(draft.uid, state);
    }
    return state;
  }

  private ckTypeItem(ckTypeId: string): CkTypeSelectorItem {
    // Only rtCkTypeId is read; the selector fills the rest when the author searches.
    return {
      rtCkTypeId: ckTypeId,
      displayName: ckTypeId.split('/').pop() ?? ckTypeId,
      fullName: ckTypeId,
      isAbstract: false,
      isFinal: false
    } as CkTypeSelectorItem;
  }

  private queryItem(draft: ProcessBindingDraft): ProcessBindingQueryItem {
    const listed = this.persistentQueries.find(q => q.rtId === draft.queryRtId);
    if (listed) {
      draft.queryCkTypeId ??= listed.queryCkTypeId ?? undefined;
      return listed;
    }
    return { rtId: draft.queryRtId!, name: draft.queryName ?? draft.queryRtId!, queryCkTypeId: draft.queryCkTypeId };
  }

  private setEntityDataSources(state: CardUi, ckTypeId: string): void {
    state.entityDataSource = new RuntimeEntitySelectDataSource(this.getEntitiesByCkTypeGQL, ckTypeId);
    state.entityDialogDataSource = new RuntimeEntityDialogDataSource(this.getEntitiesByCkTypeGQL, ckTypeId);
  }

  private toFilterItems(filters: WidgetFilterConfig[] | undefined): FieldFilterItem[] {
    return (filters ?? []).map((f, index) => ({
      id: index + 1,
      attributePath: f.attributePath,
      operator: f.operator as FieldFilterOperatorsDto,
      comparisonValue: f.comparisonValue
    }));
  }

  // ===========================================================================
  // Card actions
  // ===========================================================================

  add(): void {
    const draft: ProcessBindingDraft = {
      uid: this.nextUid(),
      name: uniqueBindingName('binding', this.drafts),
      mode: 'persistentQuery',
      expanded: true
    };
    draft.committedName = draft.name;
    this.drafts.push(draft);
    this.changed();
    this.focusLater(`[data-binding-name="${this.drafts.length - 1}"] input`);
  }

  duplicate(draft: ProcessBindingDraft): void {
    const copy: ProcessBindingDraft = {
      ...draft,
      uid: this.nextUid(),
      name: uniqueBindingName(`${draft.name.trim() || 'binding'} copy`, this.drafts),
      filters: draft.filters ? draft.filters.map(f => ({ ...f })) : undefined,
      expanded: true
    };
    copy.committedName = copy.name;
    const index = this.drafts.indexOf(draft);
    this.drafts.splice(index + 1, 0, copy);
    this.changed();
    this.focusLater(`[data-binding-name="${index + 1}"] input`);
  }

  toggle(draft: ProcessBindingDraft): void {
    draft.expanded = !draft.expanded;
  }

  onHeaderKeydown(event: KeyboardEvent, draft: ProcessBindingDraft): void {
    // Keys on the header buttons are theirs.
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle(draft);
    } else if (event.key === 'Delete') {
      event.preventDefault();
      this.requestDelete(draft);
    }
  }

  requestDelete(draft: ProcessBindingDraft): void {
    this.confirmUid = draft.uid;
    this.focusLater(`[data-binding-card="${this.drafts.indexOf(draft)}"] [data-binding-action="cancel-delete"]`);
  }

  cancelDelete(draft: ProcessBindingDraft): void {
    this.confirmUid = null;
    this.focusLater(`[data-binding-header="${this.drafts.indexOf(draft)}"]`);
  }

  confirmDelete(draft: ProcessBindingDraft): void {
    const index = this.drafts.indexOf(draft);
    const name = this.committedName(draft);
    this.confirmUid = null;
    this.drafts.splice(index, 1);
    this.cardUi.delete(draft.uid);
    this.bindingDeleted.emit(name);
    this.commitValidNames();
    this.changed();
    if (this.drafts.length === 0) {
      this.focusLater('[data-binding-action="add"]');
    } else {
      this.focusLater(`[data-binding-header="${Math.min(index, this.drafts.length - 1)}"]`);
    }
  }

  // ===========================================================================
  // Field changes
  // ===========================================================================

  onNameChange(draft: ProcessBindingDraft, name: string): void {
    draft.name = name ?? '';
    this.commitValidNames();
    this.changed();
  }

  /**
   * Mappings follow a card's name only while it is valid, so a name that briefly
   * equals another binding's never merges two bindings' mappings. Every card is
   * checked, because a clash can also be resolved by renaming or deleting the
   * other card. A card moves to its new name only once no other card's mappings
   * still use that name; moves are repeated until nothing changes, so swaps
   * through a free name resolve in order.
   */
  private commitValidNames(): void {
    for (const d of this.drafts) {
      d.committedName ??= d.name.trim();
    }
    let moved = true;
    while (moved) {
      moved = false;
      for (const d of this.drafts) {
        const trimmed = d.name.trim();
        if (bindingNameError(this.drafts, d) || trimmed === d.committedName) {
          continue;
        }
        if (this.drafts.some(o => o !== d && o.committedName === trimmed)) {
          continue;
        }
        const oldName = d.committedName!;
        d.committedName = trimmed;
        this.bindingRenamed.emit({ oldName, newName: trimmed });
        moved = true;
      }
    }
  }

  /** Name the card's mappings use. */
  private committedName(draft: ProcessBindingDraft): string {
    return draft.committedName ?? draft.name.trim();
  }

  onSourceChange(draft: ProcessBindingDraft, mode: ProcessBindingSource): void {
    if (draft.mode === mode) {
      return;
    }
    draft.mode = mode;
    draft.ckTypeId = undefined;
    draft.rtId = undefined;
    draft.rtDisplayName = undefined;
    draft.queryRtId = undefined;
    draft.queryName = undefined;
    draft.queryCkTypeId = undefined;
    draft.queryFamily = undefined;
    draft.ignoreTimeFilter = undefined;
    draft.filters = undefined;
    const state = this.ui(draft);
    state.ckType = null;
    state.entity = null;
    state.entityDataSource = undefined;
    state.entityDialogDataSource = undefined;
    state.query = null;
    state.filterItems = [];
    this.changed();
  }

  onCkTypeSelected(draft: ProcessBindingDraft, ckType: CkTypeSelectorItem): void {
    const state = this.ui(draft);
    state.ckType = ckType;
    state.entity = null;
    draft.ckTypeId = ckType.rtCkTypeId;
    draft.rtId = undefined;
    draft.rtDisplayName = undefined;
    draft.filters = undefined;
    state.filterItems = [];
    this.setEntityDataSources(state, ckType.rtCkTypeId);
    this.changed();
  }

  onCkTypeCleared(draft: ProcessBindingDraft): void {
    const state = this.ui(draft);
    state.ckType = null;
    state.entity = null;
    state.entityDataSource = undefined;
    state.entityDialogDataSource = undefined;
    state.filterItems = [];
    draft.ckTypeId = undefined;
    draft.rtId = undefined;
    draft.rtDisplayName = undefined;
    draft.filters = undefined;
    this.changed();
  }

  onEntitySelected(draft: ProcessBindingDraft, entity: RuntimeEntityItem): void {
    this.ui(draft).entity = entity;
    draft.rtId = entity.rtId;
    draft.rtDisplayName = entity.rtDisplayName || undefined;
    this.changed();
  }

  onEntityCleared(draft: ProcessBindingDraft): void {
    this.ui(draft).entity = null;
    draft.rtId = undefined;
    draft.rtDisplayName = undefined;
    this.changed();
  }

  onQuerySelected(draft: ProcessBindingDraft, query: ProcessBindingQueryItem | null | undefined): void {
    const state = this.ui(draft);
    const sameCkType = (query?.queryCkTypeId ?? undefined) === draft.queryCkTypeId;
    state.query = query ?? null;
    draft.queryRtId = query?.rtId;
    draft.queryName = query?.name;
    draft.queryCkTypeId = query?.queryCkTypeId ?? undefined;
    draft.queryFamily = queryFamily(query?.ckTypeId) ?? undefined;
    // The time-filter opt-out applies to stream-data queries only.
    if (draft.queryFamily !== 'streamData') {
      draft.ignoreTimeFilter = undefined;
    }
    // Filters refer to the attributes of the queried CK type.
    if (!sameCkType) {
      draft.filters = undefined;
      state.filterItems = [];
    }
    this.changed();
  }

  onSelectorChange(draft: ProcessBindingDraft, selectorId: string | null | undefined): void {
    draft.entitySelectorId = selectorId ?? undefined;
    this.changed();
  }

  onFiltersChange(draft: ProcessBindingDraft, filters: FieldFilterItem[]): void {
    this.ui(draft).filterItems = filters;
    draft.filters = filters.length > 0
      ? filters.map(f => ({ attributePath: f.attributePath, operator: f.operator, comparisonValue: f.comparisonValue }))
      : undefined;
    this.changed();
  }

  changed(): void {
    this.draftsChange.emit(this.drafts);
  }

  private focusLater(selector: string): void {
    setTimeout(() => {
      this.cdr.detectChanges();
      this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
    });
  }
}
