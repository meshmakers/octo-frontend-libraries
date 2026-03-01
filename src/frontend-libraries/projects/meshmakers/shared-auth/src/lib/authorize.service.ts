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

  private authorizeOptions: AuthorizeOptions | null = null;

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
   * Computed signal containing the user's roles.
   */
  readonly roles: Signal<string[]> = computed(() => this._user()?.role ?? []);

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
   * Logs out the current user.
   */
  public logout(): void {
    this.oauthService.logOut(false);
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
    if (user.family_name && user.given_name) {
      const initials = user.given_name.charAt(0) + user.family_name.charAt(0);
      this._userInitials.set(initials);
    } else {
      this._userInitials.set(user.name.charAt(0) + user.name.charAt(1));
    }

    const accessToken = this.oauthService.getAccessToken();
    this._user.set(user);
    this._accessToken.set(accessToken);
    this._isAuthenticated.set(true);
    this._sessionLoading.set(false);
    console.debug("AuthorizeService::loadUserAsync::done");
  }

  /**
   * Reloads the page. This method is protected to allow mocking in tests.
   * @internal
   */
  protected reloadPage(): void {
    window.location.reload();
  }
}
