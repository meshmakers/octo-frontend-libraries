import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CronBuilderComponent } from '@meshmakers/shared-ui';
import { KENDO_SVGICON } from '@progress/kendo-angular-icons';
import { KENDO_DATETIMEPICKER } from '@progress/kendo-angular-dateinputs';
import { KENDO_DROPDOWNLIST } from '@progress/kendo-angular-dropdowns';
import {
  KENDO_NUMERICTEXTBOX,
  KENDO_SWITCH,
  KENDO_TEXTAREA,
  KENDO_TEXTBOX,
} from '@progress/kendo-angular-inputs';
import { chevronDownIcon, chevronRightIcon } from '@progress/kendo-svg-icons';
import { isSecretValueType } from '@meshmakers/octo-services';
import { Subscription } from 'rxjs';
import { ENTITY_FORM_SECRET_KEY_RING_CONFIGURED } from '../core/secret-write-availability';
import { buildChangeSet } from '../core/change-set-builder';
import { formValuesEqual } from '../core/entity-form-value-mapper';
import { isVisible } from '../core/visible-when';
import { EntityFormsMessages, mergeEntityFormsMessages } from '../entity-forms.messages';
import {
  CkRecordInfo,
  EntityFormChangeSet,
  EntityFormMode,
  EntityFormValueState,
  ResolvedEntityForm,
  ResolvedField,
  ResolvedSection,
} from '../models/entity-form.models';
import { EntityFormRecordsFieldComponent } from './records/entity-form-records-field.component';
import { EntityFormReferenceFieldComponent } from './reference/entity-form-reference-field.component';
import { EntityFormChipsEditorComponent } from './editors/entity-form-chips-editor.component';
import { EntityFormSecretEditorComponent } from './editors/entity-form-secret-editor.component';
import {
  allFields,
  buildFormGroup,
  cloneValue,
  isFieldReadOnly,
  isFormReadOnly,
  isSecretRequired,
} from './entity-form-controls';
import { EntityFormFieldComponent, EntityFormSecretState } from './entity-form-field.component';

/** Integer value types: the number editor uses 0 decimals for these. */
const INTEGER_TYPES = ['INT', 'INTEGER', 'INT_64', 'INTEGER_64'];

/**
 * Renders a {@link ResolvedEntityForm} as a reactive form: sections (1 or 2 columns,
 * collapsible), one field shell per field and the editor chosen by the resolver.
 *
 * Rules applied here (see the plan, §2.4):
 * - A field hidden by `VisibleWhen` has its control disabled, so it neither validates nor appears
 *   in the change set. `Path=*` on a secret source counts the server-side presence as a value.
 * - Secrets are never prefilled; the badge says whether a value is set (also for read-only users).
 *   Empty = unchanged. An optional SECRET can be cleared: the clear is staged and sent on Save as
 *   `clearSecretAttributes` (mutually exclusive with a new value). Without a key ring
 *   (`ENTITY_FORM_SECRET_KEY_RING_CONFIGURED` = false) secret inputs are disabled with a hint.
 * - `afterCreate` fields are read-only outside create mode; `readOnly`, `view` mode or
 *   `capabilities.canEdit === false` (edit mode) make every field read-only.
 * - The change set holds only dirty controls (D6), built by `buildChangeSet`.
 */
@Component({
  selector: 'mm-entity-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    KENDO_TEXTBOX,
    KENDO_TEXTAREA,
    KENDO_NUMERICTEXTBOX,
    KENDO_SWITCH,
    KENDO_DROPDOWNLIST,
    KENDO_DATETIMEPICKER,
    KENDO_SVGICON,
    CronBuilderComponent,
    EntityFormFieldComponent,
    EntityFormChipsEditorComponent,
    EntityFormSecretEditorComponent,
    EntityFormReferenceFieldComponent,
    EntityFormRecordsFieldComponent,
  ],
  templateUrl: './entity-form.component.html',
  styleUrl: './entity-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityFormComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly keyRingConfigured = inject(ENTITY_FORM_SECRET_KEY_RING_CONFIGURED, { optional: true });

  // --- Inputs ---
  readonly model = input.required<ResolvedEntityForm>();
  readonly mode = input<EntityFormMode>('create');
  readonly state = input<EntityFormValueState | null | undefined>(undefined);
  readonly readOnly = input(false);
  readonly messages = input<Partial<EntityFormsMessages>>({});
  /** Record metadata keyed by versioned ckRecordId; improves type conversion of record sub-values. */
  readonly records = input<Record<string, CkRecordInfo>>({});

  // --- Outputs ---
  readonly changeSetChange = output<EntityFormChangeSet>();
  readonly validChange = output<boolean>();
  readonly dirtyChange = output<boolean>();

  // --- Icons (node_modules imports are safe as field initialisers) ---
  protected readonly chevronDownIcon = chevronDownIcon;
  protected readonly chevronRightIcon = chevronRightIcon;
  /** Stable empty list for reference fields without display attributes. */
  protected readonly noDisplayAttributes: readonly string[] = [];

  // --- State ---
  protected readonly resolvedMessages = computed(() => mergeEntityFormsMessages(this.messages()));
  protected readonly form = signal<FormGroup<Record<string, FormControl<unknown>>>>(new FormGroup({}));
  /** Bumped on every form event so OnPush children re-evaluate errors. */
  protected readonly revision = signal(0);
  /** Raw values (disabled controls included) for VisibleWhen evaluation. */
  private readonly rawValues = signal<Record<string, unknown>>({});
  private readonly collapsed = signal<ReadonlySet<string>>(new Set<string>());
  /** attributeNames of secrets whose clear is staged for the next save (Q8). */
  private readonly clearedSecrets = signal<ReadonlySet<string>>(new Set<string>());
  /** Value snapshot taken when the form was built (D6 baseline). */
  private initialValues: Record<string, unknown> = {};
  private formSub?: Subscription;
  private lastValid?: boolean;
  private lastDirty?: boolean;

  protected readonly secretPresence = computed<Record<string, boolean>>(() => this.state()?.secretPresence ?? {});
  protected readonly formReadOnly = computed(() => isFormReadOnly(this.model(), this.mode(), this.readOnly()));
  /** No key ring in this environment (Q17): secret inputs are disabled with a hint. */
  protected readonly secretWritesDisabled = computed(() => this.keyRingConfigured?.() === false);

  /** Visibility per field key, from VisibleWhen and the current raw values. */
  protected readonly visibility = computed<Record<string, boolean>>(() => {
    const values = this.rawValues();
    const presence = this.secretPresence();
    const fields = allFields(this.model());
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const result: Record<string, boolean> = {};
    for (const f of fields) {
      const source = f.visibleWhen ? byKey.get(f.visibleWhen.path) : undefined;
      result[f.key] = isVisible(f.visibleWhen, values, presence, source?.enumOptions);
    }
    return result;
  });

  /** Default item of optional enum dropdowns. */
  protected readonly enumDefaultItem = computed(() => ({ key: null, name: this.resolvedMessages().enumPlaceholder }));

  constructor() {
    effect(() => {
      const model = this.model();
      const mode = this.mode();
      const state = this.state();
      const readOnly = this.readOnly();
      untracked(() => this.rebuild(model, mode, state ?? null, readOnly));
    });
    this.destroyRef.onDestroy(() => this.formSub?.unsubscribe());
  }

  // --- Public API ---

  /** Change set of the current values (only dirty controls on edit). */
  getChangeSet(): EntityFormChangeSet {
    const mode = this.mode();
    const changeSet = buildChangeSet(
      this.initialValues,
      this.enabledValues(),
      this.model(),
      mode,
      this.secretPresence(),
      { records: this.records(), clearedSecrets: this.clearedSecrets() },
    );
    // A host-prefilled well-known name (singleton create) is carried even when its field is
    // read-only or not part of the form.
    const prefilled = this.state()?.rtWellKnownName;
    if (mode === 'create' && !changeSet.rtWellKnownName && typeof prefilled === 'string' && prefilled.trim()) {
      changeSet.rtWellKnownName = prefilled.trim();
      changeSet.isEmpty = false;
    }
    return changeSet;
  }

  /** True when any editable, visible control differs from the value it was built with. */
  isDirty(): boolean {
    if (this.clearedSecrets().size > 0) {
      return true;
    }
    const current = this.enabledValues();
    return Object.keys(current).some((k) => !formValuesEqual(this.initialValues[k], current[k]));
  }

  /** True when every enabled control is valid. */
  isValid(): boolean {
    const form = this.form();
    return form.valid || form.disabled;
  }

  /** Marks every control as touched so validation errors become visible. */
  markAllAsTouched(): void {
    this.form().markAllAsTouched();
    this.bump();
  }

  /** Rebuilds the form from the current inputs, discarding user edits. */
  reset(): void {
    this.rebuild(this.model(), this.mode(), this.state() ?? null, this.readOnly());
  }

  // --- Template helpers ---

  protected control(key: string): FormControl<unknown> {
    return this.form().controls[key];
  }

  protected isFieldVisible(field: ResolvedField): boolean {
    return this.visibility()[field.key] !== false;
  }

  protected visibleFieldCount(section: ResolvedSection): number {
    const vis = this.visibility();
    return section.fields.filter((f) => vis[f.key] !== false).length;
  }

  protected isCollapsed(section: ResolvedSection): boolean {
    return !!section.title && this.collapsed().has(section.key);
  }

  protected toggleSection(section: ResolvedSection): void {
    const next = new Set(this.collapsed());
    if (next.has(section.key)) {
      next.delete(section.key);
    } else {
      next.add(section.key);
    }
    this.collapsed.set(next);
  }

  protected isReadOnly(field: ResolvedField): boolean {
    return isFieldReadOnly(field, this.mode(), this.formReadOnly());
  }

  protected isRequired(field: ResolvedField): boolean {
    return field.secret ? isSecretRequired(field, this.mode(), this.secretPresence()) : field.required;
  }

  protected secretState(field: ResolvedField): EntityFormSecretState {
    if (!field.secret || this.mode() === 'create') {
      return null;
    }
    const name = field.attributeName ?? field.key;
    if (this.clearedSecrets().has(name)) {
      return 'clearStaged';
    }
    const state = this.state()?.secretStates?.[name];
    if (state?.keyMissing) {
      return 'keyMissing';
    }
    return (state ? state.isSet : this.secretPresence()[name]) ? 'set' : 'notSet';
  }

  protected secretSetAt(field: ResolvedField): Date | null {
    return this.state()?.secretStates?.[field.attributeName ?? field.key]?.setAt ?? null;
  }

  /**
   * "Clear" is offered for an optional SECRET (only SECRET attributes accept
   * `clearSecretAttributes`) that holds a value (set or key missing), in edit mode, when the field
   * is writable. Required secrets cannot be cleared (Q8).
   */
  protected canClearSecret(field: ResolvedField): boolean {
    if (!field.secret || field.required || this.mode() !== 'edit' || !isSecretValueType(field.valueType)) {
      return false;
    }
    if (isFieldReadOnly(field, this.mode(), this.formReadOnly())) {
      return false;
    }
    const state = this.secretState(field);
    return state === 'set' || state === 'keyMissing' || state === 'clearStaged';
  }

  protected isSecretClearStaged(field: ResolvedField): boolean {
    return this.clearedSecrets().has(field.attributeName ?? field.key);
  }

  /** Stages or undoes clearing a secret; a staged clear empties and disables the input. */
  protected setSecretClearStaged(field: ResolvedField, staged: boolean): void {
    const name = field.attributeName ?? field.key;
    const next = new Set(this.clearedSecrets());
    if (staged) {
      next.add(name);
      this.control(field.key)?.setValue(null, { emitEvent: false });
    } else {
      next.delete(name);
    }
    this.clearedSecrets.set(next);
    this.applyVisibility();
    this.bump();
    this.emitState();
  }

  protected placeholder(field: ResolvedField): string {
    const state = this.secretState(field);
    if (state === 'set' || state === 'keyMissing') {
      return this.resolvedMessages().secretSetPlaceholder;
    }
    if (state === 'notSet') {
      return field.placeholder ?? this.resolvedMessages().secretNotSetPlaceholder;
    }
    return field.placeholder ?? '';
  }

  protected isIntegerField(field: ResolvedField): boolean {
    return INTEGER_TYPES.includes(field.valueType ?? '');
  }

  protected isIntArray(field: ResolvedField): boolean {
    return field.valueType === 'INT_ARRAY' || field.valueType === 'INTEGER_ARRAY';
  }

  protected displayUnsupported(field: ResolvedField): string {
    const value = this.control(field.key)?.value;
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  // --- Internals ---

  private rebuild(model: ResolvedEntityForm, mode: EntityFormMode, state: EntityFormValueState | null, readOnly: boolean): void {
    this.formSub?.unsubscribe();
    this.clearedSecrets.set(new Set<string>());
    const form = buildFormGroup(model, mode, { state, readOnly });
    this.normaliseAttributeReferences(model, form);
    this.form.set(form);
    this.collapsed.set(new Set(model.sections.filter((s) => s.collapsed && s.title).map((s) => s.key)));
    this.rawValues.set(form.getRawValue());
    this.applyVisibility();
    this.initialValues = cloneValue(form.getRawValue());
    this.lastValid = undefined;
    this.lastDirty = undefined;
    this.formSub = form.events.subscribe(() => this.onFormEvent());
    this.bump();
    this.emitState();
  }

  /** Attribute-held references store a bare rtId; the reference editor works with an array. */
  private normaliseAttributeReferences(model: ResolvedEntityForm, form: FormGroup<Record<string, FormControl<unknown>>>): void {
    for (const field of allFields(model)) {
      if (field.kind !== 'attribute' || field.editor !== 'reference') {
        continue;
      }
      const control = form.controls[field.key];
      const v = control?.value;
      if (typeof v === 'string' && v) {
        control.setValue([{ rtId: v, ckTypeId: field.reference?.targetCkTypeId ?? '', displayName: v }], { emitEvent: false });
      } else if (v === null || v === undefined) {
        control.setValue([], { emitEvent: false });
      }
    }
  }

  private onFormEvent(): void {
    const form = this.form();
    const raw = form.getRawValue();
    if (!formValuesEqual(raw, this.rawValues())) {
      this.rawValues.set(raw);
      this.applyVisibility();
    }
    this.bump();
    this.emitState();
  }

  /**
   * Enables/disables controls by visibility. A hidden field is always disabled; a visible field
   * is enabled unless it is read-only.
   */
  private applyVisibility(): void {
    const form = this.form();
    const vis = this.visibility();
    const mode = this.mode();
    const formReadOnly = this.formReadOnly();
    for (const field of allFields(this.model())) {
      const control = form.controls[field.key];
      if (!control) {
        continue;
      }
      const secretBlocked = field.secret
        && (this.secretWritesDisabled() || this.clearedSecrets().has(field.attributeName ?? field.key));
      const shouldEnable = vis[field.key] !== false && !isFieldReadOnly(field, mode, formReadOnly) && !secretBlocked;
      if (shouldEnable && control.disabled) {
        control.enable({ emitEvent: false });
      } else if (!shouldEnable && control.enabled) {
        control.disable({ emitEvent: false });
      }
    }
  }

  /** Values of enabled controls only (hidden and read-only fields are absent). */
  private enabledValues(): Record<string, unknown> {
    const form = this.form();
    const out: Record<string, unknown> = {};
    for (const [key, control] of Object.entries(form.controls)) {
      if (control.enabled) {
        out[key] = control.value;
      }
    }
    return out;
  }

  private emitState(): void {
    const valid = this.isValid();
    const dirty = this.isDirty();
    if (valid !== this.lastValid) {
      this.lastValid = valid;
      this.validChange.emit(valid);
    }
    if (dirty !== this.lastDirty) {
      this.lastDirty = dirty;
      this.dirtyChange.emit(dirty);
    }
    this.changeSetChange.emit(this.getChangeSet());
  }

  private bump(): void {
    this.revision.update((r) => r + 1);
  }
}
