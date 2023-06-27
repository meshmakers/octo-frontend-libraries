import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthConfig, OAuthService } from 'angular-oauth2-oidc';

export interface IUser {
  name: string;
  role: string[];
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
  private readonly isAuthenticated = new BehaviorSubject<boolean>(false);
  private readonly isAdmin = new BehaviorSubject<boolean>(false);
  private readonly isDeveloper = new BehaviorSubject<boolean>(false);
  private readonly isManager = new BehaviorSubject<boolean>(false);
  private readonly authority: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  private readonly accessToken: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  private readonly user: BehaviorSubject<IUser | null> = new BehaviorSubject<IUser | null>(null);
  private readonly isInitialized = new BehaviorSubject<boolean>(false);
  private readonly isInitializing = new BehaviorSubject<boolean>(false);

  constructor(@Inject(AuthorizeOptions) private readonly authorizeOptions: AuthorizeOptions, private readonly oauthService: OAuthService) {
    console.debug('AuthorizeService::created');

    this.getUser().subscribe(s => {
      this.isAuthenticated.next(!(s == null));
      this.isAdmin.next(!(s == null) && (s.role.includes('Administrators')));
      this.isDeveloper.next(!(s == null) && (s.role.includes('Developers')));
      this.isManager.next(!(s == null) && s.role.includes('Managers'));
    });

    this.oauthService.events.subscribe(e => {
      console.debug('oauth/oidc event', e);
    });

    this.oauthService.events
      .pipe(filter(e => e.type === 'session_terminated'))
      .subscribe(_ => {
        console.debug('Your session has been terminated!');
      });

    this.oauthService.events
      .pipe(filter(e => e.type === 'token_received'))
      .subscribe(_ => {
        this.loadUser();
      });

    this.oauthService.events
      .pipe(filter(e => e.type === 'logout'))
      .subscribe(_ => {
        this.accessToken.next(null);
        this.user.next(null);
      });
  }

  public getRoles(): Observable<string[]> {
    return this.getUser().pipe(
      map(u => u != null ? u.role : new Array<string>())
    );
  }

  public getServiceUris(): string[] | null {
    return this.authorizeOptions.wellKnownServiceUris ?? null;
  }

  public getAuthority(): BehaviorSubject<string | null> {
    return this.authority;
  }

  public getIsAuthenticated(): BehaviorSubject<boolean> {
    return this.isAuthenticated;
  }

  public getIsAdmin(): BehaviorSubject<boolean> {
    return this.isAdmin;
  }

  public getIsDeveloper(): BehaviorSubject<boolean> {
    return this.isDeveloper;
  }

  public getIsManager(): BehaviorSubject<boolean> {
    return this.isManager;
  }

  public getAccessToken(): BehaviorSubject<string | null> {
    return this.accessToken;
  }

  public getUser(): BehaviorSubject<IUser | null> {
    return this.user;
  }

  public login() {
    this.oauthService.initImplicitFlow();
  }

  public logout() {
    this.oauthService.logOut(false);
  }

  public async initialize() {
    console.debug('AuthorizeService::initialize::started');

    if (await firstValueFrom(this.isInitializing)) {
      return;
    }
    if (await firstValueFrom(this.isInitialized)) {
      return;
    }
    this.isInitializing.next(true);

    const config: AuthConfig = {
      responseType: 'code',
      issuer: this.authorizeOptions.issuer,
      redirectUri: this.authorizeOptions.redirectUri,
      postLogoutRedirectUri: this.authorizeOptions.postLogoutRedirectUri,
      clientId: this.authorizeOptions.clientId,
      scope: this.authorizeOptions.scope,
      showDebugInformation: this.authorizeOptions.showDebugInformation,
      sessionChecksEnabled: this.authorizeOptions.sessionChecksEnabled
    };

    this.oauthService.configure(config);
    this.oauthService.setStorage(localStorage);
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();

    this.oauthService.setupAutomaticSilentRefresh();

    if (this.oauthService.hasValidAccessToken()) {
      this.loadUser();
    }

    this.authority.next(this.authorizeOptions.issuer ?? null);
    this.isInitializing.next(false);
    this.isInitialized.next(true);

    console.debug('AuthorizeService::initialize::done');
  }

  private loadUser() {
    const claims = this.oauthService.getIdentityClaims();
    if (!claims) {
      console.error('claims where null when loading identity claims');
      return;
    }

    const user = <IUser>claims;
    const accessToken = this.oauthService.getAccessToken();
    this.user.next(user);
    this.accessToken.next(accessToken);
  }
}
