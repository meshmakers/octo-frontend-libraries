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

    expect(analysis.attributeNames).toEqual(['states', 'providers', 'name', 'currentValue', 'key']);
    expect(analysis.secretNames).toEqual(['apiKey']);
    expect(analysis.blockedAttributes).toEqual(['providers']);
  });

  it('excludes a name everywhere when it is a secret at any level', async () => {
    records['Override-1'] = [meta('Key'), meta('Value', 'STRING', { secretMeta: true })];
    typeReturns([meta('Value'), meta('Overrides', 'RECORD_ARRAY', { recordId: 'Override-1' })]);

    const analysis = await service.analyse('Test/Type');
    expect(analysis.attributeNames).toEqual(['overrides', 'key']);
    // Top-level `value` is not loaded (collision) and the record carries the secret: both blocked.
    expect(analysis.blockedAttributes).toEqual(['value', 'overrides']);
  });

  it('keeps non-secret types with credential-like names: Helm Values record round-trips isSecret (review fix)', async () => {
    records['System.Communication/ValueOverride-1'] = [meta('Path'), meta('Value'), meta('IsSecret', 'BOOLEAN')];
    typeReturns([meta('Name'), meta('Values', 'RECORD_ARRAY', { recordId: 'System.Communication/ValueOverride-1' })]);

    const analysis = await service.analyse('System.Communication/Application');

    expect(analysis.attributeNames).toEqual(['name', 'values', 'path', 'value', 'isSecret']);
    expect(analysis.blockedAttributes).toEqual([]);
  });

  it('keeps a record attribute named like a credential (Credentials) and blocks it only if it carries a secret', async () => {
    records['Creds-1'] = [meta('UserName'), meta('Password')];
    records['Labels-1'] = [meta('Text')];
    typeReturns([
      meta('Credentials', 'RECORD', { recordId: 'Creds-1' }),
      meta('Tokens', 'RECORD_ARRAY', { recordId: 'Labels-1' }),
    ]);

    const analysis = await service.analyse('Test/Type');

    expect(analysis.attributeNames).toEqual(['credentials', 'tokens', 'userName', 'text']);
    expect(analysis.secretNames).toEqual(['password']);
    expect(analysis.blockedAttributes).toEqual(['credentials']);
  });

  it('blocks a record whose definition could not be loaded (fail closed)', async () => {
    typeReturns([meta('Endpoint', 'RECORD', { recordId: 'Missing-1' })]);

    expect((await service.analyse('Test/Type')).blockedAttributes).toEqual(['endpoint']);
  });

  it('survives recursive record definitions', async () => {
    records['Node-1'] = [meta('Label'), meta('Children', 'RECORD_ARRAY', { recordId: 'Node-1' })];
    typeReturns([meta('Root', 'RECORD', { recordId: 'Node-1' })]);

    const analysis = await service.analyse('Test/Tree');
    expect(analysis.attributeNames).toEqual(['root', 'label', 'children']);
    expect(analysis.blockedAttributes).toEqual([]);
  });

  it('does not treat a record reached through a cycle as secret-free (review fix)', async () => {
    // A -> B -> A, and the secret sits in A: B must be "carries a secret" as well, regardless of
    // the visiting order.
    records['A-1'] = [meta('Token'), meta('Next', 'RECORD', { recordId: 'B-1' })];
    records['B-1'] = [meta('Label'), meta('Back', 'RECORD', { recordId: 'A-1' })];
    typeReturns([meta('ViaB', 'RECORD', { recordId: 'B-1' }), meta('ViaA', 'RECORD', { recordId: 'A-1' })]);

    const analysis = await service.analyse('Test/Cycle');

    expect(analysis.secretNames).toEqual(['token']);
    expect(analysis.blockedAttributes).toEqual(['viaB', 'viaA']);
  });

  it('restrict keeps only requested names that are non-secret attributes of the type (type-aware)', async () => {
    typeReturns([meta('Label'), meta('IsSecret', 'BOOLEAN'), meta('Password')]);

    expect(await service.restrict('Test/Type', ['Label', 'isSecret', 'password', 'unknown', null])).toEqual(['label', 'isSecret']);
    expect(await service.restrict('Test/Type', [])).toEqual([]);
  });

  it('fails closed (no attributes) when the CK lookup fails', async () => {
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    typeGql.fetch.mockReturnValue(throwError(() => new Error('boom')) as never);

    expect(await service.forCkType('Test/Type')).toEqual([]);
  });

  describe('SECRET value type (AB#5528)', () => {
    it('lists SECRET attributes as safe-to-read state names, not as value names', async () => {
      typeReturns([meta('Name'), meta('Password', 'SECRET'), meta('ApiKey', 'SECRET')]);
      const analysis = await service.analyse('Test/Type');
      expect(analysis.attributeNames).toEqual(['name']);
      expect(analysis.secretStateNames).toEqual(['password', 'apiKey']);
      expect(analysis.secretNames).toEqual(['password', 'apiKey']);
      // Top-level SECRET scalars are write-only, never blocked.
      expect(analysis.blockedAttributes).toEqual([]);
      expect(await service.forCkType('Test/Type')).toEqual(['name']);
      expect(await service.forCkType('Test/Type', { includeSecretState: true })).toEqual(['name', 'password', 'apiKey']);
    });

    it('does not block a record whose only secret member is SECRET-typed (record-key carry-over)', async () => {
      records['System.Communication/ValueOverride-1'] = [
        meta('Path'), meta('Value'), meta('IsSecret', 'BOOLEAN'), meta('SecretValue', 'SECRET'),
      ];
      typeReturns([meta('Values', 'RECORD_ARRAY', { recordId: 'System.Communication/ValueOverride-1' })]);
      const analysis = await service.analyse('Test/Type');
      expect(analysis.attributeNames).toEqual(['values', 'path', 'value', 'isSecret']);
      expect(analysis.secretStateNames).toEqual(['secretValue']);
      expect(analysis.blockedAttributes).toEqual([]);
    });

    it('never reads a SECRET name that is also a heuristic (non-SECRET) secret elsewhere', async () => {
      records['Legacy-1'] = [meta('Key'), meta('Password')];
      typeReturns([meta('Password', 'SECRET'), meta('Legacy', 'RECORD', { recordId: 'Legacy-1' })]);
      const analysis = await service.analyse('Test/Type');
      expect(analysis.secretStateNames).toEqual([]);
      expect(analysis.blockedAttributes).toEqual(['legacy']);
    });
  });
});
