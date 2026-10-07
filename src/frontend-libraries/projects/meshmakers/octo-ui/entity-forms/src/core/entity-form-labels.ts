import { InjectionToken } from '@angular/core';
import {
  CkAttributeInfo,
  ResolvedEntityForm,
  ResolvedField,
  ResolvedListColumn,
  ResolvedSection,
} from '../models/entity-form.models';

/**
 * What a label belongs to (AB#5623):
 * - `formTitle` / `formDescription` — the form's name and description (`key` = the form key, else
 *   the runtime CK type id);
 * - `section` / `sectionDescription` — a section title / description (`key` = section key);
 * - `field` / `help` / `placeholder` — a field's label, help text and placeholder
 *   (`key` = the field key: camelCase attribute name, `rtWellKnownName` or `assoc:<role>`);
 * - `listColumn` — a list column title (`key` = the column field);
 * - `recordColumn` — a column of a record grid (`key` = the record sub-attribute path,
 *   `attributeName` = the record attribute);
 * - `enumOption` — the display text of an enum value (`key` = the enum value name, `enumKey` = its
 *   numeric key, `attributeName` = the ENUM attribute).
 */
export type EntityFormLabelKind =
  | 'formTitle'
  | 'formDescription'
  | 'section'
  | 'sectionDescription'
  | 'field'
  | 'help'
  | 'placeholder'
  | 'listColumn'
  | 'recordColumn'
  | 'enumOption';

/** One label lookup of {@link EntityFormLabelResolver}. */
export interface EntityFormLabelRequest {
  kind: EntityFormLabelKind;
  /**
   * Runtime CK type the label belongs to (`Basic.Accounting/BankAccount`). For enum options of a
   * reference display attribute this is the reference target type.
   */
  rtCkTypeId: string;
  /** Well-known name (else rtId) of the form definition, when the form came from one. */
  formKey?: string;
  /** See {@link EntityFormLabelKind}. */
  key: string;
  /** The attribute an `enumOption` / `recordColumn` belongs to (camelCase). */
  attributeName?: string;
  /** Numeric key of an `enumOption`. */
  enumKey?: number;
  /** The text shown without a resolver (form definition text, else derived from the CK model). */
  defaultText: string;
}

/**
 * Host hook that translates the texts of an entity form (AB#5623): field labels, help texts,
 * placeholders, section titles, form title, list column titles, record columns and enum option
 * texts. Return `null`, `undefined` or `''` to keep {@link EntityFormLabelRequest.defaultText}.
 *
 * The resolver is called inside Angular `computed`s: when it reads a signal (e.g. the current
 * language), the forms re-render on a change of that signal. A resolver that reads no signal is
 * evaluated once per model; pass a new function to the `labelResolver` input to refresh it.
 * A language change never rebuilds the form controls, so unsaved edits are kept.
 *
 * Fixed UI texts (buttons, notifications, validation messages) are translated with the `messages`
 * input ({@link EntityFormsMessages}), not with this hook.
 */
export type EntityFormLabelResolver = (request: EntityFormLabelRequest) => string | null | undefined;

/**
 * App-wide {@link EntityFormLabelResolver} for `mm-entity-form`, `mm-entity-list` and
 * `mm-entity-page`. Their `labelResolver` input wins over this token. Not provided = the texts of
 * the form definition / CK model are shown unchanged (today's behaviour).
 */
export const ENTITY_FORM_LABEL_RESOLVER = new InjectionToken<EntityFormLabelResolver>('ENTITY_FORM_LABEL_RESOLVER');

/** Resolvers that already threw (warned once each, not once per label). */
const failedResolvers = new WeakSet<EntityFormLabelResolver>();

/**
 * Resolves one label; falls back to the default text when there is no resolver, no translation,
 * or the resolver throws (logged once per resolver with `console.warn`).
 */
export function resolveEntityFormLabel(
  resolver: EntityFormLabelResolver | null | undefined,
  request: EntityFormLabelRequest,
): string {
  if (!resolver) {
    return request.defaultText;
  }
  let text: string | null | undefined;
  try {
    text = resolver(request);
  } catch (error) {
    if (!failedResolvers.has(resolver)) {
      failedResolvers.add(resolver);
      console.warn('entity-forms: the label resolver threw; showing the default texts', error);
    }
    return request.defaultText;
  }
  return typeof text === 'string' && text !== '' ? text : request.defaultText;
}

interface LabelContext {
  resolver: EntityFormLabelResolver;
  rtCkTypeId: string;
  formKey?: string;
}

function contextOf(model: ResolvedEntityForm, resolver: EntityFormLabelResolver): LabelContext {
  const formKey = model.formWellKnownName ?? model.formRtId;
  return { resolver, rtCkTypeId: model.rtCkTypeId, ...(formKey ? { formKey } : {}) };
}

function label(ctx: LabelContext, kind: EntityFormLabelKind, key: string, defaultText: string, extra: Partial<EntityFormLabelRequest> = {}): string {
  return resolveEntityFormLabel(ctx.resolver, {
    kind,
    rtCkTypeId: ctx.rtCkTypeId,
    ...(ctx.formKey ? { formKey: ctx.formKey } : {}),
    key,
    defaultText,
    ...extra,
  });
}

function localizeEnumOptions(
  ctx: LabelContext,
  attributeName: string | undefined,
  options: { key: number; name: string }[] | undefined,
): { key: number; name: string }[] | undefined {
  if (!options) {
    return options;
  }
  return options.map((o) => ({
    key: o.key,
    name: label(ctx, 'enumOption', o.name, o.name, { enumKey: o.key, ...(attributeName ? { attributeName } : {}) }),
  }));
}

function localizeAttributeInfo(ctx: LabelContext, info: CkAttributeInfo[] | undefined): CkAttributeInfo[] | undefined {
  if (!info) {
    return info;
  }
  return info.map((a) => (a.enumOptions?.length
    ? { ...a, enumOptions: localizeEnumOptions(ctx, a.attributeName, a.enumOptions) }
    : a));
}

function localizeField(ctx: LabelContext, field: ResolvedField): ResolvedField {
  const out: ResolvedField = { ...field, label: label(ctx, 'field', field.key, field.label) };
  if (field.help !== undefined) {
    out.help = label(ctx, 'help', field.key, field.help);
  }
  if (field.placeholder !== undefined) {
    out.placeholder = label(ctx, 'placeholder', field.key, field.placeholder);
  }
  if (field.enumOptions) {
    out.enumOptions = localizeEnumOptions(ctx, field.attributeName ?? field.key, field.enumOptions);
  }
  if (field.record) {
    out.record = {
      ...field.record,
      columns: field.record.columns.map((c) => ({
        path: c.path,
        label: label(ctx, 'recordColumn', c.path, c.label, { attributeName: field.attributeName ?? field.key }),
      })),
    };
  }
  if (field.reference?.displayAttributeInfo?.length) {
    const targetCtx: LabelContext = { resolver: ctx.resolver, rtCkTypeId: field.reference.targetCkTypeId };
    out.reference = { ...field.reference, displayAttributeInfo: localizeAttributeInfo(targetCtx, field.reference.displayAttributeInfo) };
  }
  return out;
}

function localizeSection(ctx: LabelContext, section: ResolvedSection): ResolvedSection {
  const out: ResolvedSection = {
    ...section,
    title: section.title === null ? null : label(ctx, 'section', section.key, section.title),
    fields: section.fields.map((f) => localizeField(ctx, f)),
  };
  if (section.description !== undefined) {
    out.description = label(ctx, 'sectionDescription', section.key, section.description);
  }
  return out;
}

/** The list columns of a model with translated titles and enum texts (unchanged without a resolver). */
export function localizeEntityListColumns(
  model: ResolvedEntityForm,
  resolver: EntityFormLabelResolver | null | undefined,
): ResolvedListColumn[] {
  if (!resolver) {
    return model.listColumns;
  }
  const ctx = contextOf(model, resolver);
  return model.listColumns.map((c) => {
    const out: ResolvedListColumn = { ...c, label: label(ctx, 'listColumn', c.field, c.label) };
    if (c.enumOptions) {
      out.enumOptions = localizeEnumOptions(ctx, c.field, c.enumOptions);
    }
    return out;
  });
}

/** Translated form title (unchanged without a resolver). */
export function localizeEntityFormTitle(model: ResolvedEntityForm, resolver: EntityFormLabelResolver | null | undefined): string {
  return resolver ? label(contextOf(model, resolver), 'formTitle', model.formWellKnownName ?? model.formRtId ?? model.rtCkTypeId, model.title) : model.title;
}

/**
 * A copy of a resolved form with every display text passed through the resolver (AB#5623). Keys,
 * attribute names and enum keys are unchanged, so form controls, change sets and queries are not
 * affected. Returns the model itself when there is no resolver.
 */
export function localizeEntityForm(
  model: ResolvedEntityForm,
  resolver: EntityFormLabelResolver | null | undefined,
): ResolvedEntityForm {
  if (!resolver) {
    return model;
  }
  const ctx = contextOf(model, resolver);
  const out: ResolvedEntityForm = {
    ...model,
    title: localizeEntityFormTitle(model, resolver),
    sections: model.sections.map((s) => localizeSection(ctx, s)),
    listColumns: localizeEntityListColumns(model, resolver),
  };
  if (model.description !== undefined) {
    out.description = label(ctx, 'formDescription', model.formWellKnownName ?? model.formRtId ?? model.rtCkTypeId, model.description);
  }
  return out;
}
