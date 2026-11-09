import { TestBed } from '@angular/core/testing';
import type { MockedObject } from 'vitest';
import { EntityFormChangeSet, ResolvedEntityForm } from '../models/entity-form.models';
import { EntityFormDataService } from './entity-form-data.service';
import { RtEntityFormDataAdapter } from './entity-form-data-adapter';

const MODEL = { rtCkTypeId: 'System.Communication/SftpConfiguration' } as ResolvedEntityForm;
const CHANGES: EntityFormChangeSet = { attributes: [{ attributeName: 'host', value: 'h' }], associations: [], isEmpty: false };

describe('RtEntityFormDataAdapter (AB#8591, the default adapter)', () => {
  let dataService: MockedObject<EntityFormDataService>;
  let adapter: RtEntityFormDataAdapter;

  beforeEach(() => {
    dataService = {
      load: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue('r9'),
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as MockedObject<EntityFormDataService>;
    TestBed.configureTestingModule({ providers: [{ provide: EntityFormDataService, useValue: dataService }] });
    adapter = TestBed.inject(RtEntityFormDataAdapter);
  });

  it('loads by rtId or well-known name through EntityFormDataService', async () => {
    await adapter.load({ model: MODEL, mode: 'edit', rtId: 'r1' });
    await adapter.load({ model: MODEL, mode: 'edit', wellKnownName: 'Default', ckTypeId: 'X/Y' });
    expect(dataService.load).toHaveBeenNthCalledWith(1, MODEL, { rtId: 'r1' });
    expect(dataService.load).toHaveBeenNthCalledWith(2, MODEL, { wellKnownName: 'Default', ckTypeId: 'X/Y' });
    expect(await adapter.load({ model: MODEL, mode: 'create' })).toBeNull();
  });

  it('creates and returns the new rtId; updates exactly the change set', async () => {
    expect(await adapter.save({ model: MODEL, mode: 'create' }, CHANGES)).toEqual({ applied: true, rtId: 'r9' });
    expect(dataService.create).toHaveBeenCalledWith(MODEL, 'System.Communication/SftpConfiguration', CHANGES);
    expect(await adapter.save({ model: MODEL, mode: 'edit', rtId: 'r1', ckTypeId: 'X/Y' }, CHANGES)).toEqual({ applied: true, rtId: 'r1' });
    expect(dataService.update).toHaveBeenCalledWith('r1', 'X/Y', CHANGES);
  });

  it('rejects an edit without rtId and passes server errors through', async () => {
    await expect(adapter.save({ model: MODEL, mode: 'edit' }, CHANGES)).rejects.toThrow(/needs context\.rtId/);
    dataService.update.mockRejectedValue(new Error('server said no'));
    await expect(adapter.save({ model: MODEL, mode: 'edit', rtId: 'r1' }, CHANGES)).rejects.toThrow(/^server said no$/);
  });
});
