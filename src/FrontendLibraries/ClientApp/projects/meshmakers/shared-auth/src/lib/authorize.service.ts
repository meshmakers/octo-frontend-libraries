import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, firstValueFrom, Observable } from "rxjs";
import { filter, map } from "rxjs/operators";
import { AuthConfig, OAuthService } from "angular-oauth2-oidc";
import { Roles } from "./roles";

export interface IUser {
  name: string;
  role: string[];
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

  private readonly isAuthenticated = new BehaviorSubject<boolean>(false);
  private readonly authority: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  private readonly accessToken: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  private readonly user: BehaviorSubject<IUser | null> = new BehaviorSubject<IUser | null>(null);

  private readonly isInitialized = new BehaviorSubject<boolean>(false);
  private readonly isInitializing = new BehaviorSubject<boolean>(false);

  private authorizeOptions: AuthorizeOptions | null = null;

  constructor() {
    console.debug("AuthorizeService::created");

    this.getUser().subscribe((s) => {
      this.isAuthenticated.next(!(s == null));
    });

    this.oauthService.events.subscribe((e) => {
      console.debug("oauth/oidc event", e);
    });

    this.oauthService.events.pipe(filter((e) => e.type === "session_terminated")).subscribe((_) => {
      console.debug("Your session has been terminated!");
    });

    this.oauthService.events.pipe(filter((e) => e.type === "token_received")).subscribe((_) => {
      this.loadUser();
    });

    this.oauthService.events.pipe(filter((e) => e.type === "session_unchanged")).subscribe((_) => {
      if (this.user.value == null) {
        this.loadUser();
      }
    });

    this.oauthService.events.pipe(filter((e) => e.type === "logout")).subscribe((_) => {
      this.accessToken.next(null);
      this.user.next(null);
    });
  }

  public isInRole(role: Roles): boolean {
    return this.user?.value?.role.includes(role) ?? false;
  }

  public getRoles(): Observable<string[]> {
    return this.getUser().pipe(map((u) => (u != null ? u.role : new Array<string>())));
  }

  public getServiceUris(): string[] | null {
    return this.authorizeOptions?.wellKnownServiceUris ?? null;
  }

  public getAuthority(): Observable<string | null> {
    return this.authority;
  }

  public getIsAuthenticated(): Observable<boolean> {
    return this.isAuthenticated;
  }

  public getAccessToken(): Observable<string | null> {
    return this.accessToken;
  }

  public getUser(): Observable<IUser | null> {
    return this.user;
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

    if (await firstValueFrom(this.isInitializing)) {
      return;
    }
    if (await firstValueFrom(this.isInitialized)) {
      console.debug("AuthorizeService::initialize::alreadyInitialized");
      return;
    }
    this.isInitializing.next(true);

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
        preserveRequestedRoute: true
      };

      this.authorizeOptions = authorizeOptions;

      this.oauthService.configure(config);
      this.oauthService.setStorage(localStorage);
      console.debug("AuthorizeService::initialize::loadingDiscoveryDocumentAndTryLogin");
      await this.oauthService.loadDiscoveryDocumentAndTryLogin();

      console.debug("AuthorizeService::initialize::setupAutomaticSilentRefresh");
      this.oauthService.setupAutomaticSilentRefresh();

      this.authority.next(authorizeOptions.issuer ?? null);


      this.isInitialized.next(true);
      console.debug("AuthorizeService::initialize::done");
    }
    finally {
      this.isInitializing.next(false);
    }

    console.debug("AuthorizeService::initialize::completed");
  }

  public async uninitialize(): Promise<void> {
    console.debug("AuthorizeService::uninitialize::started");

    if (await firstValueFrom(this.isInitializing)) {
      return;
    }
    if (!await firstValueFrom(this.isInitialized)) {
      console.debug("AuthorizeService::uninitialize::alreadyUninitialized");
      return;
    }

    try {
      this.isInitializing.next(true);

      this.oauthService.stopAutomaticRefresh();

      this.authorizeOptions = null;

      this.isInitialized.next(false);
      console.debug("AuthorizeService::uninitialize::done");
    }
    finally {
      this.isInitializing.next(false);
    }

    console.debug("AuthorizeService::uninitialize::completed");
  }

  private loadUser(): void {
    const claims = this.oauthService.getIdentityClaims();
    if (!claims) {
      console.error("claims where null when loading identity claims");
      return;
    }

    const user = claims as IUser;
    const accessToken = this.oauthService.getAccessToken();
    this.user.next(user);
    this.accessToken.next(accessToken);
  }
}
