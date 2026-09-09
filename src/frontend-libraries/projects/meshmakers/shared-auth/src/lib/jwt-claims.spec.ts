import { allowedTenantsFromToken, decodeJwtPayload, tenantIdFromToken } from './jwt-claims';

function jwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  // base64url, as a real token carries it
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.signature`;
}

describe('jwt-claims', () => {
  describe('decodeJwtPayload', () => {
    it('decodes a base64url payload', () => {
      expect(decodeJwtPayload(jwt({ sub: 'u1', tenant_id: 'maco' }))).toEqual({ sub: 'u1', tenant_id: 'maco' });
    });

    // A JWT payload carries no '=' padding, so its length mod 4 is 0, 2 or 3 depending on the
    // claims. Every remainder must decode, whatever the runtime's atob() tolerates.
    it('decodes unpadded payloads of every length remainder', () => {
      for (const t of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
        const token = jwt({ t });
        expect(token.split('.')[1]).not.toContain('=');
        expect(decodeJwtPayload(token)).toEqual({ t });
      }
    });

    it('returns null for a missing, malformed or undecodable token', () => {
      expect(decodeJwtPayload(null)).toBeNull();
      expect(decodeJwtPayload('')).toBeNull();
      expect(decodeJwtPayload('not.a-jwt')).toBeNull();
      expect(decodeJwtPayload('a.%%%.c')).toBeNull();
    });
  });

  describe('tenantIdFromToken', () => {
    it('returns the tenant_id claim', () => {
      expect(tenantIdFromToken(jwt({ tenant_id: 'sbeg2' }))).toBe('sbeg2');
    });

    it('returns null without a usable claim', () => {
      expect(tenantIdFromToken(jwt({}))).toBeNull();
      expect(tenantIdFromToken(jwt({ tenant_id: '' }))).toBeNull();
      expect(tenantIdFromToken(jwt({ tenant_id: 42 }))).toBeNull();
      expect(tenantIdFromToken(null)).toBeNull();
    });
  });

  describe('allowedTenantsFromToken', () => {
    it('returns the list claim', () => {
      expect(allowedTenantsFromToken(jwt({ allowed_tenants: ['a', 'b'] }))).toEqual(['a', 'b']);
    });

    it('wraps a single-valued claim, which identity emits as a plain string', () => {
      expect(allowedTenantsFromToken(jwt({ allowed_tenants: 'a' }))).toEqual(['a']);
    });

    it('returns an empty list without the claim', () => {
      expect(allowedTenantsFromToken(jwt({}))).toEqual([]);
      expect(allowedTenantsFromToken(null)).toEqual([]);
    });
  });
});
