import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  CanDeactivate,
  CanLoad, Route,
  Router,
  RouterStateSnapshot, UrlSegment,
  UrlTree
} from '@angular/router';
import { AuthorizeService } from './authorize.service';
import { firstValueFrom, lastValueFrom, Observable } from 'rxjs';

@Injectable()
export class AuthorizeGuard implements CanActivate, CanActivateChild, CanDeactivate<unknown>, CanLoad {
  constructor(private readonly authorizeService: AuthorizeService, private readonly router: Router) {
  }

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const url: string = state.url;
    return this.handleAuthorization(next, url);
  }

  canActivateChild(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.canActivate(next, state);
  }

  canDeactivate(
    component: unknown,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return true;
  }

  canLoad(
    route: Route,
    segments: UrlSegment[]): Observable<boolean> | Promise<boolean> | boolean {
    return true;
  }

  private async handleAuthorization(route: ActivatedRouteSnapshot, url: any): Promise<boolean> {
    await this.authorizeService.initialize();

    const isAuthenticated = await firstValueFrom(this.authorizeService.getIsAuthenticated());
    if (isAuthenticated) {
      const userRoles = await firstValueFrom(this.authorizeService.getRoles());
      if (route.data['roles'] && !route.data['roles'].filter((value: string) => userRoles.includes(value))) {
        this.router.navigate(['']);
        return false;
      }
      return true;
    } else {
      this.authorizeService.login();
    }

    return false;
  }
}
