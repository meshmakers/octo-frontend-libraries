import { OAuthStorage } from 'angular-oauth2-oidc';

/**
 * Known OAuth storage keys used by angular-oauth2-oidc.
 * Used by clearAllTenants() to identify and remove OAuth-related entries
 * across all tenants without affecting other localStorage data.
 */
const OAUTH_STORAGE_KEYS = [
  'access_token',
  'refresh_token',
  'id_token',
  'id_token_claims_obj',
  'id_token_header',
  'expires_at',
  'access_token_stored_at',
  'id_token_expires_at',
  'id_token_stored_at',
  'nonce',
  'PKCE_verifier',
  'session_state',
  'granted_scopes',
  'requested_route',
];

/**
 * SessionStorage key used to persist the current storage tenant ID across
 * page reloads (e.g., OAuth redirects). The tenant ID must survive the
 * round-trip to the identity server because the redirect URI may not
 * contain the tenant path segment.
 */
const STORAGE_TENANT_KEY = 'octo_storage_tenant';

/**
 * Tenant-aware OAuth storage that prefixes all keys with a tenant ID.
 *
 * When a tenant ID is set, all storage keys are prefixed with `{tenantId}__`
 * (double underscore separator). This isolates OAuth tokens per tenant,
 * preventing race conditions during tenant switches where tokens from one
 * tenant could overwrite another's.
 *
 * When no tenant ID is set (null), keys are stored without a prefix,
 * maintaining backwards compatibility with existing single-tenant apps.
 *
 * The tenant ID is also persisted in sessionStorage so that it survives
 * OAuth redirects (the redirect URI may not include the tenant path).
 *
 * @example
 * ```typescript
 * const storage = new TenantAwareOAuthStorage();
 * storage.setTenantId('maco');
 * storage.setItem('access_token', 'abc');
 * // Stored as: localStorage['maco__access_token'] = 'abc'
 *
 * storage.setTenantId('octosystem');
 * storage.getItem('access_token');
 * // Reads: localStorage['octosystem__access_token'] → null (isolated)
 * ```
 */
export class TenantAwareOAuthStorage extends OAuthStorage {
  private tenantId: string | null = null;

  /**
   * Sets the tenant ID used to prefix storage keys.
   * Must be called before the OAuthService reads/writes tokens.
   * The tenant ID is persisted in sessionStorage so it survives OAuth redirects.
   *
   * @param tenantId The tenant ID, or null for unprefixed (backwards-compatible) mode.
   */
  setTenantId(tenantId: string | null): void {
    this.tenantId = tenantId;
    try {
      if (tenantId) {
        sessionStorage.setItem(STORAGE_TENANT_KEY, tenantId);
      } else {
        sessionStorage.removeItem(STORAGE_TENANT_KEY);
      }
    } catch {
      // sessionStorage may be unavailable
    }
  }

  /**
   * Returns the currently configured tenant ID.
   */
  getTenantId(): string | null {
    return this.tenantId;
  }

  /**
   * Restores the tenant ID from sessionStorage.
   * Call this on app startup when the tenant cannot be determined from the URL
   * (e.g., after an OAuth redirect to the root path).
   *
   * @returns The restored tenant ID, or null if none was persisted.
   */
  restoreTenantId(): string | null {
    try {
      const stored = sessionStorage.getItem(STORAGE_TENANT_KEY);
      if (stored) {
        this.tenantId = stored;
        return stored;
      }
    } catch {
      // sessionStorage may be unavailable
    }
    return null;
  }

  /**
   * Returns the prefixed key for the given base key.
   * When tenantId is null, returns the base key unchanged.
   */
  prefixKey(key: string): string {
    if (this.tenantId) {
      return `${this.tenantId}__${key}`;
    }
    return key;
  }

  getItem(key: string): string | null {
    return localStorage.getItem(this.prefixKey(key));
  }

  removeItem(key: string): void {
    localStorage.removeItem(this.prefixKey(key));
  }

  setItem(key: string, data: string): void {
    localStorage.setItem(this.prefixKey(key), data);
  }

  /**
   * Clears all OAuth-related keys for ALL tenants from localStorage.
   * This removes both prefixed (e.g., `maco__access_token`) and unprefixed
   * (e.g., `access_token`) OAuth keys, while leaving non-OAuth data intact.
   *
   * Used during full logout to ensure no stale tokens remain for any tenant.
   */
  clearAllTenants(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey) continue;

      for (const oauthKey of OAUTH_STORAGE_KEYS) {
        if (storageKey === oauthKey || storageKey.endsWith('__' + oauthKey)) {
          keysToRemove.push(storageKey);
          break;
        }
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}
