import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TenantService } from './tenant.service';
import { GetCkModelByIdDtoGQL, GetCkModelByIdQueryDto } from '../graphQL/getCkModelById';
import { ApolloQueryResult } from '@apollo/client/core';

describe('TenantService', () => {
  let service: TenantService;
  let mockGetCkModelByIdGQL: jasmine.SpyObj<GetCkModelByIdDtoGQL>;

  beforeEach(() => {
    mockGetCkModelByIdGQL = jasmine.createSpyObj('GetCkModelByIdDtoGQL', ['fetch']);
    mockGetCkModelByIdGQL.fetch.and.returnValue(of({ data: { constructionKit: { models: { items: [] } } } } as unknown as ApolloQueryResult<GetCkModelByIdQueryDto>));

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
