import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GetSecretSafeTypeAttributesDtoGQL } from '../../graphQL/getSecretSafeTypeAttributes';
import { CkAttributeMetadata } from '../models/attribute-metadata';
import { AttributeMetadataResolverService } from './attribute-metadata-resolver.service';
import { SecretSafeAttributeNamesService } from './secret-safe-attribute-names.service';

describe('SecretSafeAttributeNamesService (AB#5542)', () => {
  let service: SecretSafeAttributeNamesService;
  let typeGql: MockedObject<GetSecretSafeTypeAttributesDtoGQL>;
  let resolver: MockedObject<AttributeMetadataResolverService>;
  let records: Record<string, CkAttributeMetadata[]>;

  function meta(
    attributeName: string,
    attributeValueType = 'STRING',
    extra: { recordId?: string; secretMeta?: boolean } = {},
  ): CkAttributeMetadata {
    return {
      attributeName,
      attributeValueType,
      isOptional: true,
      attribute: {
        metaData: extra.secretMeta ? [{ key: 'secret', value: 'true' }] : null,
        ckRecord: extra.recordId ? { ckRecordId: { fullName: extra.recordId } } : null,
      },
    };
  }

  function typeReturns(items: CkAttributeMetadata[]): void {
    typeGql.fetch.mockReturnValue(of({
      data: { constructionKit: { types: { items: [{ attributes: { items } }] } } },
    }) as never);
  }

  beforeEach(() => {
    records = {};
    typeGql = { fetch: vi.fn() } as unknown as MockedObject<GetSecretSafeTypeAttributesDtoGQL>;
    resolver = {
      getRawAttributes$: vi.fn((id: string) => of(records[id] ?? [])),
    } as unknown as MockedObject<AttributeMetadataResolverService>;
    TestBed.configureTestingModule({
      providers: [
        SecretSafeAttributeNamesService,
        { provide: GetSecretSafeTypeAttributesDtoGQL, useValue: typeGql },
        { provide: AttributeMetadataResolverService, useValue: resolver },
      ],
    });
    service = TestBed.inject(SecretSafeAttributeNamesService);
  });

  it('returns no names without a type and does not query', async () => {
    expect(await service.forCkType('')).toEqual([]);
    expect(typeGql.fetch).not.toHaveBeenCalled();
  });

  it('looks the type up by RtCkTypeId and drops credential-like and metadata-marked attributes', async () => {
    typeReturns([
      meta('Name'),
      meta('User'),
      meta('Password'),
      meta('ClientSecret'),
      meta('MaxTokens', 'INT'),
      meta('Hidden', 'STRING', { secretMeta: true }),
    ]);

    expect(await service.forCkType('System.Communication/SapConfiguration')).toEqual(['name', 'user', 'maxTokens']);
    expect(typeGql.fetch).toHaveBeenCalledWith({ variables: { rtCkTypeId: 'System.Communication/SapConfiguration' } });
  });

  it('includes record sub-attributes (the filter applies inside records) and reports records with secrets', async () => {
    records['Basic/State-1'] = [meta('Name'), meta('CurrentValue', 'DOUBLE')];
    records['Ai/Provider-1'] = [meta('Key'), meta('ApiKey')];
    typeReturns([
      meta('States', 'RECORD_ARRAY', { recordId: 'Basic/State-1' }),
      meta('Providers', 'RECORD_ARRAY', { recordId: 'Ai/Provider-1' }),
    ]);

    const analysis = await service.analyse('Test/Type');

    expect(analysis.attributeNames).toEqual(['states', 'name', 'currentValue', 'providers', 'key']);
    expect(analysis.secretNames).toEqual(['apiKey']);
    expect(analysis.recordsWithSecrets).toEqual(['providers']);
  });

  it('excludes a name everywhere when it is a secret at any level', async () => {
    records['Override-1'] = [meta('Key'), meta('Value', 'STRING', { secretMeta: true })];
    typeReturns([meta('Value'), meta('Overrides', 'RECORD_ARRAY', { recordId: 'Override-1' })]);

    expect(await service.forCkType('Test/Type')).toEqual(['overrides', 'key']);
  });

  it('survives recursive record definitions', async () => {
    records['Node-1'] = [meta('Label'), meta('Children', 'RECORD_ARRAY', { recordId: 'Node-1' })];
    typeReturns([meta('Root', 'RECORD', { recordId: 'Node-1' })]);

    expect(await service.forCkType('Test/Tree')).toEqual(['root', 'label', 'children']);
  });

  it('fails closed (no attributes) when the CK lookup fails', async () => {
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    typeGql.fetch.mockReturnValue(throwError(() => new Error('boom')) as never);

    expect(await service.forCkType('Test/Type')).toEqual([]);
  });
});
