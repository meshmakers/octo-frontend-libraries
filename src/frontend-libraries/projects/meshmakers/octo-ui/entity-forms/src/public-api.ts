/*
 * Public API Surface of @meshmakers/octo-ui/entity-forms (AB#5522)
 *
 * Form-driven list / create / edit pages for runtime entities, configured by the tenant's
 * System.UI/EntityForm definitions (with a built-in default form as fallback). Lives in its own
 * secondary entry point so hosts that do not render entity forms keep the primary
 * `@meshmakers/octo-ui` bundle unchanged. See ../README.md.
 */

// --- Contract types and messages ---
export * from './models/entity-form.models';
export * from './entity-forms.messages';

// --- Services ---
export * from './services/entity-form.service';
export * from './services/entity-form-data.service';

// --- Components ---
export * from './form/entity-form.component';
export { EntityFormReferenceFieldComponent } from './form/reference/entity-form-reference-field.component';
export { EntityFormRecordsFieldComponent } from './form/records/entity-form-records-field.component';
export type { EntityFormRecordColumn } from './form/records/entity-form-records-field.component';
export * from './list/entity-list.component';
export * from './list/entity-list-data-source.directive';
export * from './page/entity-page.component';

// --- Routes ---
export * from './page/entity-page.routes';

// --- Pure functions (form parsing / resolution, reusable by hosts such as the Studio) ---
export { parseEntityForm, parseEntityForms } from './core/entity-form-parser';
export type { RawRtEntityRow } from './core/entity-form-parser';
export {
  pickEntityForm,
  resolveEntityForm,
  autoEditorFor,
  isEditorCompatible,
  DEFAULT_SECTION_KEY,
  GENERATED_SECTION_KEY,
  DEFAULT_GENERATED_SECTION_TITLE,
} from './core/entity-form-resolver';
export type { EntityFormSource, ResolveEntityFormOptions } from './core/entity-form-resolver';
export { entityFormCatalog, entityFormKey } from './core/entity-form-catalog';
export type { EntityFormCatalogEntry } from './core/entity-form-catalog';
export { BUILT_IN_DEFAULT_FORM } from './core/built-in-default-form';
export { ENTITY_FORM_FALLBACK_FORMS, withFallbackForms, selectFallbackForms, isChainEndForm } from './core/fallback-forms';
export { ENTITY_FORM_ACTION_CONFIRMATION, confirmEntityFormAction } from './core/action-confirmation';
export type { EntityFormActionConfirmation, EntityFormActionRequest } from './core/action-confirmation';
export { canonicalisePath, SYSTEM_PROPERTIES, toKebabTypeKey } from './core/attribute-path';
export type { CanonicalPath } from './core/attribute-path';
export { parseVisibleWhen, isVisible } from './core/visible-when';
export { toFormValue, toAttributeInputs, parseDefault } from './core/entity-form-value-mapper';
export { buildChangeSet, associationRoleName } from './core/change-set-builder';
export type { BuildChangeSetOptions, EntityFormReferenceValue } from './core/change-set-builder';
export { toCkTypeInfo, toCkRecordInfo, isSecretMetaData } from './core/ck-metadata';
