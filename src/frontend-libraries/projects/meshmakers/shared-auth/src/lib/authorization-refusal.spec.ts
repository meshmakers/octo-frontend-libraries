import { HttpErrorResponse } from '@angular/common/http';
import { authorizationRefusal } from './authorization-refusal';

describe('authorizationRefusal', () => {
  it('classifies 401 as unauthorized', () => {
    expect(authorizationRefusal({ status: 401 })).toBe('unauthorized');
  });

  it('classifies 403 as forbidden', () => {
    expect(authorizationRefusal({ status: 403 })).toBe('forbidden');
  });

  it('classifies a real HttpErrorResponse, not just a shaped literal', () => {
    expect(authorizationRefusal(new HttpErrorResponse({ status: 401 }))).toBe('unauthorized');
    expect(authorizationRefusal(new HttpErrorResponse({ status: 403 }))).toBe('forbidden');
  });

  it('leaves every other status to the caller', () => {
    expect(authorizationRefusal({ status: 400 })).toBeNull();
    expect(authorizationRefusal({ status: 404 })).toBeNull();
    expect(authorizationRefusal({ status: 500 })).toBeNull();
  });

  // A transport failure and a CORS refusal both surface as 0. Reporting either as an
  // authorization problem would send the operator to the login screen for a network fault.
  it('does not treat a transport failure as a refusal', () => {
    expect(authorizationRefusal({ status: 0 })).toBeNull();
  });

  it('tolerates anything that is not an HTTP failure', () => {
    expect(authorizationRefusal(null)).toBeNull();
    expect(authorizationRefusal(undefined)).toBeNull();
    expect(authorizationRefusal(new Error('boom'))).toBeNull();
    expect(authorizationRefusal('403')).toBeNull();
    expect(authorizationRefusal(403)).toBeNull();
    expect(authorizationRefusal({})).toBeNull();
  });

  // `==` would accept this and hand the caller a "sign in again" message for a body that
  // merely happens to carry the digits.
  it('requires a numeric status, so a stringified one is not a match', () => {
    expect(authorizationRefusal({ status: '401' })).toBeNull();
    expect(authorizationRefusal({ status: '403' })).toBeNull();
  });

  // Callers reach it through a rejected promise or a rethrow, where the error arrives as
  // `unknown` and is often wrapped on the way. Reading the property structurally is the
  // whole point of putting this in the library.
  it('reads the status off a rethrown error that lost its prototype', () => {
    const rethrown = JSON.parse(JSON.stringify({ status: 403, message: 'Forbidden' }));
    expect(authorizationRefusal(rethrown)).toBe('forbidden');
  });
});
