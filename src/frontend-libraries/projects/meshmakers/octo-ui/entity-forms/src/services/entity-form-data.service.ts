import { Injectable, inject } from '@angular/core';
import {
  AssociationModOptionsDto,
  DeleteStrategiesDto,
  FieldFilterDto,
  FieldFilterOperatorsDto,
  GraphDirectionDto,
  RtEntityInputDto,
  RtEntityUpdateDto,
  isSecretPresent,
  secretStateFromAttribute,
} from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { toFormValue } from '../core/entity-form-value-mapper';
import { EntityFormCreateEntitiesDtoGQL } from '../graphQL/createEntityFormEntities';
import { EntityFormDeleteEntitiesDtoGQL } from '../graphQL/deleteEntityFormEntities';
import { EntityFormGetAttributePresenceDtoGQL } from '../graphQL/getEntityAttributePresence';
import { EntityFormGetAssociationDefinitionsDtoGQL } from '../graphQL/getEntityFormAssociationDefinitions';
import { EntityFormGetAssociationTargetsDtoGQL } from '../graphQL/getEntityFormAssociationTargets';
import { EntityFormGetListDtoGQL } from '../graphQL/getEntityFormList';
import { EntityFormGetReferenceOptionsDtoGQL } from '../graphQL/getEntityFormReferenceOptions';
import { EntityFormGetValuesDtoGQL } from '../graphQL/getEntityFormValues';
import { EntityFormUpdateEntitiesDtoGQL } from '../graphQL/updateEntityFormEntities';
import {
  CkRecordInfo,
  EntityFormChangeSet,
  EntityFormSecretFieldState,
  EntityFormValueState,
  ResolvedEntityForm,
  ResolvedField,
} from '../models/entity-form.models';
import { EntityFormService } from './entity-form.service';
import { nameAttributeOf, referenceDisplayName } from '../form/reference/entity-reference-data-source';

/** How to find the entity to load. `ckTypeId` defaults to the form's type (derived types match). */
export type EntityFormLoadKey =
  | { rtId: string; ckTypeId?: string }
  | { wellKnownName: string; ckTypeId?: string };

/** Result of {@link EntityFormDataService.load}. */
export interface EntityFormLoadResult {
  rtId: string;
  ckTypeId: string;
  rtDisplayName?: string | null;
  state: EntityFormValueState;
}

/** One selected reference / association target as held by a reference control. */
export interface EntityFormTargetRef {
  rtId: string;
  ckTypeId: string;
  displayName: string;
}

/**
 * Types whose `targets(ckId:)` query fails with "has no defining collection root" (verified live
 * for System/Entity). Associations whose other end is one of these are read through the
 * association definitions instead.
 */
const NO_COLLECTION_ROOT_TYPES: readonly string[] = ['System/Entity'];

/** Label of a target row: the shared reference rule (real display name > `name` > well-known name). */
function displayNameOf(item: { rtId: string; ckTypeId?: string | null; rtDisplayName?: string | null; rtWellKnownName?: string | null; attributes?: DisplayAttributeRows | null }): string {
  return referenceDisplayName({
    rtId: item.rtId,
    ckTypeId: item.ckTypeId ?? '',
    rtDisplayName: item.rtDisplayName,
    rtWellKnownName: item.rtWellKnownName,
    name: nameAttributeOf(item),
  });
}

interface DisplayAttributeRows { items?: ({ attributeName?: string | null; value?: unknown } | null)[] | null }

/**
 * Reads and writes entity values for the entity form (plan §2.3, rules D5/D6).
 *
 * SECURITY: values are read with an explicit `attributeNames` list (`model.readAttributeNames`
 * minus every secret, never omitted — omission returns every attribute). SECRET attributes
 * (AB#5528, `model.secretStateFields`) are listed too: the server returns `value: null` and
 * `secretIsSet`. Fallback secrets (credential name / metadata on non-SECRET attributes) are only
 * probed for presence (`IS_NOT_NULL` + `totalCount`). Mutations never select attributes; an
 * explicit clear goes through `clearSecretAttributes`.
 */
@Injectable({ providedIn: 'root' })
export class EntityFormDataService {
  private readonly valuesGql = inject(EntityFormGetValuesDtoGQL);
  private readonly presenceGql = inject(EntityFormGetAttributePresenceDtoGQL);
  private readonly targetsGql = inject(EntityFormGetAssociationTargetsDtoGQL);
  private readonly definitionsGql = inject(EntityFormGetAssociationDefinitionsDtoGQL);
  private readonly referenceOptionsGql = inject(EntityFormGetReferenceOptionsDtoGQL);
  private readonly createGql = inject(EntityFormCreateEntitiesDtoGQL);
  private readonly updateGql = inject(EntityFormUpdateEntitiesDtoGQL);
  private readonly deleteGql = inject(EntityFormDeleteEntitiesDtoGQL);
  private readonly listGql = inject(EntityFormGetListDtoGQL);
  private readonly formService = inject(EntityFormService);

  /**
   * The attribute names to read for a model: `readAttributeNames` with every secret removed except
   * the SECRET fields (`secretStateFields`, read for their state only). Always an array (an omitted
   * list would return secrets).
   */
  static readAttributeNamesFor(model: ResolvedEntityForm): string[] {
    const stateFields = new Set((model.secretStateFields ?? []).map((s) => s.toLowerCase()));
    const secrets = new Set(model.secretFields.map((s) => s.toLowerCase()));
    model.sections.flatMap((s) => s.fields).filter((f) => f.secret && f.attributeName)
      .forEach((f) => secrets.add((f.attributeName as string).toLowerCase()));
    return [...new Set(model.readAttributeNames ?? [])]
      .filter((n) => !secrets.has(n.toLowerCase()) || stateFields.has(n.toLowerCase()));
  }

  /**
   * Number of entities of a type (e.g. for a settings overview). Without `includeDerivedTypes`
   * only entities of exactly that type are counted (`runtimeEntities(ckId)` includes derived
   * types by default). Reads no attributes (`attributeNames: []`, never omitted).
   */
  async count(ckTypeId: string, includeDerivedTypes = false): Promise<number> {
    const fieldFilters: FieldFilterDto[] = includeDerivedTypes
      ? []
      : [{ attributePath: 'ckTypeId', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: ckTypeId }];
    const result = await firstValueFrom(
      this.listGql.fetch({
        variables: {
          ckTypeId,
          first: 1,
          fieldFilters: fieldFilters.length > 0 ? fieldFilters : null,
          attributeNames: [],
        },
        fetchPolicy: 'network-only',
      }),
    );
    return result.data?.runtime?.runtimeEntities?.totalCount ?? 0;
  }

  /** Loads values, secret presence and associations of one entity in parallel; `null` if not found. */
  async load(model: ResolvedEntityForm, key: EntityFormLoadKey): Promise<EntityFormLoadResult | null> {
    const ckTypeId = key.ckTypeId ?? model.rtCkTypeId;
    const fieldFilters: FieldFilterDto[] | undefined = 'wellKnownName' in key
      ? [{ attributePath: 'rtWellKnownName', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: key.wellKnownName }]
      : undefined;
    const fields = model.sections.flatMap((s) => s.fields);
    const recordsPromise = this.loadRecords(fields);

    const result = await firstValueFrom(this.valuesGql.fetch({
      variables: {
        ckTypeId,
        rtId: 'rtId' in key ? key.rtId : undefined,
        fieldFilters,
        attributeNames: EntityFormDataService.readAttributeNamesFor(model),
      },
      fetchPolicy: 'network-only',
    }));
    const entity = result.data?.runtime?.runtimeEntities?.items?.[0];
    if (!entity) {
      return null;
    }
    const rtId = entity.rtId as string;
    const entityCkTypeId = entity.ckTypeId as string;

    const raw = new Map<string, unknown>();
    const stateFields = model.secretStateFields ?? [];
    const secretStates: Record<string, EntityFormSecretFieldState> = {};
    for (const item of entity.attributes?.items ?? []) {
      if (item?.attributeName) {
        raw.set(item.attributeName.toLowerCase(), item.value);
        const stateField = stateFields.find((n) => n.toLowerCase() === item.attributeName?.toLowerCase());
        const state = stateField ? secretStateFromAttribute(item) : null;
        if (stateField && state) {
          secretStates[stateField] = state;
        }
      }
    }
    // A SECRET field the server did not report counts as not set.
    for (const name of stateFields) {
      secretStates[name] ??= { isSet: false, keyMissing: false, setAt: null };
    }
    const probed = model.secretFields.filter((n) => !stateFields.includes(n));

    const [records, probedPresence, associations] = await Promise.all([
      recordsPromise,
      this.loadSecretPresence(probed, entityCkTypeId, rtId, fields),
      this.loadAssociations(fields, entityCkTypeId, rtId),
    ]);
    const secretPresence: Record<string, boolean> = { ...probedPresence };
    for (const [name, state] of Object.entries(secretStates)) {
      secretPresence[name] = isSecretPresent(state);
    }

    const values: Record<string, unknown> = {};
    const attributeReferences: { field: ResolvedField; rtId: string }[] = [];
    for (const field of fields) {
      if (field.kind === 'system') {
        const v = field.key === 'rtWellKnownName' ? entity.rtWellKnownName
          : field.key === 'rtCreationDateTime' ? entity.rtCreationDateTime : entity.rtChangedDateTime;
        values[field.key] = field.key === 'rtWellKnownName' ? (v ?? null) : toFormValue(v, { attributeName: field.key, valueType: 'DATE_TIME', isOptional: true });
      } else if (field.kind === 'association') {
        values[field.key] = associations[field.key] ?? [];
      } else if (field.attributeName && !field.secret) {
        const rawValue = raw.get(field.attributeName.toLowerCase());
        if (field.editor === 'reference' && field.reference) {
          values[field.key] = [];
          if (typeof rawValue === 'string' && rawValue) {
            attributeReferences.push({ field, rtId: rawValue });
          }
          continue;
        }
        values[field.key] = toFormValue(rawValue, {
          attributeName: field.attributeName,
          valueType: field.valueType ?? 'STRING',
          isOptional: !field.required,
          enumOptions: field.enumOptions,
          ckRecordId: field.record?.ckRecordId,
        }, records);
      }
    }
    if (attributeReferences.length) {
      const named = await this.lookupDisplayNames(attributeReferences.map((r) => ({ rtId: r.rtId, ckTypeId: r.field.reference?.targetCkTypeId ?? '' })));
      for (const ref of attributeReferences) {
        values[ref.field.key] = [named.get(ref.rtId) ?? { rtId: ref.rtId, ckTypeId: ref.field.reference?.targetCkTypeId ?? '', displayName: ref.rtId }];
      }
    }

    return {
      rtId,
      ckTypeId: entityCkTypeId,
      rtDisplayName: entity.rtDisplayName,
      state: { values, secretPresence, secretStates, associations, rtWellKnownName: entity.rtWellKnownName ?? null },
    };
  }

  /** Creates an entity; returns its rtId. */
  async create(model: ResolvedEntityForm, ckTypeId: string, changeSet: EntityFormChangeSet): Promise<string> {
    const entity: RtEntityInputDto = {
      ckTypeId: ckTypeId || model.rtCkTypeId,
      attributes: changeSet.attributes,
    };
    if (changeSet.rtWellKnownName) {
      entity.rtWellKnownName = changeSet.rtWellKnownName;
    }
    if (changeSet.associations.length) {
      entity.associations = this.associationInputs(changeSet);
    }
    const result = await firstValueFrom(this.createGql.mutate({ variables: { entities: [entity] }, fetchPolicy: 'no-cache' }));
    const rtId = result.data?.runtime?.runtimeEntities?.create?.[0]?.rtId as string | undefined;
    if (!rtId) {
      throw new Error('EntityFormDataService: create returned no entity.');
    }
    return rtId;
  }

  /**
   * Updates an entity with exactly the change set (partial update: attributes that are not sent
   * keep their value — verified live, including the presence of secrets). `rtWellKnownName` is
   * never changed on update. Staged secret clears are sent as `clearSecretAttributes` (Q8).
   */
  async update(rtId: string, ckTypeId: string, changeSet: EntityFormChangeSet): Promise<void> {
    const item: RtEntityInputDto = { ckTypeId, attributes: changeSet.attributes };
    if (changeSet.associations.length) {
      item.associations = this.associationInputs(changeSet);
    }
    const entity: RtEntityUpdateDto = { rtId, item };
    if (changeSet.clearSecretAttributes?.length) {
      entity.clearSecretAttributes = changeSet.clearSecretAttributes;
    }
    await firstValueFrom(this.updateGql.mutate({ variables: { entities: [entity] }, fetchPolicy: 'no-cache' }));
  }

  /** Deletes entities (default strategy ARCHIVE). */
  async delete(entities: { rtId: string; ckTypeId: string }[], strategy: 'ARCHIVE' | 'ERASE' = 'ARCHIVE'): Promise<boolean> {
    if (!entities.length) {
      return true;
    }
    const result = await firstValueFrom(this.deleteGql.mutate({
      variables: {
        rtEntityIds: entities.map((e) => ({ rtId: e.rtId, ckTypeId: e.ckTypeId })),
        deleteStrategy: strategy === 'ERASE' ? DeleteStrategiesDto.EraseDto : DeleteStrategiesDto.ArchiveDto,
      },
      fetchPolicy: 'no-cache',
    }));
    return result.data?.runtime?.runtimeEntities?.delete === true;
  }

  private associationInputs(changeSet: EntityFormChangeSet): NonNullable<RtEntityInputDto['associations']> {
    return changeSet.associations.map((a) => ({
      roleName: a.roleName,
      targets: a.targets.map((t) => ({
        modOption: t.modOption === 'DELETE' ? AssociationModOptionsDto.DeleteDto : AssociationModOptionsDto.CreateDto,
        target: { ckTypeId: t.target.ckTypeId, rtId: t.target.rtId },
      })),
    }));
  }

  private async loadRecords(fields: ResolvedField[]): Promise<Record<string, CkRecordInfo>> {
    const ids = [...new Set(fields.map((f) => f.record?.ckRecordId).filter((id): id is string => !!id))];
    const records: Record<string, CkRecordInfo> = {};
    const pending = [...ids];
    const seen = new Set<string>();
    while (pending.length) {
      const batch = pending.splice(0).filter((id) => !seen.has(id));
      batch.forEach((id) => seen.add(id));
      const loaded = await Promise.all(batch.map((id) => this.formService.getCkRecord(id).catch(() => null)));
      for (const record of loaded) {
        if (record) {
          records[record.ckRecordId] = record;
          record.attributes.filter((a) => a.ckRecordId && !seen.has(a.ckRecordId)).forEach((a) => pending.push(a.ckRecordId as string));
        }
      }
    }
    return records;
  }

  /**
   * "Set / not set" per secret: not null AND — for STRING secrets — not the empty string (an empty
   * string is "no secret", AB#5524; same rule as the Studio's service account page).
   */
  private async loadSecretPresence(
    secretFields: string[],
    ckTypeId: string,
    rtId: string,
    fields: ResolvedField[] = [],
  ): Promise<Record<string, boolean>> {
    const entries = await Promise.all(secretFields.map(async (name) => {
      const valueType = fields.find((f) => f.attributeName === name)?.valueType ?? 'STRING';
      const fieldFilters = [
        { attributePath: name, operator: FieldFilterOperatorsDto.IsNotNullDto },
        ...(valueType === 'STRING' ? [{ attributePath: name, operator: FieldFilterOperatorsDto.NotEqualsDto, comparisonValue: '' }] : []),
      ];
      const result = await firstValueFrom(this.presenceGql.fetch({
        variables: { ckTypeId, rtId, fieldFilters },
        fetchPolicy: 'network-only',
      }));
      return [name, (result.data?.runtime?.runtimeEntities?.totalCount ?? 0) > 0] as const;
    }));
    return Object.fromEntries(entries);
  }

  private async loadAssociations(fields: ResolvedField[], ckTypeId: string, rtId: string): Promise<Record<string, EntityFormTargetRef[]>> {
    const assocFields = fields.filter((f) => f.kind === 'association' && f.reference?.role);
    const entries = await Promise.all(assocFields.map(async (field) => [field.key, await this.loadAssociationTargets(field, ckTypeId, rtId)] as const));
    return Object.fromEntries(entries);
  }

  private async loadAssociationTargets(field: ResolvedField, ckTypeId: string, rtId: string): Promise<EntityFormTargetRef[]> {
    const role = field.reference?.role;
    if (!role || !field.reference) {
      return [];
    }
    const direction = role.direction === 'out' ? GraphDirectionDto.OutboundDto : GraphDirectionDto.InboundDto;
    const targetCkTypeId = field.reference.targetCkTypeId;
    if (!NO_COLLECTION_ROOT_TYPES.includes(targetCkTypeId)) {
      try {
        const result = await firstValueFrom(this.targetsGql.fetch({
          variables: { ckTypeId, rtId, roleId: role.rtRoleId, targetCkTypeId, direction, first: 1000 },
          fetchPolicy: 'network-only',
        }));
        const items = result.data?.runtime?.runtimeEntities?.items?.[0]?.associations?.targets?.items ?? [];
        return items.filter((i): i is NonNullable<typeof i> => !!i).map((i) => ({
          rtId: i.rtId as string,
          ckTypeId: i.ckTypeId as string,
          displayName: displayNameOf(i as Parameters<typeof displayNameOf>[0]),
        }));
      } catch {
        // Fall through to the definitions-based read.
      }
    }
    const defs = await firstValueFrom(this.definitionsGql.fetch({
      variables: { ckTypeId, rtId, roleId: role.rtRoleId, direction, first: 1000 },
      fetchPolicy: 'network-only',
    }));
    const edges = defs.data?.runtime?.runtimeEntities?.items?.[0]?.associations?.definitions?.items ?? [];
    const refs = edges.filter((e): e is NonNullable<typeof e> => !!e).map((e) => role.direction === 'out'
      ? { rtId: e.targetRtId as string, ckTypeId: e.targetCkTypeId as string }
      : { rtId: e.originRtId as string, ckTypeId: e.originCkTypeId as string });
    const named = await this.lookupDisplayNames(refs);
    return refs.map((r) => named.get(r.rtId) ?? { ...r, displayName: r.rtId });
  }

  /** Display names for ids, grouped by type; selects only the `name` attribute (secret-safe). */
  private async lookupDisplayNames(refs: { rtId: string; ckTypeId: string }[]): Promise<Map<string, EntityFormTargetRef>> {
    const byType = new Map<string, string[]>();
    for (const r of refs) {
      if (!r.ckTypeId) {
        continue;
      }
      byType.set(r.ckTypeId, [...(byType.get(r.ckTypeId) ?? []), r.rtId]);
    }
    const named = new Map<string, EntityFormTargetRef>();
    await Promise.all([...byType.entries()].map(async ([ckTypeId, ids]) => {
      try {
        const result = await firstValueFrom(this.referenceOptionsGql.fetch({
          variables: { ckTypeId, first: ids.length, fieldFilters: [{ attributePath: 'rtId', operator: FieldFilterOperatorsDto.InDto, comparisonValue: ids }] },
          fetchPolicy: 'network-only',
        }));
        for (const i of result.data?.runtime?.runtimeEntities?.items ?? []) {
          if (i) {
            named.set(i.rtId as string, { rtId: i.rtId as string, ckTypeId: i.ckTypeId as string, displayName: displayNameOf(i as Parameters<typeof displayNameOf>[0]) });
          }
        }
      } catch {
        // Display names are cosmetic; ids are shown instead.
      }
    }));
    return named;
  }
}
