import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpResponse, HttpHandlerFn } from '@angular/common/http';
import { of } from 'rxjs';
import { authorizeInterceptor } from './authorize.interceptor';
import { AuthorizeService } from './authorize.service';

// =============================================================================
// FUNCTIONAL INTERCEPTOR TESTS
// =============================================================================

describe('authorizeInterceptor (functional)', () => {
  let authServiceMock: jasmine.SpyObj<AuthorizeService>;
  let nextFn: jasmine.Spy<HttpHandlerFn>;

  beforeEach(() => {
    authServiceMock = jasmine.createSpyObj('AuthorizeService', ['getAccessTokenSync', 'getServiceUris']);
    authServiceMock.getAccessTokenSync.and.returnValue(null);
    authServiceMock.getServiceUris.and.returnValue(null);

    nextFn = jasmine.createSpy('nextFn').and.callFake((req: HttpRequest<unknown>) => {
      return of(new HttpResponse({ status: 200, body: {}, url: req.url }));
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthorizeService, useValue: authServiceMock }
      ]
    });
  });

  describe('without token', () => {
    beforeEach(() => {
      authServiceMock.getAccessTokenSync.and.returnValue(null);
    });

    it('should not add Authorization header to same-origin request', (done) => {
      const req = new HttpRequest('GET', '/api/data');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.has('Authorization')).toBeFalse();
          done();
        });
      });
    });

    it('should not add Authorization header to external request', (done) => {
      const req = new HttpRequest('GET', 'https://external.com/api/data');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.has('Authorization')).toBeFalse();
          done();
        });
      });
    });
  });

  describe('with token', () => {
    beforeEach(() => {
      authServiceMock.getAccessTokenSync.and.returnValue('test-access-token');
    });

    describe('same-origin requests', () => {
      it('should add Authorization header to relative URL', (done) => {
        const req = new HttpRequest('GET', '/api/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to absolute same-origin URL', (done) => {
        const req = new HttpRequest('GET', `${window.location.origin}/api/data`);

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to protocol-relative same-origin URL', (done) => {
        const req = new HttpRequest('GET', `//${window.location.host}/api/data`);

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to nested relative URL', (done) => {
        const req = new HttpRequest('GET', '/api/v1/users/123');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });
    });

    describe('external requests', () => {
      it('should not add Authorization header to external URL', (done) => {
        const req = new HttpRequest('GET', 'https://external-api.com/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should not add Authorization header to protocol-relative external URL', (done) => {
        const req = new HttpRequest('GET', '//external-api.com/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });
    });

    describe('known service URIs', () => {
      beforeEach(() => {
        authServiceMock.getServiceUris.and.returnValue([
          'https://api.example.com',
          'https://graphql.example.com/v1'
        ]);
      });

      it('should add Authorization header to known service URI', (done) => {
        const req = new HttpRequest('GET', 'https://api.example.com/users');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to another known service URI', (done) => {
        const req = new HttpRequest('GET', 'https://graphql.example.com/v1/query');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should not add Authorization header to unknown external URL', (done) => {
        const req = new HttpRequest('GET', 'https://unknown-api.com/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });
    });

    describe('request immutability', () => {
      it('should not modify the original request', (done) => {
        const originalReq = new HttpRequest('GET', '/api/data');
        const originalHeaders = originalReq.headers;

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(originalReq, nextFn).subscribe(() => {
            expect(originalReq.headers).toBe(originalHeaders);
            expect(originalReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should create a cloned request with Authorization header', (done) => {
        const originalReq = new HttpRequest('GET', '/api/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(originalReq, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq).not.toBe(originalReq);
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });
    });
  });

  describe('URL pattern matching edge cases', () => {
    beforeEach(() => {
      authServiceMock.getAccessTokenSync.and.returnValue('test-token');
    });

    it('should not match root-relative URL without leading slash', (done) => {
      const req = new HttpRequest('GET', 'api/data');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.has('Authorization')).toBeFalse();
          done();
        });
      });
    });

    it('should match URL with query parameters', (done) => {
      const req = new HttpRequest('GET', '/api/data?param=value');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.get('Authorization')).toBe('Bearer test-token');
          done();
        });
      });
    });

    it('should match URL with hash fragment', (done) => {
      const req = new HttpRequest('GET', '/api/data#section');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.get('Authorization')).toBe('Bearer test-token');
          done();
        });
      });
    });
  });
});
