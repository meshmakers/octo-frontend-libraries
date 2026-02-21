import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthorizeInterceptor } from './authorize.interceptor';
import { AuthorizeService } from './authorize.service';

describe('AuthorizeInterceptor', () => {
  const mockAuthorizeService = {
    accessToken: of(null),
    getServiceUris: () => null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthorizeInterceptor,
        { provide: AuthorizeService, useValue: mockAuthorizeService }
      ]
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(AuthorizeInterceptor);
    expect(service).toBeTruthy();
  });
});
