import { TestBed } from '@angular/core/testing';
import { of, EMPTY } from 'rxjs';
import { OAuthService } from 'angular-oauth2-oidc';

import { AuthorizeService } from './authorize.service';

describe('AuthorizeService', () => {
  const mockOAuthService = {
    discoveryDocumentLoaded$: EMPTY,
    events: EMPTY,
    configure: jasmine.createSpy('configure'),
    setStorage: jasmine.createSpy('setStorage'),
    getIdentityClaims: () => null,
    getAccessToken: () => null,
    hasValidIdToken: () => false,
    initImplicitFlow: jasmine.createSpy('initImplicitFlow'),
    logOut: jasmine.createSpy('logOut')
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthorizeService,
        { provide: OAuthService, useValue: mockOAuthService }
      ]
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(AuthorizeService);
    expect(service).toBeTruthy();
  });
});
