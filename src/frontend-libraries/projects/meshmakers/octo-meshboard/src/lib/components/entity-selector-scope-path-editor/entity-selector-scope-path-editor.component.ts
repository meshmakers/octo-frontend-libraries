import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { arrowDownIcon, arrowUpIcon, plusIcon } from '@progress/kendo-svg-icons';
import { MM_ACTION_ICONS } from '@meshmakers/shared-ui';
import { CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';
import type { CkTypeSelectorItem } from '@meshmakers/octo-services';
import { MAX_SCOPE_HOPS, type EntitySelectorScopeHop } from '../../models/meshboard.models';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { scopePathLabel } from '../../utils/entity-selector-scope-path';

/** One association of a CK type as the "Association" dropdown offers it. */
export interface ScopeAssociationOption {
  /** `<direction>|<roleId>|<baseTargetCkTypeId>`, or {@link OTHER_ASSOCIATION}. */
  key: string;
  roleId: string;
  direction: 'in' | 'out';
  /** Target type of the association in the CK metadata (base type for the target-type picker). */
  baseTargetCkTypeId: string;
  label: string;
}

/** Key of the "Other role…" entry: free-text role and direction. */
export const OTHER_ASSOCIATION = '__other__';

/** Association metadata of one CK type: loaded, empty, or failed to load. */
type AssociationLoad =
  | { state: 'loading' }
  | { state: 'loaded'; options: ScopeAssociationOption[] }
  | { state: 'failed' };

/** Editor row of one hop. */
interface HopRow {
  roleId: string;
  direction: 'in' | 'out';
  targetCkTypeId: string;
  targetItem: CkTypeSelectorItem | null;
  /** Key of the chosen association, or {@link OTHER_ASSOCIATION} for free text. */
  associationKey: string;
}

/**
 * Hop list of an entity selector's child scope (AB#7723; wireframe agreed by
 * Freya, AB#7723 comment 6625315). Each hop picks an association of its source
 * type from the CK metadata (role + direction + base target in one entry, or
 * "Other role…" for free text) and a target type restricted to types derived
 * from the association's target. The source type of hop 1 is the selector's
 * CK type, of every later hop the previous hop's target type. Hops can be
 * added (at most {@link MAX_SCOPE_HOPS}), removed and moved up/down.
 *
 * Two-way bindable; emits the hops as configured (validation is the host's,
 * see `scopeHopsValidationError`):
 * ```html
 * <mm-entity-selector-scope-path-editor
 *   [sourceCkTypeId]="ckTypeId"
 *   [(hops)]="hops">
 * </mm-entity-selector-scope-path-editor>
 * ```
 */
@Component({
  selector: 'mm-entity-selector-scope-path-editor',
  standalone: true,
  imports: [FormsModule, ButtonModule, DropDownsModule, InputsModule, CkTypeSelectorInputComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './entity-selector-scope-path-editor.component.html',
  styleUrl: './entity-selector-scope-path-editor.component.scss'
})
export class EntitySelectorScopePathEditorComponent {
  private readonly rolesGQL = inject(GetCkTypeAssociationRolesDtoGQL);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() hopsChange = new EventEmitter<EntitySelectorScopeHop[]>();

  @ViewChildren('hopCard') private hopCards?: QueryList<ElementRef<HTMLElement>>;

  protected rows: HopRow[] = [];
  protected readonly plusIcon = plusIcon;
  protected readonly arrowUpIcon = arrowUpIcon;
  protected readonly arrowDownIcon = arrowDownIcon;
  protected readonly trashIcon = MM_ACTION_ICONS.delete;

  private _sourceCkTypeId = '';
  private lastEmitted: EntitySelectorScopeHop[] | null = null;
  private readonly associations = new Map<string, AssociationLoad>();

  /** CK type of the picked entity — the source type of hop 1. */
  @Input()
  set sourceCkTypeId(value: string | null | undefined) {
    this._sourceCkTypeId = value ?? '';
    this.syncAssociationKeys();
  }
  get sourceCkTypeId(): string {
    return this._sourceCkTypeId;
  }

  /** The configured hops (one-hop form = one hop). */
  @Input()
  set hops(value: EntitySelectorScopeHop[] | null | undefined) {
    // Our own emission coming back through the two-way binding: keep the rows
    // (free-text mode) as they are.
    if (value && value === this.lastEmitted) return;
    this.rows = (value ?? []).map(h => ({
      roleId: h.roleId ?? '',
      direction: h.direction ?? 'in',
      targetCkTypeId: h.targetCkTypeId ?? '',
      targetItem: h.targetCkTypeId ? ckTypeItem(h.targetCkTypeId) : null,
      associationKey: ''
    }));
    this.syncAssociationKeys();
  }

  /** Maximum hop count (getter: relative imports must not initialise fields, see CLAUDE.md). */
  get maxHops(): number {
    return MAX_SCOPE_HOPS;
  }

  get canAddHop(): boolean {
    return this.rows.length < MAX_SCOPE_HOPS;
  }

  /** "Test/Site → Test/System → Test/Device". */
  get pathLabel(): string {
    return scopePathLabel(this.sourceCkTypeId || '?', this.rows);
  }

  /** True when the association metadata of any shown source type could not be loaded. */
  get metadataFailed(): boolean {
    return this.rows.some((_, i) => this.loadOf(i)?.state === 'failed');
  }

  /** Source type of hop `index`. */
  sourceTypeOf(index: number): string {
    return index === 0 ? this.sourceCkTypeId : this.rows[index - 1]?.targetCkTypeId ?? '';
  }

  /** Dropdown entries of hop `index`: the source type's associations plus "Other role…". */
  associationOptions(index: number): ScopeAssociationOption[] {
    const load = this.loadOf(index);
    const options = load?.state === 'loaded' ? load.options : [];
    return [...options, {
      key: OTHER_ASSOCIATION,
      roleId: '',
      direction: 'in',
      baseTargetCkTypeId: '',
      label: 'Other role…'
    }];
  }

  /** True when hop `index` offers the association dropdown (metadata loaded with ≥1 association). */
  hasAssociationList(index: number): boolean {
    const load = this.loadOf(index);
    return load?.state === 'loaded' && load.options.length > 0;
  }

  /** True when hop `index` shows the free-text role and direction fields. */
  isFreeText(index: number): boolean {
    return !this.hasAssociationList(index) || this.rows[index].associationKey === OTHER_ASSOCIATION;
  }

  /** Base type the target-type picker of hop `index` is restricted to (undefined = any type). */
  baseTargetOf(index: number): string | undefined {
    const row = this.rows[index];
    const option = this.associationOptions(index).find(o => o.key === row.associationKey && o.key !== OTHER_ASSOCIATION);
    return option?.baseTargetCkTypeId || undefined;
  }

  /**
   * Warning of hop `index` when its role is not an association of its (new)
   * source type — after a reorder, a removal or a changed earlier target. The
   * values are kept; it does not block saving.
   */
  associationWarning(index: number): string {
    const row = this.rows[index];
    if (!row.roleId.trim() || !this.hasAssociationList(index)) return '';
    const load = this.loadOf(index);
    const defined = load?.state === 'loaded'
      && load.options.some(o => o.roleId === row.roleId.trim() && o.direction === row.direction);
    return defined ? '' : `Association ${row.roleId.trim()} is not defined on ${this.sourceTypeOf(index) || 'the source type'}.`;
  }

  /** Validation message of hop `index`: an incomplete hop blocks saving (see `scopeHopsValidationError`). */
  hopError(index: number): string {
    const row = this.rows[index];
    return !row.roleId.trim() || !row.targetCkTypeId.trim()
      ? `Hop ${index + 1} needs an association and a target type.`
      : '';
  }

  isRoleInvalid(index: number): boolean {
    return !this.rows[index].roleId.trim();
  }

  isTargetInvalid(index: number): boolean {
    return !this.rows[index].targetCkTypeId.trim();
  }

  addHop(): void {
    if (!this.canAddHop) return;
    this.rows = [...this.rows, {
      roleId: 'System/ParentChild',
      direction: 'in',
      targetCkTypeId: '',
      targetItem: null,
      associationKey: ''
    }];
    this.syncAssociationKeys();
    this.emit();
  }

  removeHop(index: number): void {
    this.rows = this.rows.filter((_, i) => i !== index);
    this.syncAssociationKeys();
    this.emit();
  }

  moveHop(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.rows.length) return;
    const rows = [...this.rows];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.rows = rows;
    this.syncAssociationKeys();
    this.emit();
    this.focusHop(target);
  }

  onAssociationChanged(index: number, key: string): void {
    const row = this.rows[index];
    row.associationKey = key;
    const option = this.associationOptions(index).find(o => o.key === key);
    if (option && key !== OTHER_ASSOCIATION) {
      row.roleId = option.roleId;
      row.direction = option.direction;
    }
    this.emit();
  }

  onRoleChanged(index: number, roleId: string): void {
    this.rows[index].roleId = roleId;
    this.emit();
  }

  onDirectionChanged(index: number, direction: 'in' | 'out'): void {
    this.rows[index].direction = direction;
    this.emit();
  }

  onTargetSelected(index: number, ckType: CkTypeSelectorItem): void {
    const row = this.rows[index];
    row.targetCkTypeId = ckType.rtCkTypeId;
    row.targetItem = ckType;
    // Later hops keep their values; their source type changed, so re-match them.
    this.syncAssociationKeys();
    this.emit();
  }

  onTargetCleared(index: number): void {
    const row = this.rows[index];
    row.targetCkTypeId = '';
    row.targetItem = null;
    this.syncAssociationKeys();
    this.emit();
  }

  private emit(): void {
    this.lastEmitted = this.rows.map(r => ({ roleId: r.roleId, direction: r.direction, targetCkTypeId: r.targetCkTypeId }));
    this.hopsChange.emit(this.lastEmitted);
  }

  private loadOf(index: number): AssociationLoad | undefined {
    const type = this.sourceTypeOf(index);
    return type ? this.associations.get(type) : undefined;
  }

  /**
   * Matches every hop's role/direction to an entry of its source type's
   * associations (loading missing metadata); a hop whose association is not
   * listed switches to "Other role…" with its values kept.
   */
  private syncAssociationKeys(): void {
    this.rows.forEach((row, index) => {
      const type = this.sourceTypeOf(index);
      if (type && !this.associations.has(type)) {
        void this.loadAssociations(type);
      }
      const load = this.loadOf(index);
      if (load?.state !== 'loaded' || load.options.length === 0) {
        row.associationKey = '';
        return;
      }
      const match = load.options.find(o => o.roleId === row.roleId.trim() && o.direction === row.direction);
      row.associationKey = match ? match.key : (row.roleId.trim() ? OTHER_ASSOCIATION : '');
    });
  }

  private async loadAssociations(ckTypeId: string): Promise<void> {
    this.associations.set(ckTypeId, { state: 'loading' });
    try {
      const result = await firstValueFrom(this.rolesGQL.fetch({ variables: { ckTypeId } }));
      const ckType = result.data?.constructionKit?.types?.items?.[0];
      const options: ScopeAssociationOption[] = [];
      const add = (direction: 'in' | 'out', all: readonly ({ rtRoleId?: unknown; rtTargetCkTypeId?: unknown } | null)[] | null | undefined): void => {
        for (const assoc of all ?? []) {
          const roleId = assoc?.rtRoleId ? String(assoc.rtRoleId) : '';
          if (!roleId) continue;
          const base = assoc?.rtTargetCkTypeId ? String(assoc.rtTargetCkTypeId) : '';
          const key = `${direction}|${roleId}|${base}`;
          if (options.some(o => o.key === key)) continue;
          options.push({
            key,
            roleId,
            direction,
            baseTargetCkTypeId: base,
            label: `${roleId} · ${direction === 'in' ? 'inbound' : 'outbound'}${base ? ` · ${base}` : ''}`
          });
        }
      };
      add('in', ckType?.associations?.in?.all);
      add('out', ckType?.associations?.out?.all);
      this.associations.set(ckTypeId, { state: 'loaded', options });
    } catch (error) {
      console.warn(`Could not load the associations of ${ckTypeId}:`, error);
      this.associations.set(ckTypeId, { state: 'failed' });
    }
    this.syncAssociationKeys();
    this.cdr.markForCheck();
  }

  /** Keeps the keyboard focus on a moved hop (wireframe change 4). */
  private focusHop(index: number): void {
    setTimeout(() => {
      const card = this.hopCards?.get(index)?.nativeElement;
      const button = card?.querySelector<HTMLElement>(`[data-hop-action="${index > 0 ? 'up' : 'down'}"]`);
      (button ?? card)?.focus();
    });
  }
}

function ckTypeItem(ckTypeId: string): CkTypeSelectorItem {
  return { fullName: ckTypeId, rtCkTypeId: ckTypeId, isAbstract: false, isFinal: false };
}
