import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, firstValueFrom, Observable } from "rxjs";
import { filter, map } from "rxjs/operators";
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

  private readonly _isAuthenticated = new BehaviorSubject<boolean>(false);
  private readonly _issuer: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  private readonly _accessToken: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  private readonly _user: BehaviorSubject<IUser | null> = new BehaviorSubject<IUser | null>(null);
  private readonly _userInitials: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  private readonly _isInitialized = new BehaviorSubject<boolean>(false);
  private readonly _isInitializing = new BehaviorSubject<boolean>(false);

  private readonly _sessionLoading = new BehaviorSubject<boolean>(false);

  private authorizeOptions: AuthorizeOptions | null = null;

  constructor() {
    console.debug("AuthorizeService::created");

    this.oauthService.discoveryDocumentLoaded$.subscribe((_) => {
      console.debug("discoveryDocumentLoaded$");

    });

    this.oauthService.events.subscribe((e) => {
      console.debug("oauth/oidc event", e);
    });

    this.oauthService.events.pipe(filter((e) => e.type === "session_terminated")).subscribe((_) => {
      console.debug("Your session has been terminated!");
      this._accessToken.next(null);
      this._user.next(null);
      this._isAuthenticated.next(false);
    });

    this.oauthService.events.pipe(filter((e) => e.type === "token_received")).subscribe(async (_) => {
      await this.loadUserAsync();
    });

    this.oauthService.events.pipe(filter((e) => e.type === "session_unchanged")).subscribe(async (_) => {
      if (this._user.value == null) {
        await this.loadUserAsync();
      }
    });

    this.oauthService.events.pipe(filter((e) => e.type === "logout")).subscribe((_) => {
      this._accessToken.next(null);
      this._user.next(null);
      this._isAuthenticated.next(false);
    });
  }

  public isInRole(role: Roles): boolean {
    return this._user?.value?.role?.includes(role) ?? false;
  }

  public getRoles(): Observable<string[]> {
    return this.user.pipe(map((u) => (u?.role != null ? u.role : new Array<string>())));
  }

  public getServiceUris(): string[] | null {
    return this.authorizeOptions?.wellKnownServiceUris ?? null;
  }

  public get issuer(): Observable<string | null> {
    return this._issuer;
  }

  public get isAuthenticated(): Observable<boolean> {
    return this._isAuthenticated;
  }

  public get sessionLoading(): Observable<boolean> {
    return this._sessionLoading;
  }

  public get accessToken(): Observable<string | null> {
    return this._accessToken;
  }

  public get user(): Observable<IUser | null> {
    return this._user;
  }

  public get userInitials(): Observable<string | null> {
    return this._userInitials;
  }

  public login(): void {
    this.oauthService.initImplicitFlow();
  }

  public logout(): void {
    this.oauthService.logOut(false);
  }

  public async initialize(authorizeOptions: AuthorizeOptions): Promise<void> {
    console.debug("AuthorizeService::initialize::started");

    await this.uninitialize();

    if (await firstValueFrom(this._isInitializing)) {
      return;
    }
    if (await firstValueFrom(this._isInitialized)) {
      console.debug("AuthorizeService::initialize::alreadyInitialized");
      return;
    }
    this._isInitializing.next(true);

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

      this._issuer.next(authorizeOptions.issuer ?? null);

      if (this.oauthService.hasValidIdToken()) {
        // if the idToken is still valid, we can use the session
        console.debug("AuthorizeService::initialize::hasValidIdToken");
        this._sessionLoading.next(true);
        await this.oauthService.refreshToken();
      }

      this._isInitialized.next(true);
      console.debug("AuthorizeService::initialize::done");
    } finally {
      this._isInitializing.next(false);
    }

    console.debug("AuthorizeService::initialize::completed");
  }

  public async uninitialize(): Promise<void> {
    console.debug("AuthorizeService::uninitialize::started");

    if (await firstValueFrom(this._isInitializing)) {
      return;
    }
    if (!await firstValueFrom(this._isInitialized)) {
      console.debug("AuthorizeService::uninitialize::alreadyUninitialized");
      return;
    }

    try {
      this._isInitializing.next(true);

      this.oauthService.stopAutomaticRefresh();

      this.authorizeOptions = null;

      this._isInitialized.next(false);
      console.debug("AuthorizeService::uninitialize::done");
    } finally {
      this._isInitializing.next(false);
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
    if (user.family_name && user.given_name){
      const initials = user.given_name.charAt(0) + user.family_name.charAt(0);
      this._userInitials.next(initials);
    }
    else {
      this._userInitials.next(user.name.charAt(0) + user.name.charAt(1));
    }

    const accessToken = this.oauthService.getAccessToken();
    this._user.next(user);
    this._accessToken.next(accessToken);
    this._isAuthenticated.next(true);
    this._sessionLoading.next(false);
    console.debug("AuthorizeService::loadUserAsync::done");
  }
}
