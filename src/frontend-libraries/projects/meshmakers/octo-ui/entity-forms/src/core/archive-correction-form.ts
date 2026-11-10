import { EntityFormDefinition } from '../models/entity-form.models';

/**
 * Reserved `Category` of archive correction forms (AB#8591): a `System.UI/EntityForm` that
 * describes the editable data columns of one stream-data archive, not the entity of its target
 * type. Such forms are never picked as the form of a type ({@link pickEntityForm}) and never
 * appear in the settings catalog ({@link entityFormCatalog}).
 */
export const ARCHIVE_CORRECTION_FORM_CATEGORY = 'ArchiveCorrection';

/** Prefix of the well-known name of an archive correction form: `archive-correction-{archiveKey}`. */
export const ARCHIVE_CORRECTION_FORM_NAME_PREFIX = 'archive-correction-';

/** True when the form's `Category` is {@link ARCHIVE_CORRECTION_FORM_CATEGORY} (any casing, trimmed). */
export function isArchiveCorrectionForm(form: Pick<EntityFormDefinition, 'category'>): boolean {
  return (form.category ?? '').trim().toLowerCase() === ARCHIVE_CORRECTION_FORM_CATEGORY.toLowerCase();
}

/**
 * Well-known name of the correction form of an archive: `archive-correction-{archiveKey}`, lower
 * case. `archiveKey` is the archive's `rtWellKnownName`, or its rtId when it has none.
 */
export function archiveCorrectionFormName(archiveKey: string): string {
  return `${ARCHIVE_CORRECTION_FORM_NAME_PREFIX}${archiveKey.trim().toLowerCase()}`;
}

/**
 * True when `wellKnownName` names a correction form of the archive: exactly
 * {@link archiveCorrectionFormName} or that name followed by `-` and a suffix
 * (`archive-correction-meter-consumption-custom`, a tenant override). Case-insensitive.
 */
export function matchesArchiveCorrectionFormName(wellKnownName: string | null | undefined, archiveKey: string): boolean {
  if (archiveKey.trim() === '') {
    return false;
  }
  const name = (wellKnownName ?? '').trim().toLowerCase();
  const expected = archiveCorrectionFormName(archiveKey);
  return name === expected || name.startsWith(`${expected}-`);
}
