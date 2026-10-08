import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { isSecretAttributeCandidate, isSecretValueType, toCamelCaseAttributeName, toUniqueCamelCaseNames } from '@meshmakers/octo-services';
import { CkAttributeMetadata } from '../models/attribute-metadata';
import { GetSecretSafeTypeAttributesDtoGQL } from '../../graphQL/getSecretSafeTypeAttributes';
import { AttributeMetadataResolverService } from './attribute-metadata-resolver.service';

/**
 * Attributes of a `System.Communication/DataPointMapping` entity that the runtime browser reads
 * (camelCase, as the `attributeNames` filter expects).
 */
export const DATA_POINT_MAPPING_ATTRIBUTE_NAMES: readonly string[] = [
  'name',
  'enabled',
  'sourceAttributePath',
  'targetAttributePath',
  'mappingExpression',
];

/** Result of {@link SecretSafeAttributeNamesService.analyse}. */
export interface SecretSafeAttributeAnalysis {
  /** camelCase names to pass as `attributeNames` (attributes + record sub-attributes, no secrets). */
  readonly attributeNames: string[];
  /** camelCase names of the secret candidates found (top level and inside records). */
  readonly secretNames: string[];
  /**
   * camelCase names of SECRET-typed attributes (AB#5528) that are safe to READ: the server returns
   * `value: null` plus `secretIsSet` for them (records: the marker `{ isSet }`). Callers that show a
   * set / not-set badge append them to `attributeNames` and select `secretIsSet`. A name that is
   * also a non-SECRET (heuristic) secret somewhere is never listed.
   */
  readonly secretStateNames: string[];
  /**
   * Top-level attributes (camelCase) that must NOT be written back by an editor because their
   * stored value is not (completely) loaded: records whose type contains a secret or a
   * sub-attribute excluded from `attributeNames`, a secret record attribute, and non-secret
   * attributes excluded by a name collision with a secret elsewhere. Top-level secret scalars are
   * not listed — they are write-only (an empty value is omitted, i.e. kept).
   */
  readonly blockedAttributes: string[];
}

const RECORD_TYPES = new Set(['RECORD', 'RECORD_ARRAY']);

function isRecordType(valueType: string | null | undefined): boolean {
  return RECORD_TYPES.has((valueType ?? '').toUpperCase());
}

function isSecret(meta: CkAttributeMetadata): boolean {
  return isSecretAttributeCandidate({
    attributeName: meta.attributeName,
    attributeValueType: meta.attributeValueType,
    metaData: meta.attribute?.metaData,
  });
}

function recordIdOf(meta: CkAttributeMetadata): string | null {
  return isRecordType(meta.attributeValueType) ? meta.attribute?.ckRecord?.ckRecordId?.fullName ?? null : null;
}

/**
 * Builds SECRET-safe `attributeNames` lists for the generic runtime documents (AB#5542).
 *
 * The generic `attributes` field returns every attribute — credentials included — unless it is
 * restricted. Screens that show "all attributes" of an arbitrary CK type (property grid, entity
 * detail, edit form, meshboard widgets) use {@link forCkType}: the CK type's attributes plus the
 * sub-attributes of its records (the server applies the same filter inside records), minus the
 * TYPE-AWARE secret candidates (`isSecretAttributeCandidate`: explicit `secret` metadata, or a
 * textual attribute with a credential-like name). Non-secret attributes are never dropped by name
 * (`isSecret: BOOLEAN`, a `credentials` RECORD stay in the list). Because one flat list filters
 * all nesting levels, a name that is a secret anywhere is excluded everywhere; editors must not
 * write back what was therefore not loaded ({@link SecretSafeAttributeAnalysis.blockedAttributes}).
 *
 * All reachable record definitions are loaded first and the "contains a secret / excluded name"
 * facts are computed over the whole record graph, so recursive record types are handled without
 * caching a premature "no secret" result for a record reached through a cycle.
 *
 * Failures of the type lookup yield an empty list (no attributes) — fail closed. Lookups go
 * through Apollo's cache, so repeated calls are cheap.
 */
@Injectable({ providedIn: 'root' })
export class SecretSafeAttributeNamesService {
  private readonly resolver = inject(AttributeMetadataResolverService);
  private readonly typeAttributesGQL = inject(GetSecretSafeTypeAttributesDtoGQL);

  /**
   * camelCase names of all non-secret attributes (incl. record sub-attributes) of a runtime type.
   * @param rtCkTypeId the type in RtCkTypeId format (`Basic/TreeNode`, as in `RtEntity.ckTypeId`).
   * @param options.includeSecretState also list the SECRET-typed attributes (safe to read, see
   *   {@link SecretSafeAttributeAnalysis.secretStateNames}) — the document must select `secretIsSet`.
   */
  async forCkType(rtCkTypeId: string | null | undefined, options: { includeSecretState?: boolean } = {}): Promise<string[]> {
    const analysis = await this.analyse(rtCkTypeId);
    return options.includeSecretState
      ? toUniqueCamelCaseNames([...analysis.attributeNames, ...analysis.secretStateNames])
      : analysis.attributeNames;
  }

  /**
   * Type-aware restriction of a requested name list (e.g. widget-configured fields): the requested
   * names (camelCased) that are non-secret attributes of the type. Names that are unknown to the
   * type or secret are dropped; a failed CK lookup yields `[]` (fail closed).
   */
  async restrict(rtCkTypeId: string | null | undefined, requested: readonly (string | null | undefined)[]): Promise<string[]> {
    const wanted = toUniqueCamelCaseNames(requested);
    if (wanted.length === 0) return [];
    const safe = new Set(await this.forCkType(rtCkTypeId));
    return wanted.filter((n) => safe.has(n));
  }

  /** Full analysis: safe names, secret names and the attributes an editor must not write back. */
  async analyse(rtCkTypeId: string | null | undefined): Promise<SecretSafeAttributeAnalysis> {
    if (!rtCkTypeId) return { attributeNames: [], secretNames: [], secretStateNames: [], blockedAttributes: [] };

    const topLevel = await this.loadType(rtCkTypeId);
    const records = await this.loadRecordGraph(topLevel);

    // 1. Names and secrets over the type and every reachable record.
    const names: string[] = [];
    const secrets = new Set<string>();
    const secretValueTypeNames = new Set<string>();
    const heuristicSecrets = new Set<string>();
    for (const meta of [...topLevel, ...[...records.values()].flat()]) {
      if (!meta.attributeName) continue;
      const camel = toCamelCaseAttributeName(meta.attributeName);
      if (isSecret(meta)) {
        secrets.add(camel);
        (isSecretValueType(meta.attributeValueType) ? secretValueTypeNames : heuristicSecrets).add(camel);
      } else {
        names.push(meta.attributeName);
      }
    }
    const attributeNames = toUniqueCamelCaseNames(names).filter((n) => !secrets.has(n));
    const secretStateNames = [...secretValueTypeNames].filter((n) => !heuristicSecrets.has(n));
    // SECRET-typed sub-attributes count as loaded: the server carries an omitted record member over
    // from the stored element with the same record key (records with secrets always declare one),
    // and an echoed `{ isSet }` marker means "unchanged". Only heuristic secrets block a record.
    const loaded = new Set([...attributeNames, ...secretStateNames]);

    // 2. Per record type: is every (transitive) sub-attribute loaded? Fixpoint over the graph —
    //    start optimistic, mark incomplete records, propagate until stable (cycle-safe).
    const incomplete = new Set<string>();
    for (const [recordId, subs] of records) {
      // An unknown (failed / empty) record definition counts as incomplete — fail closed.
      if (subs.length === 0 || subs.some((m) => !m.attributeName || !loaded.has(toCamelCaseAttributeName(m.attributeName)))) {
        incomplete.add(recordId);
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const [recordId, subs] of records) {
        if (incomplete.has(recordId)) continue;
        if (subs.some((m) => { const id = recordIdOf(m); return !!id && incomplete.has(id); })) {
          incomplete.add(recordId);
          changed = true;
        }
      }
    }

    // 3. Top-level attributes an editor must not write back.
    const blocked: string[] = [];
    for (const meta of topLevel) {
      if (!meta.attributeName) continue;
      const name = toCamelCaseAttributeName(meta.attributeName);
      const recordId = recordIdOf(meta);
      const secret = isSecret(meta);
      if (secret && !recordId && !isRecordType(meta.attributeValueType)) continue; // write-only scalar
      if (!loaded.has(name) || (recordId && incomplete.has(recordId))) {
        blocked.push(name);
      }
    }

    return {
      attributeNames,
      secretNames: [...secrets],
      secretStateNames,
      blockedAttributes: toUniqueCamelCaseNames(blocked),
    };
  }

  /** Loads every record definition reachable from the type's attributes (each once). */
  private async loadRecordGraph(topLevel: CkAttributeMetadata[]): Promise<Map<string, CkAttributeMetadata[]>> {
    const records = new Map<string, CkAttributeMetadata[]>();
    let pending = topLevel.map(recordIdOf).filter((id): id is string => !!id);
    while (pending.length > 0) {
      const batch = [...new Set(pending)].filter((id) => !records.has(id));
      pending = [];
      const loadedBatch = await Promise.all(batch.map((id) => this.loadRecord(id)));
      batch.forEach((id, i) => {
        records.set(id, loadedBatch[i]);
        for (const meta of loadedBatch[i]) {
          const sub = recordIdOf(meta);
          if (sub && !records.has(sub)) pending.push(sub);
        }
      });
    }
    return records;
  }

  private loadType(rtCkTypeId: string): Promise<CkAttributeMetadata[]> {
    return firstValueFrom(
      this.typeAttributesGQL.fetch({ variables: { rtCkTypeId } }).pipe(
        map((res) =>
          (res.data?.constructionKit?.types?.items?.[0]?.attributes?.items ?? [])
            .filter((item): item is NonNullable<typeof item> => item != null) as CkAttributeMetadata[],
        ),
        catchError((err) => {
          console.error('SecretSafeAttributeNamesService: CK lookup failed', err);
          return of([] as CkAttributeMetadata[]);
        }),
      ),
    );
  }

  /** Record sub-attributes by CkRecordId full name (cached by Apollo, errors yield []). */
  private loadRecord(ckRecordId: string): Promise<CkAttributeMetadata[]> {
    return firstValueFrom(this.resolver.getRawAttributes$(ckRecordId, true));
  }
}
