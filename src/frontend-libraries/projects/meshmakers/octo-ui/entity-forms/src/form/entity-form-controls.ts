import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  EntityFormEditor,
  EntityFormMode,
  EntityFormValueState,
  ResolvedEntityForm,
  ResolvedField,
} from '../models/entity-form.models';

/** Editors whose value is free text (the `pattern` validator applies to these). */
const TEXT_LIKE_EDITORS: readonly EntityFormEditor[] = [
  'text', 'multiline', 'password', 'url', 'email', 'json', 'yaml', 'cron',
];

/** Options of {@link buildFormGroup}. */
export interface EntityFormGroupOptions {
  /** Loaded values (edit / view). Absent in create mode unless the host prefills (singleton). */
  state?: EntityFormValueState | null;
  /** Everything read-only (host `readOnly` input or `capabilities.canEdit === false` in edit mode). */
  readOnly?: boolean;
}

/** All fields of a resolved form in section order. */
export function allFields(model: ResolvedEntityForm): ResolvedField[] {
  return model.sections.flatMap((s) => s.fields);
}

/** True when a field is a text-like editor. */
export function isTextLikeEditor(editor: EntityFormEditor): boolean {
  return TEXT_LIKE_EDITORS.includes(editor);
}

/**
 * True when the whole form is read-only: `view` mode, the host `readOnly` input, or an edit
 * form whose definition says `canEdit: false`.
 */
export function isFormReadOnly(model: ResolvedEntityForm, mode: EntityFormMode, readOnly: boolean): boolean {
  return readOnly || mode === 'view' || (mode === 'edit' && !model.capabilities.canEdit);
}

/**
 * Read-only rule of one field. `afterCreate` is editable only in create mode; `always` and the
 * `unsupported` editor are never editable.
 */
export function isFieldReadOnly(field: ResolvedField, mode: EntityFormMode, formReadOnly: boolean): boolean {
  if (formReadOnly || mode === 'view') {
    return true;
  }
  if (field.editor === 'unsupported' || field.readOnly === 'always') {
    return true;
  }
  return field.readOnly === 'afterCreate' && mode !== 'create';
}

/**
 * Whether a secret field is required right now: only on create, or when the server has no
 * value yet (D5.5). A set secret may be left empty ("keep").
 */
export function isSecretRequired(field: ResolvedField, mode: EntityFormMode, secretPresence: Record<string, boolean>): boolean {
  if (!field.required) {
    return false;
  }
  if (mode === 'create') {
    return true;
  }
  return !secretPresence[field.attributeName ?? field.key];
}

/** Empty form value of a field (never `undefined`). */
export function emptyValue(field: ResolvedField): unknown {
  switch (field.editor) {
    case 'toggle':
      return false;
    case 'chips':
    case 'reference':
    case 'records':
      return [];
    default:
      return null;
  }
}

/**
 * Initial form value of a field.
 * - Secrets are never prefilled (D5).
 * - Associations come from `state.associations` keyed by the field key (fallback: rtRoleId).
 * - In create mode a value from `state` (host prefill) wins over the field default.
 */
export function initialValue(field: ResolvedField, mode: EntityFormMode, state?: EntityFormValueState | null): unknown {
  if (field.secret) {
    return null;
  }
  let value: unknown;
  if (field.kind === 'association') {
    const role = field.reference?.role?.rtRoleId;
    value = state?.associations?.[field.key] ?? (role ? state?.associations?.[role] : undefined);
    value = Array.isArray(value) ? value.map((v) => ({ ...v })) : undefined;
  } else if (field.kind === 'system') {
    value = field.key === 'rtWellKnownName' ? state?.rtWellKnownName : state?.values?.[field.key];
  } else {
    value = state?.values?.[field.key];
  }
  if ((value === undefined || value === null) && mode === 'create' && field.defaultValue !== undefined) {
    value = field.defaultValue;
  }
  if (value === undefined || value === null) {
    return emptyValue(field);
  }
  return cloneValue(value);
}

/** Validator: value must parse as JSON (empty passes; `required` handles emptiness). */
export function jsonValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      return null;
    }
    if (typeof v !== 'string') {
      return null;
    }
    try {
      JSON.parse(v);
      return null;
    } catch {
      return { json: true };
    }
  };
}

/** Validator: value must be an absolute URL with a scheme (`https://…`, `sftp://…`, `oci://…`). */
export function urlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      return null;
    }
    const s = String(v).trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(s)) {
      return { url: true };
    }
    try {
      new URL(s);
      return null;
    } catch {
      return { url: true };
    }
  };
}

/**
 * Validator for `pattern`. The expression is anchored like Angular's `Validators.pattern`; an
 * invalid expression is ignored (a broken form definition must not block saving).
 */
export function safePatternValidator(pattern: string): ValidatorFn | null {
  try {
    new RegExp(pattern);
  } catch {
    return null;
  }
  return Validators.pattern(pattern);
}

/** Validators of one field for the given mode. */
export function buildValidators(field: ResolvedField, mode: EntityFormMode, secretPresence: Record<string, boolean> = {}): ValidatorFn[] {
  const validators: ValidatorFn[] = [];
  const required = field.secret ? isSecretRequired(field, mode, secretPresence) : field.required;
  // A toggle always holds true/false, so "required" is trivially met.
  if (required && field.editor !== 'toggle') {
    validators.push(Validators.required);
  }
  if (field.editor === 'number') {
    if (typeof field.min === 'number') {
      validators.push(Validators.min(field.min));
    }
    if (typeof field.max === 'number') {
      validators.push(Validators.max(field.max));
    }
  }
  if (field.pattern && isTextLikeEditor(field.editor)) {
    const p = safePatternValidator(field.pattern);
    if (p) {
      validators.push(p);
    }
  }
  if (field.editor === 'email') {
    validators.push(Validators.email);
  }
  if (field.editor === 'url') {
    validators.push(urlValidator());
  }
  if (field.editor === 'json') {
    validators.push(jsonValidator());
  }
  return validators;
}

/**
 * Builds the reactive form group of a resolved form: one control per field, keyed by
 * `ResolvedField.key`. Read-only fields start disabled, so they never block validity and are
 * easy to tell apart from editable ones. Visibility (VisibleWhen) is applied afterwards by the
 * component, because it depends on live values.
 */
export function buildFormGroup(
  model: ResolvedEntityForm,
  mode: EntityFormMode,
  options: EntityFormGroupOptions = {},
): FormGroup<Record<string, FormControl<unknown>>> {
  const state = options.state ?? null;
  const formReadOnly = isFormReadOnly(model, mode, options.readOnly ?? false);
  const secretPresence = state?.secretPresence ?? {};
  const controls: Record<string, FormControl<unknown>> = {};
  for (const field of allFields(model)) {
    if (controls[field.key]) {
      continue;
    }
    const disabled = isFieldReadOnly(field, mode, formReadOnly);
    controls[field.key] = new FormControl<unknown>(
      { value: initialValue(field, mode, state), disabled },
      { validators: buildValidators(field, mode, secretPresence) },
    );
  }
  return new FormGroup(controls);
}

/** Error message key of the first error of a control, in a stable priority order. */
export function firstErrorKey(errors: ValidationErrors | null | undefined): string | null {
  if (!errors) {
    return null;
  }
  const order = ['required', 'min', 'max', 'pattern', 'email', 'url', 'json'];
  return order.find((k) => k in errors) ?? Object.keys(errors)[0] ?? null;
}

/** Deep copy of plain form values (arrays, plain objects, Dates). */
export function cloneValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => cloneValue(v)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = cloneValue(v);
    }
    return out as T;
  }
  return value;
}
