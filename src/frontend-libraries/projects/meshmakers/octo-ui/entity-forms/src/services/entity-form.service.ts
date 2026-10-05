import { EnvironmentProviders, Injectable, inject, provideEnvironmentInitializer } from '@angular/core';
import { TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { toKebabTypeKey } from '../core/attribute-path';
import { RawCkRecord, RawCkType, toCkRecordInfo, toCkTypeInfo } from '../core/ck-metadata';
import { parseEntityForms, RawRtEntityRow } from '../core/entity-form-parser';
import { resolveEntityForm } from '../core/entity-form-resolver';
import { ENTITY_FORM_FALLBACK_FORMS, selectFallbackForms, withFallbackForms } from '../core/fallback-forms';
import { isRecordType } from '../core/entity-form-value-mapper';
import { EntityFormTypeProbeDtoGQL } from '../graphQL/entityFormTypeProbe';
import { EntityFormGetCkRecordDtoGQL } from '../graphQL/getEntityFormCkRecord';
import { EntityFormGetCkTypeDtoGQL } from '../graphQL/getEntityFormCkType';
import { EntityFormGetEntityFormsDtoGQL } from '../graphQL/getEntityForms';
import {
  CkRecordInfo,
  CkTypeInfo,
  EntityFormDefinition,
  ResolvedEntityForm,
} from '../models/entity-form.models';

/**
 * Loads entity forms and CK metadata and resolves the form for a type (plan §2.3).
 *
 * - Forms are read only after the type probe confirms `System.UI/EntityForm` exists (System.UI >=
 *   2.7.0); otherwise, and when the forms query fails, every type resolves to the built-in form.
 * - Results are cached per tenant (`TENANT_ID_PROVIDER`, empty string when not provided) in a
 *   `Map<string, Promise<…>>`; a failed entry is evicted so the next call retries.
 * - Host fallback forms (`ENTITY_FORM_FALLBACK_FORMS`, `registerFallbackForms`) are appended where
 *   the normal resolution would end at `form-default` — also when the forms cannot be loaded
 *   (AB#5524).
 * - Resolver warnings are logged with `console.warn`.
 */
@Injectable({ providedIn: 'root' })
export class EntityFormService {
  private readonly probeGql = inject(EntityFormTypeProbeDtoGQL);
  private readonly formsGql = inject(EntityFormGetEntityFormsDtoGQL);
  private readonly ckTypeGql = inject(EntityFormGetCkTypeDtoGQL);
  private readonly ckRecordGql = inject(EntityFormGetCkRecordDtoGQL);
  private readonly tenantIdProvider = inject(TENANT_ID_PROVIDER, { optional: true });
  private readonly fallbackForms = inject(ENTITY_FORM_FALLBACK_FORMS, { optional: true });

  private readonly cache = new Map<string, Promise<unknown>>();
  private readonly registeredFallbacks: (readonly EntityFormDefinition[])[] = [];

  /**
   * Adds host fallback forms at runtime (see `provideEntityFormFallbacks`). Registering the same
   * array again is a no-op; a new one drops the cached forms and resolutions.
   */
  registerFallbackForms(forms: readonly EntityFormDefinition[]): void {
    if (!forms.length || this.registeredFallbacks.includes(forms)) {
      return;
    }
    this.registeredFallbacks.push(forms);
    this.invalidate();
  }

  /** Drops every cached form, type, record and resolution (all tenants). */
  invalidate(): void {
    this.cache.clear();
  }

  /**
   * All parsed `System.UI/EntityForm` definitions of the current tenant (`[]` when not installed),
   * plus the host fallback forms for target types without a loaded form.
   */
  async getForms(): Promise<EntityFormDefinition[]> {
    const loaded = await this.loadForms();
    const fallbacks = [...(this.fallbackForms ?? []), ...this.registeredFallbacks.flat()];
    if (!fallbacks.length) {
      return loaded;
    }
    // CK metadata of the candidate types (cached), to check the ancestor forms.
    const candidates = withFallbackForms(loaded, fallbacks).slice(loaded.length);
    const types = new Map<string, CkTypeInfo | null>();
    await Promise.all(candidates.map(async (f) => {
      types.set(f.targetCkTypeId.toLowerCase(), await this.getCkType(f.targetCkTypeId).catch(() => null));
    }));
    return [...loaded, ...selectFallbackForms(loaded, fallbacks, (id) => types.get(id.toLowerCase()))];
  }

  private async loadForms(): Promise<EntityFormDefinition[]> {
    return this.cached('forms', async () => {
      try {
        const probe = await firstValueFrom(this.probeGql.fetch({ fetchPolicy: 'network-only' }));
        if (!probe.data?.constructionKit?.types?.items?.length) {
          return [];
        }
        const result = await firstValueFrom(this.formsGql.fetch({ fetchPolicy: 'network-only' }));
        return parseEntityForms((result.data?.runtime?.runtimeEntities?.items ?? []) as RawRtEntityRow[]);
      } catch (error) {
        console.warn('EntityFormService: entity forms could not be loaded; using the built-in default form.', error);
        throw error;
      }
    }).catch(() => [] as EntityFormDefinition[]);
  }

  /** CK metadata of a type, or `null` when the type does not exist. */
  async getCkType(rtCkTypeId: string): Promise<CkTypeInfo | null> {
    return this.cached(`type::${rtCkTypeId}`, async () => {
      const result = await firstValueFrom(this.ckTypeGql.fetch({ variables: { rtCkTypeId }, fetchPolicy: 'network-only' }));
      const raw = result.data?.constructionKit?.types?.items?.[0];
      return raw ? toCkTypeInfo(raw as unknown as RawCkType) : null;
    });
  }

  /** CK metadata of a record (versioned ckRecordId, e.g. `System.UI-2.7.0/EntityFormSection-1`). */
  async getCkRecord(ckRecordId: string): Promise<CkRecordInfo | null> {
    return this.cached(`record::${ckRecordId}`, async () => {
      const result = await firstValueFrom(this.ckRecordGql.fetch({ variables: { ckRecordId }, fetchPolicy: 'network-only' }));
      const raw = result.data?.constructionKit?.records?.items?.[0];
      return raw ? toCkRecordInfo(raw as unknown as RawCkRecord) : null;
    });
  }

  /**
   * Loads every record reachable from the given attributes (recursively), keyed by ckRecordId.
   * Records that cannot be loaded are left out.
   */
  async getRecordsFor(type: CkTypeInfo): Promise<Record<string, CkRecordInfo>> {
    const records: Record<string, CkRecordInfo> = {};
    const pending = type.attributes.filter((a) => isRecordType(a.valueType) && a.ckRecordId).map((a) => a.ckRecordId as string);
    const seen = new Set<string>();
    while (pending.length) {
      const batch = pending.splice(0).filter((id) => !seen.has(id));
      batch.forEach((id) => seen.add(id));
      const loaded = await Promise.all(batch.map((id) => this.getCkRecord(id).catch(() => null)));
      for (const record of loaded) {
        if (!record) {
          continue;
        }
        records[record.ckRecordId] = record;
        record.attributes
          .filter((a) => isRecordType(a.valueType) && a.ckRecordId && !seen.has(a.ckRecordId))
          .forEach((a) => pending.push(a.ckRecordId as string));
      }
    }
    return records;
  }

  /**
   * Resolves the form for a type. Rejects when the CK type does not exist; falls back to the
   * built-in form when no form applies or the forms cannot be loaded.
   */
  async resolve(rtCkTypeId: string): Promise<ResolvedEntityForm> {
    return this.cached(`resolve::${rtCkTypeId}`, async () => {
      const [type, forms] = await Promise.all([this.getCkType(rtCkTypeId), this.getForms()]);
      if (!type) {
        throw new Error(`EntityFormService: CK type '${rtCkTypeId}' not found.`);
      }
      const records = await this.getRecordsFor(type);
      const resolved = resolveEntityForm(type, forms, { records });
      for (const warning of resolved.warnings) {
        console.warn(`EntityFormService: ${warning}`);
      }
      return resolved;
    });
  }

  /**
   * Resolves by form key: the form's `rtWellKnownName` (`form-sftp-configuration`) or the kebab
   * type key (`sftp-configuration`, matched against `form-<key>` and then against the kebab-cased
   * name of each form's target type). The type's form is then resolved normally, so a tenant form
   * for the same type still wins. Returns `null` when no form matches the key.
   */
  async resolveByFormKey(formKey: string): Promise<ResolvedEntityForm | null> {
    const key = formKey.trim().toLowerCase();
    if (!key) {
      return null;
    }
    const forms = await this.getForms();
    const match = forms.find((f) => (f.rtWellKnownName ?? '').toLowerCase() === key)
      ?? forms.find((f) => (f.rtWellKnownName ?? '').toLowerCase() === `form-${key}`)
      ?? forms.find((f) => toKebabTypeKey(f.targetCkTypeId) === key);
    return match ? this.resolve(match.targetCkTypeId) : null;
  }

  private async tenantId(): Promise<string> {
    if (!this.tenantIdProvider) {
      return '';
    }
    try {
      return (await this.tenantIdProvider()) ?? '';
    } catch {
      return '';
    }
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const fullKey = `${await this.tenantId()}::${key}`;
    const existing = this.cache.get(fullKey) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }
    const promise = load();
    this.cache.set(fullKey, promise);
    promise.catch(() => {
      if (this.cache.get(fullKey) === promise) {
        this.cache.delete(fullKey);
      }
    });
    return promise;
  }
}

/**
 * Registers host fallback forms in the root `EntityFormService` when the providing (lazy) route's
 * environment injector is created — one service, one cache, and the entry point stays out of the
 * initial bundle (AB#5524). Put it into the `providers` of every lazy route that renders entity
 * forms; registering the same array several times is harmless.
 */
export function provideEntityFormFallbacks(forms: readonly EntityFormDefinition[]): EnvironmentProviders {
  return provideEnvironmentInitializer(() => inject(EntityFormService).registerFallbackForms(forms));
}
