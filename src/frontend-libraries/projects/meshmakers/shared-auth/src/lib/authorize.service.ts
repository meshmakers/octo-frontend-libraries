import { Injectable, Signal, WritableSignal, computed, inject, signal } from "@angular/core";
import { AuthConfig, OAuthService } from "angular-oauth2-oidc";
import { Roles } from "./roles";

export interface IUser {
  family_name: string | null;
  given_name: string | null;
  name: string;
  role: string[] | null;
  sub: string;
  idp: string;
  email: string | null;
}

export class AuthorizeOptions {
  wellKnownServiceUris?: string[];
  // Url of the Identity Provider
  issuer?: string;
  // URL of the SPA to redirect the user to after login
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  // The SPA's id. The SPA is registered with this id at the auth-server
  clientId?: string;
  // set the scope for the permissions the client should request
  // The first three are defined by OIDC. The 4th is a use case-specific one
  scope?: string;
  showDebugInformation?: boolean;
  sessionChecksEnabled?: boolean;
}

@Injectable()
export class AuthorizeService {
  private readonly oauthService = inject(OAuthService);

  // =============================================================================
  // INTERNAL STATE (Writable Signals)
  // =============================================================================

  private readonly _isAuthenticated: WritableSignal<boolean> = signal(false);
  private readonly _issuer: WritableSignal<string | null> = signal(null);
  private readonly _accessToken: WritableSignal<string | null> = signal(null);
  private readonly _user: WritableSignal<IUser | null> = signal(null);
  private readonly _userInitials: WritableSignal<string | null> = signal(null);
  private readonly _isInitialized: WritableSignal<boolean> = signal(false);
  private readonly _isInitializing: WritableSignal<boolean> = signal(false);
  private readonly _sessionLoading: WritableSignal<boolean> = signal(false);
  private readonly _allowedTenants: WritableSignal<string[]> = signal([]);
  private readonly _tokenTenantId: WritableSignal<string | null> = signal(null);

  private static readonly TENANT_REAUTH_KEY = 'octo_tenant_reauth';
  private static readonly TENANT_SWITCH_ATTEMPTED_KEY = 'octo_tenant_switch_attempted';

  private authorizeOptions: AuthorizeOptions | null = null;
  private lastAuthConfig: AuthConfig | null = null;

  // =============================================================================
  // PUBLIC API (Readonly Signals) - NEW API
  // =============================================================================

  /**
   * Signal indicating whether the user is currently authenticated.
   */
  readonly isAuthenticated: Signal<boolean> = this._isAuthenticated.asReadonly();

  /**
   * Signal containing the issuer URL.
   */
  readonly issuer: Signal<string | null> = this._issuer.asReadonly();

  /**
   * Signal containing the current access token.
   */
  readonly accessToken: Signal<string | null> = this._accessToken.asReadonly();

  /**
   * Signal containing the current user information.
   */
  readonly user: Signal<IUser | null> = this._user.asReadonly();

  /**
   * Computed signal containing the user's initials (e.g., "JD" for John Doe).
   */
  readonly userInitials: Signal<string | null> = this._userInitials.asReadonly();

  /**
   * Signal indicating whether the session is currently loading.
   */
  readonly sessionLoading: Signal<boolean> = this._sessionLoading.asReadonly();

  /**
   * Signal containing the list of tenants the user is allowed to access.
   * Parsed from the allowed_tenants claims in the access token.
   */
  readonly allowedTenants: Signal<string[]> = this._allowedTenants.asReadonly();

  /**
   * Signal containing the tenant_id claim from the current access token.
   * Used to detect tenant mismatch when navigating between tenants.
   */
  readonly tokenTenantId: Signal<string | null> = this._tokenTenantId.asReadonly();

  /**
   * Computed signal containing the user's roles.
   */
  readonly roles: Signal<string[]> = computed(() => this._user()?.role ?? []);

  /**
   * Computed signal for the user's display name.
   * Uses given_name + family_name if available, otherwise derives from the username.
   */
  readonly displayName: Signal<string | null> = computed(() => {
    const user = this._user();
    if (!user) return null;
    if (user.given_name && user.family_name) {
      return user.given_name + ' ' + user.family_name;
    }
    return this.deriveDisplayNameFromUsername(user.name);
  });

  constructor() {
    console.debug("AuthorizeService::created");

    this.oauthService.discoveryDocumentLoaded$.subscribe((_) => {
      console.debug("discoveryDocumentLoaded$");
    });

    this.oauthService.events.subscribe((e) => {
      console.debug("oauth/oidc event", e);
    });

    this.oauthService.events
      .pipe((source) => source)
      .subscribe((e) => {
        if (e.type === "session_terminated") {
          console.debug("Your session has been terminated!");
          this._accessToken.set(null);
          this._user.set(null);
          this._isAuthenticated.set(false);
          this._tokenTenantId.set(null);
          // Reload the page to trigger the auth flow and redirect to login
          this.reloadPage();
        }
      });

    this.oauthService.events.subscribe(async (e) => {
      if (e.type === "token_received") {
        await this.loadUserAsync();
      }
    });

    this.oauthService.events.subscribe(async (e) => {
      if (e.type === "session_unchanged") {
        if (this._user() == null) {
          await this.loadUserAsync();
        }
      }
    });

    this.oauthService.events.subscribe((e) => {
      if (e.type === "logout") {
        console.debug("AuthorizeService: Logout event received");
        this._accessToken.set(null);
        this._user.set(null);
        this._isAuthenticated.set(false);
        this._tokenTenantId.set(null);
        // Reload the page to trigger the auth flow and redirect to login
        this.reloadPage();
      }
    });

    // Listen for storage events from other tabs (e.g., SLO logout callback)
    // This enables immediate cross-tab logout detection
    window.addEventListener('storage', (event) => {
      console.debug("AuthorizeService: Storage event received", event.key, event.newValue);
      // Check if access_token was removed (logout in another tab)
      // Note: OAuth library may set to empty string or null when clearing
      if (event.key === 'access_token' && (event.newValue === null || event.newValue === '') && this._isAuthenticated()) {
        console.debug("AuthorizeService: Access token removed in another tab - logging out and reloading");
        this._accessToken.set(null);
        this._user.set(null);
        this._isAuthenticated.set(false);
        this._tokenTenantId.set(null);
        // Reload the page to trigger the auth flow and redirect to login
        this.reloadPage();
      }
    });

    // Also listen for BroadcastChannel messages for cross-tab logout
    // This is more reliable than storage events for iframe-based SLO
    if (typeof BroadcastChannel !== 'undefined') {
      console.debug("AuthorizeService: Setting up BroadcastChannel listener for 'octo-auth-logout'");
      const logoutChannel = new BroadcastChannel('octo-auth-logout');
      logoutChannel.onmessage = (event) => {
        console.debug("AuthorizeService: BroadcastChannel message received", event.data);
        if (event.data?.type === 'logout' && this._isAuthenticated()) {
          console.debug("AuthorizeService: Logout broadcast received - reloading");
          this._accessToken.set(null);
          this._user.set(null);
          this._isAuthenticated.set(false);
          this._tokenTenantId.set(null);
          this.reloadPage();
        }
      };
    } else {
      console.warn("AuthorizeService: BroadcastChannel not supported in this browser");
    }
  }

  /**
   * Checks if the current user has the specified role.
   */
  public isInRole(role: Roles): boolean {
    return this._user()?.role?.includes(role) ?? false;
  }

  /**
   * Gets the configured service URIs that should receive the authorization token.
   */
  public getServiceUris(): string[] | null {
    return this.authorizeOptions?.wellKnownServiceUris ?? null;
  }

  /**
   * Gets the current access token synchronously.
   * Use this for functional interceptors that need immediate access to the token.
   *
   * @returns The current access token or null if not authenticated
   */
  public getAccessTokenSync(): string | null {
    return this._accessToken();
  }

  /**
   * Checks if the user is allowed to access the specified tenant.
   * Returns true if no allowed_tenants claims are present (backwards compatibility).
   */
  public isTenantAllowed(tenantId: string): boolean {
    const allowed = this._allowedTenants();
    if (allowed.length === 0) {
      return true; // No claims = backwards compatible (old tokens)
    }
    return allowed.some(t => t.toLowerCase() === tenantId.toLowerCase());
  }

  /**
   * Initiates the login flow.
   * @param tenantId Optional tenant ID. When provided, includes acr_values=tenant:{tenantId}
   *   so the identity server redirects to the correct tenant's login page.
   */
  public login(tenantId?: string): void {
    if (tenantId) {
      this.oauthService.initImplicitFlow('', { acr_values: `tenant:${tenantId}` });
    } else {
      this.oauthService.initImplicitFlow();
    }
  }

  /**
   * Forces re-authentication for a different tenant by clearing the local
   * OAuth session and reloading the page. On reload, the guard will see
   * isAuthenticated=false and call login(tenantId) with the correct acr_values.
   *
   * This is used when the current token's tenant_id does not match the
   * route's tenantId (e.g., navigating from octosystem to meshtest).
   */
  /**
   * Returns true if the switch was initiated, false if skipped (loop prevention).
   */
  public switchTenant(targetTenantId: string, targetUrl: string): boolean {
    console.debug(`AuthorizeService::switchTenant to "${targetTenantId}" at "${targetUrl}"`);

    // Prevent infinite redirect loop: if we already attempted a switch to this
    // exact tenant and ended up here again, the Identity Server did not issue
    // a token for the target tenant. Do NOT attempt again.
    try {
      const previousAttempt = sessionStorage.getItem(AuthorizeService.TENANT_SWITCH_ATTEMPTED_KEY);
      if (previousAttempt && previousAttempt.toLowerCase() === targetTenantId.toLowerCase()) {
        console.warn(`AuthorizeService::switchTenant — already attempted switch to "${targetTenantId}", skipping to prevent loop`);
        return false;
      }
    } catch {
      // sessionStorage may be unavailable
    }

    // Store target tenant so login() uses the correct acr_values after reload
    try {
      sessionStorage.setItem(AuthorizeService.TENANT_REAUTH_KEY, targetTenantId);
      sessionStorage.setItem(AuthorizeService.TENANT_SWITCH_ATTEMPTED_KEY, targetTenantId);
    } catch {
      // sessionStorage may be unavailable
    }

    // Clear local OAuth tokens directly from storage.
    // Do NOT use oauthService.logOut() — it fires a 'logout' event
    // whose handler calls reloadPage(), racing with our navigation below.
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('id_token_claims_obj');
    localStorage.removeItem('id_token_expires_at');
    localStorage.removeItem('id_token_stored_at');
    localStorage.removeItem('access_token_stored_at');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('nonce');
    localStorage.removeItem('PKCE_verifier');
    localStorage.removeItem('session_state');
    localStorage.removeItem('granted_scopes');
    localStorage.removeItem('requested_route');

    // Clear our signals
    this._accessToken.set(null);
    this._user.set(null);
    this._isAuthenticated.set(false);
    this._tokenTenantId.set(null);

    // Full page navigation to the target URL — triggers fresh auth flow
    window.location.href = targetUrl;
    return true;
  }

  /**
   * Returns the pending tenant switch target (if any) and clears it.
   * Called by the guard to pass the correct tenantId to login() after a switchTenant reload.
   */
  public consumePendingTenantSwitch(): string | null {
    try {
      const tenantId = sessionStorage.getItem(AuthorizeService.TENANT_REAUTH_KEY);
      sessionStorage.removeItem(AuthorizeService.TENANT_REAUTH_KEY);
      return tenantId;
    } catch {
      return null;
    }
  }

  /**
   * Returns the tenant for which a switch was already attempted (if any) and clears it.
   * Used by the guard to prevent infinite redirect loops: if the Identity Server
   * issues a token for the wrong tenant even after a switch, we skip the second attempt.
   */
  public consumeSwitchAttempted(): string | null {
    try {
      const tenantId = sessionStorage.getItem(AuthorizeService.TENANT_SWITCH_ATTEMPTED_KEY);
      sessionStorage.removeItem(AuthorizeService.TENANT_SWITCH_ATTEMPTED_KEY);
      return tenantId;
    } catch {
      return null;
    }
  }

  /**
   * Logs out the current user.
   */
  public logout(): void {
    this.oauthService.logOut(false);
  }

  /**
   * Updates the redirect URIs without performing a full re-initialization.
   * Use this when the OAuth session is already established and only the
   * redirect targets need to change (e.g., when switching tenants).
   */
  public updateRedirectUris(redirectUri: string, postLogoutRedirectUri: string): void {
    if (this.authorizeOptions) {
      this.authorizeOptions.redirectUri = redirectUri;
      this.authorizeOptions.postLogoutRedirectUri = postLogoutRedirectUri;
    }

    if (this.lastAuthConfig) {
      this.lastAuthConfig.redirectUri = redirectUri;
      this.lastAuthConfig.postLogoutRedirectUri = postLogoutRedirectUri;
      this.oauthService.configure(this.lastAuthConfig);
    }

    console.debug("AuthorizeService::updateRedirectUris::done");
  }

  /**
   * Initializes the authorization service with the specified options.
   */
  public async initialize(authorizeOptions: AuthorizeOptions): Promise<void> {
    console.debug("AuthorizeService::initialize::started");

    await this.uninitialize();

    if (this._isInitializing()) {
      return;
    }
    if (this._isInitialized()) {
      console.debug("AuthorizeService::initialize::alreadyInitialized");
      return;
    }
    this._isInitializing.set(true);

    try {
      const config: AuthConfig = {
        responseType: "code",
        issuer: authorizeOptions.issuer,
        redirectUri: authorizeOptions.redirectUri,
        postLogoutRedirectUri: authorizeOptions.postLogoutRedirectUri,
        clientId: authorizeOptions.clientId,
        scope: authorizeOptions.scope,
        showDebugInformation: authorizeOptions.showDebugInformation,
        sessionChecksEnabled: authorizeOptions.sessionChecksEnabled,
        sessionCheckIntervall: 60 * 1000,
        preserveRequestedRoute: true
      };

      this.authorizeOptions = authorizeOptions;
      this.lastAuthConfig = config;

      this.oauthService.setStorage(localStorage);
      this.oauthService.configure(config);
      console.debug("AuthorizeService::initialize::loadingDiscoveryDocumentAndTryLogin");
      await this.oauthService.loadDiscoveryDocumentAndTryLogin();

      console.debug("AuthorizeService::initialize::setupAutomaticSilentRefresh");
      this.oauthService.setupAutomaticSilentRefresh();

      this._issuer.set(authorizeOptions.issuer ?? null);

      if (this.oauthService.hasValidIdToken()) {
        // if the idToken is still valid, we can use the session
        console.debug("AuthorizeService::initialize::hasValidIdToken");
        this._sessionLoading.set(true);
        await this.oauthService.refreshToken();
      }

      this._isInitialized.set(true);
      console.debug("AuthorizeService::initialize::done");
    } finally {
      this._isInitializing.set(false);
    }

    console.debug("AuthorizeService::initialize::completed");
  }

  /**
   * Uninitializes the authorization service.
   */
  public async uninitialize(): Promise<void> {
    console.debug("AuthorizeService::uninitialize::started");

    if (this._isInitializing()) {
      return;
    }
    if (!this._isInitialized()) {
      console.debug("AuthorizeService::uninitialize::alreadyUninitialized");
      return;
    }

    try {
      this._isInitializing.set(true);

      this.oauthService.stopAutomaticRefresh();

      this.authorizeOptions = null;
      this.lastAuthConfig = null;

      // Note: Do NOT clear auth signals (_accessToken, _isAuthenticated, etc.) here.
      // The access token and user info are globally valid (not per-tenant) and remain
      // valid during re-initialization. Clearing them creates a window where the HTTP
      // interceptor sends requests without a Bearer token, causing 401 errors.
      // Signals are already properly cleared on logout/session_terminated events.

      this._isInitialized.set(false);
      console.debug("AuthorizeService::uninitialize::done");
    } finally {
      this._isInitializing.set(false);
    }

    console.debug("AuthorizeService::uninitialize::completed");
  }

  private async loadUserAsync(): Promise<void> {
    const claims = this.oauthService.getIdentityClaims();
    if (!claims) {
      console.error("claims where null when loading identity claims");
      return;
    }

    const user = claims as IUser;
    if (user.given_name && user.family_name) {
      this._userInitials.set(user.given_name.charAt(0).toUpperCase() + user.family_name.charAt(0).toUpperCase());
    } else {
      const derived = this.deriveDisplayNameFromUsername(user.name);
      this._userInitials.set(this.deriveInitials(derived));
    }

    const accessToken = this.oauthService.getAccessToken();
    this._user.set(user);
    this._accessToken.set(accessToken);
    this._isAuthenticated.set(true);
    this._sessionLoading.set(false);

    // Parse allowed_tenants from the access token
    this._allowedTenants.set(this.parseAllowedTenantsFromToken(accessToken));

    // Parse tenant_id from the access token (used for tenant mismatch detection)
    const tokenTenantId = this.parseTenantIdFromToken(accessToken);
    this._tokenTenantId.set(tokenTenantId);

    console.debug(`AuthorizeService::loadUserAsync::done (tokenTenantId="${tokenTenantId}", allowedTenants=${JSON.stringify(this._allowedTenants())})`);
  }

  /**
   * Decodes the JWT access token payload and extracts allowed_tenants claims.
   * The claim can be a single string or an array of strings.
   */
  private parseAllowedTenantsFromToken(accessToken: string | null): string[] {
    if (!accessToken) {
      return [];
    }

    try {
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        return [];
      }

      const payload = JSON.parse(atob(parts[1]));
      const allowedTenants = payload['allowed_tenants'];

      if (!allowedTenants) {
        return [];
      }

      if (Array.isArray(allowedTenants)) {
        return allowedTenants;
      }

      // Single value claim
      if (typeof allowedTenants === 'string') {
        return [allowedTenants];
      }

      return [];
    } catch (e) {
      console.warn('Failed to parse allowed_tenants from access token', e);
      return [];
    }
  }

  /**
   * Decodes the JWT access token payload and extracts the tenant_id claim.
   */
  private parseTenantIdFromToken(accessToken: string | null): string | null {
    if (!accessToken) {
      return null;
    }

    try {
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(parts[1]));
      return payload['tenant_id'] ?? null;
    } catch {
      return null;
    }
  }

  private deriveDisplayNameFromUsername(username: string): string {
    let name = username;
    // Strip xt_{tenantId}_ prefix
    const xtMatch = name.match(/^xt_[^_]+_(.+)$/);
    if (xtMatch) { name = xtMatch[1]; }
    // Extract local part of email
    const atIndex = name.indexOf('@');
    if (atIndex > 0) { name = name.substring(0, atIndex); }
    // Split by dots and capitalize
    const parts = name.split('.').filter(p => p.length > 0);
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  private deriveInitials(displayName: string): string {
    const words = displayName.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
    }
    if (words.length === 1 && words[0].length >= 2) {
      return words[0].charAt(0).toUpperCase() + words[0].charAt(1).toLowerCase();
    }
    return '??';
  }

  /**
   * Reloads the page. This method is protected to allow mocking in tests.
   * @internal
   */
  protected reloadPage(): void {
    window.location.reload();
  }
}
