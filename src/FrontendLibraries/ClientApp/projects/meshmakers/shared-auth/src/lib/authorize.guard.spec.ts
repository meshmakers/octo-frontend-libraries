import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthorizeGuard } from './authorize.guard';
import { AuthorizeService } from './authorize.service';

describe('AuthorizeGuard', () => {
  const mockAuthorizeService = {
    isAuthenticated: of(false),
    login: jasmine.createSpy('login'),
    getRoles: () => of([])
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthorizeGuard,
        provideRouter([]),
        { provide: AuthorizeService, useValue: mockAuthorizeService }
      ]
    });
  });

  it('should be created', () => {
    const guard = TestBed.inject(AuthorizeGuard);
    expect(guard).toBeTruthy();
  });
});
