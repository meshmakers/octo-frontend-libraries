import { TenantAwareOAuthStorage } from './tenant-aware-oauth-storage';

describe('TenantAwareOAuthStorage', () => {
  let storage: TenantAwareOAuthStorage;

  beforeEach(() => {
    storage = new TenantAwareOAuthStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('without tenant ID (backwards compatibility)', () => {
    it('should store items with unprefixed keys', () => {
      storage.setItem('access_token', 'token-123');

      expect(localStorage.getItem('access_token')).toBe('token-123');
    });

    it('should retrieve items with unprefixed keys', () => {
      localStorage.setItem('access_token', 'token-123');

      expect(storage.getItem('access_token')).toBe('token-123');
    });

    it('should remove items with unprefixed keys', () => {
      localStorage.setItem('access_token', 'token-123');

      storage.removeItem('access_token');

      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('should return null for non-existent keys', () => {
      expect(storage.getItem('non_existent')).toBeNull();
    });
  });

  describe('with tenant ID', () => {
    beforeEach(() => {
      storage.setTenantId('maco');
    });

    it('should store items with prefixed keys', () => {
      storage.setItem('access_token', 'maco-token');

      expect(localStorage.getItem('maco__access_token')).toBe('maco-token');
      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('should retrieve items with prefixed keys', () => {
      localStorage.setItem('maco__access_token', 'maco-token');

      expect(storage.getItem('access_token')).toBe('maco-token');
    });

    it('should remove items with prefixed keys', () => {
      localStorage.setItem('maco__access_token', 'maco-token');

      storage.removeItem('access_token');

      expect(localStorage.getItem('maco__access_token')).toBeNull();
    });

    it('should not see unprefixed keys', () => {
      localStorage.setItem('access_token', 'global-token');

      expect(storage.getItem('access_token')).toBeNull();
    });

    it('should not see other tenants keys', () => {
      localStorage.setItem('octosystem__access_token', 'other-token');

      expect(storage.getItem('access_token')).toBeNull();
    });
  });

  describe('tenant switching', () => {
    it('should isolate tokens between tenants', () => {
      storage.setTenantId('maco');
      storage.setItem('access_token', 'maco-token');
      storage.setItem('nonce', 'maco-nonce');

      storage.setTenantId('octosystem');
      storage.setItem('access_token', 'octosystem-token');
      storage.setItem('nonce', 'octosystem-nonce');

      // Verify isolation
      expect(localStorage.getItem('maco__access_token')).toBe('maco-token');
      expect(localStorage.getItem('maco__nonce')).toBe('maco-nonce');
      expect(localStorage.getItem('octosystem__access_token')).toBe('octosystem-token');
      expect(localStorage.getItem('octosystem__nonce')).toBe('octosystem-nonce');
    });

    it('should read correct tenant tokens after switch', () => {
      storage.setTenantId('maco');
      storage.setItem('access_token', 'maco-token');

      storage.setTenantId('octosystem');
      storage.setItem('access_token', 'octosystem-token');

      // Should read octosystem token
      expect(storage.getItem('access_token')).toBe('octosystem-token');

      // Switch back to maco
      storage.setTenantId('maco');
      expect(storage.getItem('access_token')).toBe('maco-token');
    });
  });

  describe('prefixKey', () => {
    it('should return unprefixed key when no tenant is set', () => {
      expect(storage.prefixKey('access_token')).toBe('access_token');
    });

    it('should return prefixed key when tenant is set', () => {
      storage.setTenantId('maco');
      expect(storage.prefixKey('access_token')).toBe('maco__access_token');
    });

    it('should return unprefixed key after tenant is cleared', () => {
      storage.setTenantId('maco');
      storage.setTenantId(null);
      expect(storage.prefixKey('access_token')).toBe('access_token');
    });
  });

  describe('getTenantId', () => {
    it('should return null initially', () => {
      expect(storage.getTenantId()).toBeNull();
    });

    it('should return the set tenant ID', () => {
      storage.setTenantId('maco');
      expect(storage.getTenantId()).toBe('maco');
    });
  });

  describe('clearAllTenants', () => {
    it('should clear prefixed OAuth keys for all tenants', () => {
      localStorage.setItem('maco__access_token', 'maco-token');
      localStorage.setItem('maco__refresh_token', 'maco-refresh');
      localStorage.setItem('maco__nonce', 'maco-nonce');
      localStorage.setItem('octosystem__access_token', 'octo-token');
      localStorage.setItem('octosystem__id_token', 'octo-id');

      storage.clearAllTenants();

      expect(localStorage.getItem('maco__access_token')).toBeNull();
      expect(localStorage.getItem('maco__refresh_token')).toBeNull();
      expect(localStorage.getItem('maco__nonce')).toBeNull();
      expect(localStorage.getItem('octosystem__access_token')).toBeNull();
      expect(localStorage.getItem('octosystem__id_token')).toBeNull();
    });

    it('should clear unprefixed OAuth keys', () => {
      localStorage.setItem('access_token', 'old-token');
      localStorage.setItem('nonce', 'old-nonce');
      localStorage.setItem('PKCE_verifier', 'old-verifier');

      storage.clearAllTenants();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('nonce')).toBeNull();
      expect(localStorage.getItem('PKCE_verifier')).toBeNull();
    });

    it('should not remove non-OAuth keys', () => {
      localStorage.setItem('my_app_setting', 'value');
      localStorage.setItem('user_preference', 'dark');
      localStorage.setItem('maco__access_token', 'token');

      storage.clearAllTenants();

      expect(localStorage.getItem('my_app_setting')).toBe('value');
      expect(localStorage.getItem('user_preference')).toBe('dark');
      expect(localStorage.getItem('maco__access_token')).toBeNull();
    });

    it('should handle empty localStorage', () => {
      expect(() => storage.clearAllTenants()).not.toThrow();
    });

    it('should clear all known OAuth key types', () => {
      const oauthKeys = [
        'access_token', 'refresh_token', 'id_token', 'id_token_claims_obj',
        'id_token_header', 'expires_at', 'access_token_stored_at',
        'id_token_expires_at', 'id_token_stored_at', 'nonce',
        'PKCE_verifier', 'session_state', 'granted_scopes', 'requested_route',
      ];

      // Set all keys for a tenant
      for (const key of oauthKeys) {
        localStorage.setItem(`testTenant__${key}`, 'value');
      }

      storage.clearAllTenants();

      for (const key of oauthKeys) {
        expect(localStorage.getItem(`testTenant__${key}`)).toBeNull();
      }
    });
  });
});
