import { EntityFormDefinition } from '../models/entity-form.models';

/**
 * Built-in copy of the seeded `form-default` (platform-services
 * `SystemUiCkModel/Blueprints/System.UI.EntityForms/seed-data/entities.yaml`, rtId
 * 670300000000000000000001), transcribed field by field.
 *
 * Used when a tenant has no applicable form at all: System.UI < 2.7.0 (no EntityForm type), the
 * forms query failed, or `form-default` was deleted. Keep it in step with the seed; a spec asserts
 * that it resolves exactly like the parsed seed entity.
 */
export const BUILT_IN_DEFAULT_FORM: EntityFormDefinition = {
  rtId: '',
  rtWellKnownName: 'form-default',
  isTenantForm: false,
  name: 'Default form',
  description: 'Fallback form for every entity type without a form of its own. Seeded by platform-services; create a tenant EntityForm for a type to override it.',
  targetCkTypeId: 'System/Entity',
  includeDerivedTypes: true,
  priority: 0,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canDuplicate: false,
  canExport: true,
  generateRemainingFields: true,
  generatedSectionTitle: 'Attributes',
  sections: [
    { key: 'general', title: 'General', order: 0, columns: 2 },
    {
      key: 'system',
      title: 'System',
      description: 'Blueprint provenance stamped by the engine when a blueprint seeded this entity.',
      order: 99,
      collapsed: true,
    },
  ],
  fields: [
    {
      attributePath: 'rtWellKnownName',
      sectionKey: 'general',
      order: 0,
      label: 'Well-known name',
      help: 'Stable, tenant-unique handle other entities, pipelines and the Studio use to find this entity. Cannot be changed after creation.',
      readOnly: 'afterCreate',
    },
    { attributePath: 'Name', sectionKey: 'general', order: 1, width: 'half' },
    { attributePath: 'Description', sectionKey: 'general', order: 2, editor: 'multiline' },
    {
      attributePath: 'RtBlueprintSource',
      sectionKey: 'system',
      order: 0,
      label: 'Blueprint source',
      help: 'Blueprint that seeded this entity.',
      readOnly: 'always',
    },
    {
      attributePath: 'RtBlueprintLocked',
      sectionKey: 'system',
      order: 1,
      label: 'Blueprint locked',
      help: 'Whether the blueprint still manages this entity (a re-apply overwrites it); false keeps it as user data.',
      readOnly: 'always',
    },
    {
      attributePath: 'RtBlueprintAppliedAt',
      sectionKey: 'system',
      order: 2,
      label: 'Blueprint applied at',
      help: 'When the blueprint last wrote this entity.',
      readOnly: 'always',
    },
  ],
  listColumns: [
    { attributePath: 'rtWellKnownName', label: 'Name' },
    { attributePath: 'Name' },
    { attributePath: 'rtChangedDateTime', label: 'Changed', display: 'date' },
  ],
};
