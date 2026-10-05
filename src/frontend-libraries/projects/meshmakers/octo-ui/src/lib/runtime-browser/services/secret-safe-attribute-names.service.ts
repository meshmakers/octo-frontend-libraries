import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { isSecretAttributeCandidate, toAttributeNameFilter, toCamelCaseAttributeName } from '@meshmakers/octo-services';
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
  /** Top-level RECORD / RECORD_ARRAY attributes (camelCase) whose record type contains a secret. */
  readonly recordsWithSecrets: string[];
}

const RECORD_TYPES = new Set(['RECORD', 'RECORD_ARRAY']);

/**
 * Builds SECRET-safe `attributeNames` lists for the generic runtime documents (AB#5542).
 *
 * The generic `attributes` field returns every attribute — credentials included — unless it is
 * restricted. Screens that show "all attributes" of an arbitrary CK type (property grid, entity
 * detail, edit form) use {@link forCkType}: the CK type's attributes plus the sub-attributes of
 * its records (the server applies the same filter inside records), minus every secret candidate
 * (`isSecretAttributeCandidate`: `secret: true` metadata or a textual credential-like name).
 * A name that is a secret anywhere in the type is excluded everywhere, because one flat list
 * filters all nesting levels.
 *
 * Failures of the CK lookup yield an empty list (no attributes) — fail closed. Lookups go through
 * Apollo's cache (`AttributeMetadataResolverService`), so repeated calls are cheap.
 */
@Injectable({ providedIn: 'root' })
export class SecretSafeAttributeNamesService {
  private readonly resolver = inject(AttributeMetadataResolverService);
  private readonly typeAttributesGQL = inject(GetSecretSafeTypeAttributesDtoGQL);

  /**
   * camelCase names of all non-secret attributes (incl. record sub-attributes) of a runtime type.
   * @param rtCkTypeId the type in RtCkTypeId format (`Basic/TreeNode`, as in `RtEntity.ckTypeId`).
   */
  async forCkType(rtCkTypeId: string | null | undefined): Promise<string[]> {
    return (await this.analyse(rtCkTypeId)).attributeNames;
  }

  /** Full analysis: safe names, secret names and the records that carry secrets. */
  async analyse(rtCkTypeId: string | null | undefined): Promise<SecretSafeAttributeAnalysis> {
    if (!rtCkTypeId) return { attributeNames: [], secretNames: [], recordsWithSecrets: [] };

    const names: string[] = [];
    const secrets = new Set<string>();
    const recordsWithSecrets: string[] = [];
    const recordCache = new Map<string, Promise<boolean>>();

    const visitRecord = (recordId: string, path: Set<string>): Promise<boolean> => {
      if (path.has(recordId)) return Promise.resolve(false);
      let pending = recordCache.get(recordId);
      if (!pending) {
        pending = this.visit(recordId, new Set([...path, recordId]), names, secrets, visitRecord);
        recordCache.set(recordId, pending);
      }
      return pending;
    };

    const metas = await this.loadType(rtCkTypeId);
    for (const meta of metas) {
      const hasSecret = await this.visitAttribute(meta, new Set(), names, secrets, visitRecord);
      if (hasSecret && RECORD_TYPES.has(meta.attributeValueType?.toUpperCase() ?? '')) {
        recordsWithSecrets.push(...toAttributeNameFilter([meta.attributeName]));
      }
    }

    const secretNames = [...secrets];
    return {
      attributeNames: toAttributeNameFilter(names).filter((n) => !secrets.has(n)),
      secretNames,
      recordsWithSecrets,
    };
  }

  private async visit(
    ckId: string,
    path: Set<string>,
    names: string[],
    secrets: Set<string>,
    visitRecord: (recordId: string, path: Set<string>) => Promise<boolean>,
  ): Promise<boolean> {
    let containsSecret = false;
    for (const meta of await this.loadRecord(ckId)) {
      if (await this.visitAttribute(meta, path, names, secrets, visitRecord)) containsSecret = true;
    }
    return containsSecret;
  }

  /** Records the attribute; returns whether it is (or, for records, contains) a secret. */
  private async visitAttribute(
    meta: CkAttributeMetadata,
    path: Set<string>,
    names: string[],
    secrets: Set<string>,
    visitRecord: (recordId: string, path: Set<string>) => Promise<boolean>,
  ): Promise<boolean> {
    if (!meta.attributeName) return false;
    if (isSecretAttributeCandidate({
      attributeName: meta.attributeName,
      attributeValueType: meta.attributeValueType,
      metaData: meta.attribute?.metaData,
    })) {
      secrets.add(toCamelCaseAttributeName(meta.attributeName));
      return true;
    }
    names.push(meta.attributeName);
    const recordId = meta.attribute?.ckRecord?.ckRecordId?.fullName;
    if (recordId && RECORD_TYPES.has(meta.attributeValueType?.toUpperCase() ?? '')) {
      return visitRecord(recordId, path);
    }
    return false;
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
