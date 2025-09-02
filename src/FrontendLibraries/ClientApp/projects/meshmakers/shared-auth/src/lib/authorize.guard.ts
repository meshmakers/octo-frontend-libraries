import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, UrlSegment, UrlTree } from '@angular/router';
import { AuthorizeService } from './authorize.service';
import { firstValueFrom, Observable } from 'rxjs';

@Injectable()
export class AuthorizeGuard {
  private readonly authorizeService = inject(AuthorizeService);
  private readonly router = inject(Router);

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const url: string = state.url;
    return this.handleAuthorization(next, url);
  }

  canActivateChild(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.canActivate(next, state);
  }

  canDeactivate(
    _component: unknown,
    _currentRoute: ActivatedRouteSnapshot,
    _currentState: RouterStateSnapshot,
    _nextState?: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return true;
  }

  canLoad(_route: Route, _segments: UrlSegment[]): Observable<boolean> | Promise<boolean> | boolean {
    return true;
  }

  private async handleAuthorization(route: ActivatedRouteSnapshot, _url: any): Promise<boolean> {
    const isAuthenticated = await firstValueFrom(this.authorizeService.isAuthenticated);
    if (isAuthenticated) {
      const userRoles = await firstValueFrom(this.authorizeService.getRoles());
      if (route.data['roles'] && !route.data['roles'].some((role: string) => userRoles.includes(role))) {
        await this.router.navigate(['']);
        return false;
      }
      return true;
    } else {
      this.authorizeService.login();
    }

    return false;
  }
}
