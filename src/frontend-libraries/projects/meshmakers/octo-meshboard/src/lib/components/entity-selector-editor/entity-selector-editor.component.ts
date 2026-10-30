import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, from, firstValueFrom, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { plusIcon, pencilIcon } from '@progress/kendo-svg-icons';
import { ConfirmationService, EntitySelectInputComponent, MM_ACTION_ICONS } from '@meshmakers/shared-ui';
import {
  CkTypeSelectorInputComponent,
  AttributeSelectorDialogService,
  FieldFilterEditorComponent,
  type FieldFilterItem,
  type FilterVariable
} from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, FieldFilterOperatorsDto, type AttributeItem, type FieldFilterDto } from '@meshmakers/octo-services';
import {
  EntitySelectorConfig,
  EntitySelectorAttributeMapping,
  EntitySelectorScopeHop,
  MAX_SCOPE_HOPS,
  MeshBoardVariable,
  WidgetFilterConfig
} from '../../models/meshboard.models';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { RuntimeEntitySelectDataSource, RuntimeEntityDialogDataSource, RuntimeEntityItem } from '../../utils/runtime-entity-data-sources';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import {
  eligibleLeaders,
  followValidationError,
  labelList,
  resolveFollowLeader,
  selectorsFollowing
} from '../../utils/entity-selector-follow';
import { childScopeFromHops, scopeHopsOf, scopeHopsValidationError } from '../../utils/entity-selector-scope-path';
import { unresolvedFilterVariables, withPickerFilters } from '../../utils/entity-selector-filter';
import { EntitySelectorScopePathEditorComponent } from '../entity-selector-scope-path-editor/entity-selector-scope-path-editor.component';
import { resolveScopePath } from '../../utils/entity-selector-scope-path';
import { resolveScopeSource } from '../../utils/entity-selector-scope-source';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import {
  dependentsSentence,
  isInvalidScopeSource,
  lockLastHopTarget,
  scopeSourceLeaderOptions,
  scopeSourceSummary,
  scopeSourceToSave,
  scopeSourceValidationError,
  selectorName,
  selectorsDependingOn
} from './entity-selector-scope-source-editor';

/**
 * Component for editing entity selector configurations in MeshBoard settings.
 * Allows adding, editing, and removing entity selectors.
 * Selectors can optionally appear in the toolbar for user selection, or be hidden
 * with a pre-configured default entity (replacing the old runtime entity variables).
 */
@Component({
  selector: 'mm-entity-selector-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputsModule,
    LabelModule,
    SVGIconModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent,
    EntitySelectorScopePathEditorComponent,
    FieldFilterEditorComponent
  ],
  templateUrl: './entity-selector-editor.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './entity-selector-editor.component.scss'
})
export class EntitySelectorEditorComponent {
  private readonly attributeSelectorService = inject(AttributeSelectorDialogService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly confirmationService = inject(ConfirmationService, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  // MeshBoardDataService is resolved on first use (default-entity scope check),
  // so hosts and specs that never check a dependent default need not provide it.
  private readonly injector = inject(Injector);

  @Input() entitySelectors: EntitySelectorConfig[] = [];
  /** Existing variable names from other sources (static variables, other selectors) for duplicate detection */
  @Input() existingVariableNames: string[] = [];
  /**
   * The board's static variables (AB#7724): offered in the picker filter and
   * substituted when the editor lists default entities and checks the default.
   */
  @Input() variables: MeshBoardVariable[] = [];
  @Output() entitySelectorsChange = new EventEmitter<EntitySelectorConfig[]>();
  /** Emits true when entering edit mode, false when leaving — allows parent to hide its own buttons */
  @Output() editingStateChange = new EventEmitter<boolean>();

  protected readonly plusIcon = plusIcon;
  protected readonly trashIcon = MM_ACTION_ICONS.delete;
  protected readonly pencilIcon = pencilIcon;

  // Editing state
  protected isEditing = false;
  protected editingIndex: number | null = null;
  protected editId = '';
  protected editLabel = '';
  protected editCkTypeId = '';
  protected editCkTypeItem: CkTypeSelectorItem | null = null;
  protected editMappings: EntitySelectorAttributeMapping[] = [];
  protected editShowInToolbar = true;
  protected editDefaultRtId = '';

  // Child scope (stream-data, AB#7723): the hops from the picked entity to the
  // entities whose rtIds scope bound widgets. Empty = the picked entity itself.
  // One hop saves in the original top-level form, two or more as `path`.
  protected editScopeHops: EntitySelectorScopeHop[] = [];

  // Leader/follower (AB#7722): id of the selector this one follows ('' = none).
  protected editFollowsSelectorId = '';
  /** Why choosing the leader changed the form (CK type fixed, mappings/default cleared). */
  protected followNotice = '';

  // Picker filter (AB#7724): attribute rows on the CK type, AND-combined.
  protected editFilters: FieldFilterItem[] = [];
  /** Filter rows a follower carries from hand-editing; ignored and dropped on save. */
  protected followerFilterCount = 0;
  /** Result of the server check whether the default entity matches the filter. */
  protected defaultFilterCheck: DefaultFilterCheck = { state: 'none' };
  private readonly defaultCheckRequests = new Subject<DefaultCheckRequest | DefaultFilterCheck>();

  // Dependent selector (AB#7917): the picker lists only the entities reached
  // from the leader's pick through the path ('' = not dependent).
  protected editScopeSourceSelectorId = '';
  /** Hops from the leader's CK type to this selector's CK type; the last target is fixed. */
  protected editScopeSourceHops: EntitySelectorScopeHop[] = [];
  /** Result of the check whether the default entity is inside the leader's default pick. */
  protected defaultScopeCheck: DefaultScopeCheck = { state: 'none' };
  private readonly scopeCheckRequests = new Subject<DefaultScopeCheckRequest | null>();

  // Data sources for the default entity picker (created when CK type is set)
  protected defaultEntityDataSource: RuntimeEntitySelectDataSource | null = null;
  protected defaultEntityDialogDataSource: RuntimeEntityDialogDataSource | null = null;

  constructor() {
    // Debounced so typing in the filter grid does not fire a request per key;
    // switchMap drops the answer of an outdated check.
    this.defaultCheckRequests.pipe(
      debounceTime(DEFAULT_CHECK_DEBOUNCE_MS),
      switchMap(request => 'state' in request ? of(request) : this.checkDefaultEntity(request)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(check => {
      this.defaultFilterCheck = check;
      this.cdr.markForCheck();
    });
    this.scopeCheckRequests.pipe(
      debounceTime(DEFAULT_CHECK_DEBOUNCE_MS),
      switchMap(request => request ? from(this.checkDefaultInScope(request)) : of<DefaultScopeCheck>({ state: 'none' })),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(check => {
      this.defaultScopeCheck = check;
      this.cdr.markForCheck();
    });
  }

  /**
   * Starts adding a new entity selector.
   */
  addSelector(): void {
    this.editingIndex = null;
    this.editId = this.generateSelectorId();
    this.editLabel = '';
    this.editCkTypeId = '';
    this.editCkTypeItem = null;
    this.editMappings = [];
    this.editShowInToolbar = true;
    this.editDefaultRtId = '';
    this.editScopeHops = [];
    this.editFollowsSelectorId = '';
    this.followNotice = '';
    this.editFilters = [];
    this.followerFilterCount = 0;
    this.defaultFilterCheck = { state: 'none' };
    this.editScopeSourceSelectorId = '';
    this.editScopeSourceHops = [];
    this.defaultScopeCheck = { state: 'none' };
    this.defaultEntityDataSource = null;
    this.defaultEntityDialogDataSource = null;
    this.isEditing = true;
    this.editingStateChange.emit(true);
  }

  /**
   * Starts editing an existing entity selector.
   */
  editSelector(index: number): void {
    const selector = this.entitySelectors[index];
    this.editingIndex = index;
    this.editId = selector.id;
    this.editLabel = selector.label;
    this.editCkTypeId = selector.ckTypeId;
    // Create a minimal CkTypeSelectorItem so the input shows the selected type
    this.editCkTypeItem = {
      fullName: selector.ckTypeId,
      rtCkTypeId: selector.ckTypeId,
      isAbstract: false,
      isFinal: false
    };
    this.editMappings = [...selector.attributeMappings];
    this.editShowInToolbar = selector.showInToolbar !== false;
    this.editDefaultRtId = selector.defaultRtId ?? '';
    this.editScopeHops = scopeHopsOf(selector.childScope);
    this.editFollowsSelectorId = selector.followsSelectorId ?? '';
    this.followNotice = '';
    this.editFilters = (selector.filters ?? []).map((f, i) => ({
      id: i + 1,
      attributePath: f.attributePath,
      operator: f.operator as FieldFilterOperatorsDto,
      comparisonValue: f.comparisonValue
    }));
    this.followerFilterCount = selector.followsSelectorId ? this.editFilters.length : 0;
    this.defaultFilterCheck = { state: 'none' };
    this.editScopeSourceSelectorId = selector.scopeSource?.selectorId ?? '';
    this.editScopeSourceHops = (Array.isArray(selector.scopeSource?.path) ? selector.scopeSource.path : [])
      .map(h => ({ roleId: h.roleId ?? '', direction: h.direction ?? 'in', targetCkTypeId: h.targetCkTypeId ?? '' }));
    this.defaultScopeCheck = { state: 'none' };
    // A follower picks from its leader's CK type; re-sync it in case the leader's
    // type changed after the follower was saved.
    const leader = resolveFollowLeader(this.entitySelectors, selector);
    if (leader.kind === 'leader' && leader.leader.ckTypeId !== this.editCkTypeId) {
      this.applyLeaderCkType(leader.leader.ckTypeId);
    }
    this.updateDefaultEntityDataSources();
    this.requestDefaultCheck();
    this.requestScopeCheck();
    this.isEditing = true;
    this.editingStateChange.emit(true);
  }

  /**
   * Removes an entity selector at the given index.
   */
  async removeSelector(index: number): Promise<void> {
    const selector = this.entitySelectors[index];
    const followers = selector ? selectorsFollowing(this.entitySelectors, selector.id) : [];
    const dependents = selector ? selectorsDependingOn(this.entitySelectors, selector.id) : [];
    if ((followers.length > 0 || dependents.length > 0) && this.confirmationService) {
      // AB#7722: removing a leader orphans its followers — name them.
      // AB#7917: and its dependents, whose pickers then list nothing.
      const name = selector.label || selector.id;
      const consequences: string[] = [];
      if (followers.length > 0) {
        consequences.push(`${labelList(followers)} ${followers.length === 1 ? 'follows' : 'follow'} this selector. `
          + 'Without a leader they behave as if the leader had no pick until you choose another leader.');
      }
      if (dependents.length > 0) {
        consequences.push(`${dependentsSentence(dependents)}. Their pickers list nothing until you choose another leader or none.`);
      }
      const confirmed = await this.confirmationService.showDangerConfirm({
        title: `Remove selector ${name}?`,
        targetName: name,
        consequence: consequences.join(' '),
        confirmText: 'Remove selector'
      });
      if (!confirmed) return;
    }
    this.entitySelectors = this.entitySelectors.filter((_, i) => i !== index);
    this.emitChange();
  }

  /** Selectors the edited selector may follow (non-followers, never itself). */
  get leaderOptions(): EntitySelectorConfig[] {
    return eligibleLeaders(this.entitySelectors, this.editId);
  }

  /** Selectors that follow the edited selector (it then cannot follow one itself). */
  get followedBy(): EntitySelectorConfig[] {
    return this.editingIndex === null ? [] : selectorsFollowing(this.entitySelectors, this.editId);
  }

  /** True when the stored leader is not among the selectable leaders (deleted or a follower). */
  get isLeaderUnavailable(): boolean {
    return !!this.editFollowsSelectorId && !this.leaderOptions.some(l => l.id === this.editFollowsSelectorId);
  }

  /** "A, B and C" of the selectors following the edited one. */
  get followedByLabels(): string {
    return labelList(this.followedBy);
  }

  /** Validation message of the "Follows" choice, or '' when it is valid. */
  get followError(): string {
    const error = followValidationError(this.entitySelectors, this.editId, this.editFollowsSelectorId || undefined);
    if (error) return error;
    // AB#7917: a leader of dependents must keep its picker.
    if (this.editFollowsSelectorId && this.dependents.length > 0) {
      return `${dependentsSentence(this.dependents)}. A selector with dependents cannot follow another one.`;
    }
    return '';
  }

  /** Selectors that list only entities inside the edited selector (AB#7917). */
  get dependents(): EntitySelectorConfig[] {
    return this.editingIndex === null ? [] : selectorsDependingOn(this.entitySelectors, this.editId);
  }

  /** "A and B" of the selectors depending on the edited one. */
  get dependentsLabels(): string {
    return labelList(this.dependents);
  }

  /** True when the Follows choice is locked: the selector is followed or has dependents and follows nobody. */
  get isFollowsLocked(): boolean {
    return (this.followedBy.length > 0 || this.dependents.length > 0) && !this.editFollowsSelectorId;
  }

  // ----- Dependent selector (AB#7917) -----

  /** Selectors the edited one may list "inside": not followers, not dependent, not itself. */
  get scopeSourceLeaderOptions(): EntitySelectorConfig[] {
    return scopeSourceLeaderOptions(this.entitySelectors, this.editId);
  }

  /** True when the stored leader is not among the selectable leaders (deleted, follower, dependent). */
  get isScopeSourceLeaderUnavailable(): boolean {
    return !!this.editScopeSourceSelectorId
      && !this.scopeSourceLeaderOptions.some(l => l.id === this.editScopeSourceSelectorId);
  }

  /** The leader selector of the scope source, if it exists. */
  get scopeSourceLeader(): EntitySelectorConfig | undefined {
    return this.entitySelectors.find(s => s.id === this.editScopeSourceSelectorId);
  }

  /** Label of the scope source leader (label, else id). */
  get scopeSourceLeaderLabel(): string {
    return selectorName(this.scopeSourceLeader, this.editScopeSourceSelectorId);
  }

  /** Source type of hop 1: the leader's CK type. */
  get scopeSourceLeaderCkTypeId(): string {
    return this.scopeSourceLeader?.ckTypeId ?? '';
  }

  /** "Room" — the edited selector in texts. */
  get editName(): string {
    return this.editLabel.trim() || this.editId || 'this selector';
  }

  /** True when the "Inside the pick of" choice is locked: other selectors depend on this one (one level). */
  get isScopeSourceLocked(): boolean {
    return this.dependents.length > 0 && !this.editScopeSourceSelectorId;
  }

  /** Validation message of the scope source, or '' when it can be saved (or is dropped on save). */
  get scopeSourceError(): string {
    if (this.isFollower || !this.editScopeSourceSelectorId) return '';
    return scopeSourceValidationError(this.entitySelectors, this.formSelectorForValidation()) ?? '';
  }

  /**
   * The scope source error as the section shows it: hop errors are already
   * shown by the path editor next to the hop, so they are not repeated here.
   */
  get scopeSourceDisplayError(): string {
    const error = this.scopeSourceError;
    return error && error !== scopeHopsValidationError(this.editScopeSourceHops) ? error : '';
  }

  /** Maximum hop count of a path (getter: relative imports must not initialise fields). */
  get maxScopeHops(): number {
    return MAX_SCOPE_HOPS;
  }

  /** Handles a change of the "Inside the pick of" choice. */
  onScopeSourceChanged(leaderId: string): void {
    this.editScopeSourceSelectorId = leaderId;
    if (leaderId && this.editScopeSourceHops.length === 0) {
      // Start with one hop to this selector's type; the author picks the association.
      this.editScopeSourceHops = [{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: this.editCkTypeId }];
    }
    this.editScopeSourceHops = lockLastHopTarget(this.editScopeSourceHops, this.editCkTypeId);
    this.requestScopeCheck();
  }

  /** Takes the hop list of the scope source path editor. */
  onScopeSourceHopsChanged(hops: EntitySelectorScopeHop[]): void {
    this.editScopeSourceHops = lockLastHopTarget(hops, this.editCkTypeId);
    this.requestScopeCheck();
  }

  /** "Inside: Site (3 hops)" chip of a selector in the list, or ''. */
  getScopeSourceSummary(selector: EntitySelectorConfig): string {
    return scopeSourceSummary(this.entitySelectors, selector);
  }

  /** True when a selector's scope source cannot be used (list chip shown as an error). */
  isInvalidScopeSource(selector: EntitySelectorConfig): boolean {
    return isInvalidScopeSource(this.entitySelectors, selector);
  }

  /** The edited selector as far as the scope source validation needs it. */
  private formSelectorForValidation(): EntitySelectorConfig {
    return {
      id: this.editId,
      label: this.editLabel.trim(),
      ckTypeId: this.editCkTypeId,
      attributeMappings: [],
      ...(this.editFollowsSelectorId ? { followsSelectorId: this.editFollowsSelectorId } : {}),
      ...(this.editScopeSourceSelectorId
        ? { scopeSource: { selectorId: this.editScopeSourceSelectorId, path: this.editScopeSourceHops } }
        : {})
    };
  }

  /** True while the edited selector follows another one. */
  get isFollower(): boolean {
    return !!this.editFollowsSelectorId;
  }

  /**
   * Handles a change of the "Follows" choice. Choosing a leader fixes the CK type
   * to the leader's (clearing default entity and mappings with a notice when the
   * type changes) and hides the toolbar option; back to none makes the CK type
   * editable again with "Show in Toolbar" unchecked.
   */
  onFollowsChanged(leaderId: string): void {
    this.editFollowsSelectorId = leaderId;
    this.followNotice = '';
    this.editShowInToolbar = false;
    // A follower has no picker: its filter rows are ignored and dropped on save (AB#7724).
    this.followerFilterCount = leaderId ? this.editFilters.length : 0;
    this.requestDefaultCheck();
    this.requestScopeCheck();
    this.updateDefaultEntityDataSources();
    if (!leaderId) return;
    const leader = this.entitySelectors.find(s => s.id === leaderId);
    if (leader && leader.ckTypeId !== this.editCkTypeId) {
      const cleared = this.editMappings.length > 0 || !!this.editDefaultRtId;
      this.applyLeaderCkType(leader.ckTypeId);
      this.updateDefaultEntityDataSources();
      if (cleared) {
        this.followNotice = `The CK type is now the leader's (${leader.ckTypeId}); `
          + 'the default entity and attribute mappings of the previous type were cleared.';
      }
    }
  }

  /** True when the selector names a leader that does not exist or is itself a follower. */
  isOrphanFollower(selector: EntitySelectorConfig): boolean {
    return resolveFollowLeader(this.entitySelectors, selector).kind === 'invalid';
  }

  private applyLeaderCkType(ckTypeId: string): void {
    this.editCkTypeId = ckTypeId;
    this.editCkTypeItem = { fullName: ckTypeId, rtCkTypeId: ckTypeId, isAbstract: false, isFinal: false };
    this.editMappings = [];
    this.editDefaultRtId = '';
    this.editFilters = [];
    this.followerFilterCount = 0;
  }

  /**
   * Handles CK type selection in the editor form.
   */
  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.editCkTypeId = ckType.rtCkTypeId;
    this.editCkTypeItem = ckType;
    // Clear mappings, default entity and filter rows when CK type changes
    this.editMappings = [];
    this.editDefaultRtId = '';
    this.editFilters = [];
    // The scope source path ends at this selector's type (AB#7917).
    this.editScopeSourceHops = lockLastHopTarget(this.editScopeSourceHops, this.editCkTypeId);
    this.updateDefaultEntityDataSources();
    this.requestDefaultCheck();
    this.requestScopeCheck();
  }

  /**
   * Handles CK type cleared in the editor form.
   */
  onCkTypeCleared(): void {
    this.editCkTypeId = '';
    this.editCkTypeItem = null;
    this.editMappings = [];
    this.editDefaultRtId = '';
    this.editFilters = [];
    this.defaultEntityDataSource = null;
    this.defaultEntityDialogDataSource = null;
    this.requestDefaultCheck();
    this.requestScopeCheck();
  }

  /**
   * Opens the attribute selector dialog to pick attributes for variable mappings.
   */
  async selectAttributes(): Promise<void> {
    if (!this.editCkTypeId) return;

    const result = await this.attributeSelectorService.openAttributeSelector(
      this.editCkTypeId,
      this.editMappings.map(m => m.attributePath),
      'Select Attributes for Variables'
    );

    if (!result.confirmed) return;

    // Map selected attributes to mappings, preserving existing variable names
    this.editMappings = result.selectedAttributes.map((attr: AttributeItem) => {
      const existing = this.editMappings.find(m => m.attributePath === attr.attributePath);
      return {
        attributePath: attr.attributePath,
        variableName: existing?.variableName ?? this.variableService.attributePathToVariableName(attr.attributePath),
        attributeValueType: attr.attributeValueType
      };
    });
  }

  /** Takes the hop list of the child-scope editor (AB#7723). */
  onScopeHopsChanged(hops: EntitySelectorScopeHop[]): void {
    this.editScopeHops = hops;
  }

  /** Validation message of the hop list, or '' when it can be saved. */
  get scopeHopsError(): string {
    return scopeHopsValidationError(this.editScopeHops) ?? '';
  }

  /**
   * Handles default entity selection from the entity picker.
   */
  onDefaultEntitySelected(entity: RuntimeEntityItem): void {
    this.editDefaultRtId = entity.rtId;
    this.requestDefaultCheck();
    this.requestScopeCheck();
  }

  /**
   * Handles default entity cleared.
   */
  onDefaultEntityCleared(): void {
    this.editDefaultRtId = '';
    this.requestDefaultCheck();
    this.requestScopeCheck();
  }

  /** Takes the rows of the picker filter editor (AB#7724). */
  onFiltersChange(filters: FieldFilterItem[]): void {
    this.editFilters = filters;
    this.updateDefaultEntityDataSources();
    this.requestDefaultCheck();
  }

  /**
   * Variables offered in filter values: the board's static variables and the
   * variables other selectors map. The edited selector's own mappings are
   * left out — they are filled from its own pick.
   */
  get filterVariables(): FilterVariable[] {
    const result = new Map<string, FilterVariable>();
    for (const v of this.variables) {
      result.set(v.name, { name: v.name, label: v.label || v.name, type: v.type });
    }
    this.entitySelectors
      .filter((_, i) => i !== this.editingIndex)
      .forEach(es => es.attributeMappings.forEach(m => {
        if (!result.has(m.variableName)) {
          result.set(m.variableName, { name: m.variableName, label: `${m.variableName} (${es.label || es.id})` });
        }
      }));
    return [...result.values()];
  }

  /** "2 filters" chip of a selector in the list, or '' without filter. */
  getFilterSummary(selector: EntitySelectorConfig): string {
    const count = selector.followsSelectorId ? 0 : selector.filters?.length ?? 0;
    if (count === 0) return '';
    return count === 1 ? '1 filter' : `${count} filters`;
  }

  /** "$a, $b" of the variables the default-entity check cannot substitute. */
  get uncheckedVariablesText(): string {
    return this.defaultFilterCheck.state === 'unchecked'
      ? this.defaultFilterCheck.variables.map(v => `$${v}`).join(', ')
      : '';
  }

  /** Label of the leader the edited follower takes its pick from. */
  get leaderLabel(): string {
    const leader = this.entitySelectors.find(s => s.id === this.editFollowsSelectorId);
    return leader ? (leader.label || leader.id) : this.editFollowsSelectorId;
  }

  /**
   * Saves the current entity selector being edited.
   */
  saveEdit(): void {
    if (!this.isEditValid()) return;

    // No hops = no childScope (the picked entity itself is the scope); one hop
    // in the original top-level form (older library versions keep reading it);
    // two or more hops as `path` (AB#7723).
    const childScope = childScopeFromHops(this.editScopeHops);

    const selector: EntitySelectorConfig = {
      id: this.editId,
      label: this.editLabel.trim(),
      ckTypeId: this.editCkTypeId,
      attributeMappings: this.editMappings,
      showInToolbar: this.editShowInToolbar,
      defaultRtId: this.editDefaultRtId.trim() || undefined,
      childScope,
      // Picker filter (AB#7724); omitted when empty and never written for a follower.
      filters: !this.editFollowsSelectorId && this.editFilters.length > 0 ? this.toFilterConfigs(this.editFilters) : undefined,
      // Dependent selector (AB#7917); omitted for "(none)" and never written for a
      // follower (it has no picker). Always a path, also for one hop.
      scopeSource: !this.editFollowsSelectorId && this.editScopeSourceSelectorId
        ? scopeSourceToSave(this.editScopeSourceSelectorId, lockLastHopTarget(this.editScopeSourceHops, this.editCkTypeId))
        : undefined,
      // A follower never renders a picker (AB#7722).
      ...(this.editFollowsSelectorId ? { showInToolbar: false, followsSelectorId: this.editFollowsSelectorId } : {})
    };

    if (this.editingIndex !== null) {
      this.entitySelectors = this.entitySelectors.map((es, i) =>
        i === this.editingIndex ? selector : es
      );
    } else {
      this.entitySelectors = [...this.entitySelectors, selector];
    }

    this.isEditing = false;
    this.editingIndex = null;
    this.editingStateChange.emit(false);
    this.emitChange();
  }

  /**
   * Cancels the current edit.
   */
  cancelEdit(): void {
    this.isEditing = false;
    this.editingIndex = null;
    this.editingStateChange.emit(false);
  }

  /**
   * Validates the current edit form.
   */
  isEditValid(): boolean {
    const hasRequiredFields =
      this.editId.trim().length > 0 &&
      this.editLabel.trim().length > 0 &&
      this.editCkTypeId.length > 0 &&
      // A follower mostly exists for its child scope: mappings are optional (AB#7722).
      (this.isFollower || this.editMappings.length > 0) &&
      this.editMappings.every(m =>
        m.variableName.trim().length > 0 &&
        this.isValidVariableName(m.variableName) &&
        !this.isDuplicateVariableName(m.variableName, m.attributePath)
      ) &&
      !this.isDuplicateId(this.editId, this.editingIndex);

    // If not shown in toolbar, a default entity must be selected — except for a
    // follower, which takes its leader's pick (AB#7722).
    if (!this.isFollower && !this.editShowInToolbar && !this.editDefaultRtId.trim()) {
      return false;
    }

    if (this.followError) {
      return false;
    }

    // Every hop needs an association and a target type; at most 5 hops (AB#7723).
    if (this.scopeHopsError) {
      return false;
    }

    // Leader and path of a dependent selector (AB#7917).
    if (this.scopeSourceError) {
      return false;
    }

    return hasRequiredFields;
  }

  /**
   * Checks if a selector ID is duplicate.
   */
  isDuplicateId(id: string, excludeIndex: number | null): boolean {
    return this.entitySelectors.some((es, i) => i !== excludeIndex && es.id === id);
  }

  /**
   * Gets a display summary for an entity selector's attribute mappings.
   */
  getMappingSummary(selector: EntitySelectorConfig): string {
    return selector.attributeMappings
      .map(m => `$${m.variableName}`)
      .join(', ');
  }

  /**
   * Gets a display label indicating the selector mode.
   */
  getModeLabel(selector: EntitySelectorConfig): string {
    const leader = resolveFollowLeader(this.entitySelectors, selector);
    if (leader.kind === 'leader') {
      return `Follows: ${leader.leader.label || leader.leader.id}`;
    }
    if (leader.kind === 'invalid') {
      return 'Follows: missing';
    }
    return selector.showInToolbar !== false ? 'Toolbar' : 'Fixed';
  }

  /**
   * Validates a variable name format (alphanumeric + underscore).
   */
  isValidVariableName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim());
  }

  /**
   * Checks if a variable name is already used — either by another mapping in the current
   * edit form, by another entity selector's mappings, or by an existing static variable.
   */
  isDuplicateVariableName(name: string, currentAttributePath: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;

    // Check within current edit mappings (duplicate within same selector)
    const duplicateInCurrentMappings = this.editMappings.some(
      m => m.attributePath !== currentAttributePath && m.variableName.trim() === trimmed
    );
    if (duplicateInCurrentMappings) return true;

    // Check against other entity selectors' mappings (not the one being edited)
    const otherSelectors = this.entitySelectors.filter((_, i) => i !== this.editingIndex);
    const duplicateInOtherSelectors = otherSelectors.some(
      es => es.attributeMappings.some(m => m.variableName === trimmed)
    );
    if (duplicateInOtherSelectors) return true;

    // Check against existing variable names from other sources (static, timeFilter)
    return this.existingVariableNames.includes(trimmed);
  }

  /**
   * Returns the duplicate error message for a variable name, or empty string if valid.
   */
  getVariableNameError(mapping: EntitySelectorAttributeMapping): string {
    const name = mapping.variableName.trim();
    if (!name) return 'Variable name is required';
    if (!this.isValidVariableName(name)) return 'Invalid name (use letters, numbers, underscore)';
    if (this.isDuplicateVariableName(name, mapping.attributePath)) return 'Name already in use';
    return '';
  }

  private generateSelectorId(): string {
    const prefix = 'es';
    let counter = this.entitySelectors.length + 1;
    while (this.entitySelectors.some(es => es.id === `${prefix}${counter}`)) {
      counter++;
    }
    return `${prefix}${counter}`;
  }

  private updateDefaultEntityDataSources(): void {
    if (this.editCkTypeId) {
      // The default-entity picker lists what the toolbar picker lists (AB#7724).
      const gql = withPickerFilters(this.getEntitiesByCkTypeGQL, this.resolvedEditorFilters().filters);
      this.defaultEntityDataSource = new RuntimeEntitySelectDataSource(gql, this.editCkTypeId);
      this.defaultEntityDialogDataSource = new RuntimeEntityDialogDataSource(gql, this.editCkTypeId);
    } else {
      this.defaultEntityDataSource = null;
      this.defaultEntityDialogDataSource = null;
    }
  }

  private toFilterConfigs(rows: FieldFilterItem[]): WidgetFilterConfig[] {
    return rows.map(f => ({
      attributePath: f.attributePath,
      operator: f.operator,
      comparisonValue: f.comparisonValue == null ? '' : String(f.comparisonValue)
    }));
  }

  /**
   * The filter rows that apply in the editor, with the board's static
   * variables substituted. Rows whose value still names a variable without a
   * value (e.g. one a selector pick fills at view time) are left out and
   * reported in `unresolved`; the editor cannot know their value.
   */
  private resolvedEditorFilters(): { filters: FieldFilterDto[] | undefined; unresolved: string[] } {
    if (this.isFollower || this.editFilters.length === 0) {
      return { filters: undefined, unresolved: [] };
    }
    const converted = this.variableService.convertToFieldFilterDto(this.toFilterConfigs(this.editFilters), this.variables) ?? [];
    const unresolved = unresolvedFilterVariables(converted);
    const applicable = converted.filter(f => unresolvedFilterVariables([f]).length === 0);
    return { filters: applicable.length > 0 ? applicable : undefined, unresolved };
  }

  /** Queues the (debounced) check whether the default entity matches the filter. */
  private requestDefaultCheck(): void {
    const rtId = this.editDefaultRtId.trim();
    if (!rtId || !this.editCkTypeId || this.isFollower || this.editFilters.length === 0) {
      this.defaultCheckRequests.next({ state: 'none' });
      return;
    }
    const { filters, unresolved } = this.resolvedEditorFilters();
    if (unresolved.length > 0) {
      this.defaultCheckRequests.next({ state: 'unchecked', variables: unresolved });
      return;
    }
    this.defaultCheckRequests.next({ ckTypeId: this.editCkTypeId, rtId, filters: filters ?? [] });
  }

  /** Asks the server whether the entity is among the filtered ones (rtId + filter, first 1). */
  private checkDefaultEntity(request: DefaultCheckRequest) {
    return this.getEntitiesByCkTypeGQL.fetch({
      variables: {
        ckTypeId: request.ckTypeId,
        attributeNames: [],
        rtId: request.rtId,
        first: 1,
        fieldFilters: request.filters
      },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const count = result.data?.runtime?.runtimeEntities?.totalCount
          ?? result.data?.runtime?.runtimeEntities?.items?.length ?? 0;
        return (count > 0 ? { state: 'match' } : { state: 'mismatch' }) as DefaultFilterCheck;
      }),
      catchError(() => of<DefaultFilterCheck>({ state: 'error' }))
    );
  }

  /**
   * Queues the (debounced) check whether the default entity lies inside the
   * leader's default pick (AB#7917). Only for a valid scope source and when
   * both selectors have a default; otherwise clears the result.
   */
  private requestScopeCheck(): void {
    const rtId = this.editDefaultRtId.trim();
    const leader = this.scopeSourceLeader;
    const leaderRtId = leader?.defaultRtId?.trim() ?? '';
    if (!rtId || !leader || !leaderRtId || this.isFollower || !this.editCkTypeId || this.scopeSourceError) {
      this.scopeCheckRequests.next(null);
      return;
    }
    const edited = this.formSelectorForValidation();
    const board = this.entitySelectors.map(s => (s.id === edited.id ? edited : s));
    const resolution = resolveScopeSource(board.some(s => s.id === edited.id) ? board : [...board, edited], edited);
    if (resolution.kind !== 'source') {
      this.scopeCheckRequests.next(null);
      return;
    }
    this.scopeCheckRequests.next({ rtId, leaderRtId, leaderCkTypeId: leader.ckTypeId, hops: resolution.hops });
  }

  /** Resolves the leader's default pick through the path and looks for the default entity. */
  private async checkDefaultInScope(request: DefaultScopeCheckRequest): Promise<DefaultScopeCheck> {
    try {
      const dataService = this.injector.get(MeshBoardDataService);
      const rtIds = await resolveScopePath(
        request.leaderRtId,
        request.leaderCkTypeId,
        request.hops,
        (sources, sourceCkTypeId, hop) => firstValueFrom(
          dataService.fetchAssociationTargetRtIds(sources, sourceCkTypeId, hop.targetCkTypeId, hop.roleId, hop.direction)
        )
      );
      return (rtIds ?? []).includes(request.rtId) ? { state: 'inside' } : { state: 'outside' };
    } catch {
      return { state: 'error' };
    }
  }

  private emitChange(): void {
    this.entitySelectorsChange.emit([...this.entitySelectors]);
  }
}

/** Debounce of the default-entity filter check (ms). */
const DEFAULT_CHECK_DEBOUNCE_MS = 400;

interface DefaultCheckRequest {
  ckTypeId: string;
  rtId: string;
  filters: FieldFilterDto[];
}

interface DefaultScopeCheckRequest {
  rtId: string;
  leaderRtId: string;
  leaderCkTypeId: string;
  hops: Parameters<typeof resolveScopePath>[2];
}

/**
 * Outcome of the check whether a dependent selector's default entity lies
 * inside its leader's default pick (AB#7917). Never blocks saving: `outside`
 * warns, `error` says the check failed.
 */
export type DefaultScopeCheck =
  | { state: 'none' }
  | { state: 'inside' }
  | { state: 'outside' }
  | { state: 'error' };

/**
 * Outcome of the default-entity filter check (AB#7724). Never blocks saving:
 * `mismatch` warns, `error` says the check failed, `unchecked` names the
 * variables the editor cannot substitute.
 */
export type DefaultFilterCheck =
  | { state: 'none' }
  | { state: 'match' }
  | { state: 'mismatch' }
  | { state: 'error' }
  | { state: 'unchecked'; variables: string[] };
