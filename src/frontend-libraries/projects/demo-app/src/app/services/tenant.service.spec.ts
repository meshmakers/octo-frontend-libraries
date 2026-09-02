import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TenantService } from './tenant.service';
import { GetCkModelByIdDtoGQL } from '../graphQL/getCkModelById';

describe('TenantService', () => {
  let service: TenantService;
  let mockGetCkModelByIdGQL: MockedObject<GetCkModelByIdDtoGQL>;

  beforeEach(() => {
    mockGetCkModelByIdGQL = {
      fetch: vi.fn().mockName('GetCkModelByIdDtoGQL.fetch')
    } as unknown as MockedObject<GetCkModelByIdDtoGQL>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    mockGetCkModelByIdGQL.fetch.mockReturnValue(of({ data: { constructionKit: { models: { items: [] } } } } as any));

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        { provide: GetCkModelByIdDtoGQL, useValue: mockGetCkModelByIdGQL }
      ]
    });
    service = TestBed.inject(TenantService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
