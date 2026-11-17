import { DestroyRef, EnvironmentProviders, inject, Injectable, provideEnvironmentInitializer } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, NavigationExtras, Router, UrlTree } from '@angular/router';

/**
 * Key of the history state entry that holds how many entries of this app lie before the current one.
 * Kept in `history.state`, so it survives a reload and browser Back/Forward.
 */
export const IN_APP_HISTORY_DEPTH_STATE_KEY = 'mmInAppHistoryDepth';

/**
 * Knows whether the previous browser history entry belongs to this app, so "Back" and "Cancel" buttons never
 * leave the app.
 *
 * `location.back()` alone leaves the app when the page was opened directly (a link, a new tab, a bookmark or the
 * return from the login page): the previous entry is then a foreign page or none at all, and a form with unsaved
 * changes makes the browser ask "Leave site?". The router's navigation record cannot tell this either, because it
 * starts empty after every page load while the browser history keeps the app's earlier entries.
 *
 * The service therefore writes a depth counter into the state of every history entry the router creates:
 * 0 for the first entry of the app, +1 for every pushed entry, unchanged for a replaced one. Browser Back/Forward
 * and a reload restore the counter of their entry. {@link back} goes back only when the depth is above 0, and
 * otherwise navigates to the fallback route with `replaceUrl`, so the browser's back button does not return to the
 * page that was left.
 *
 * The service must run from the first navigation on: it is started by `provideMmSharedUi()` (or
 * {@link provideInAppHistory} for apps without it). Started later, it counts from the entry it sees first, which
 * only makes {@link back} fall back to the route more often, never leave the app.
 */
@Injectable({ providedIn: 'root' })
export class InAppHistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Depth of the current history entry; `undefined` until the first navigation was seen. */
  private depth: number | undefined;
  private lastUrl: string | undefined;

  constructor() {
    const subscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.onNavigationEnd(event);
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /** True when the previous browser history entry is a page of this app. */
  canGoBack(): boolean {
    return (this.depth ?? 0) > 0;
  }

  /**
   * Goes back to the previous page of this app, or, when there is none, navigates to `fallback` and replaces the
   * current history entry. Route guards (e.g. the unsaved-changes guard) run in both cases.
   *
   * @param fallback Absolute router commands or a URL tree used when the previous entry is not a page of this app.
   * @param extras Extras of the fallback navigation; `replaceUrl` is always set.
   * @returns For the fallback, the result of the navigation; `true` when the browser was sent back.
   */
  async back(fallback: readonly unknown[] | UrlTree, extras: NavigationExtras = {}): Promise<boolean> {
    if (this.canGoBack()) {
      this.location.back();
      return true;
    }
    const navigationExtras: NavigationExtras = { ...extras, replaceUrl: true };
    return fallback instanceof UrlTree
      ? this.router.navigateByUrl(fallback, navigationExtras)
      : this.router.navigate([...fallback], navigationExtras);
  }

  private onNavigationEnd(event: NavigationEnd): void {
    const navigation = this.router.lastSuccessfulNavigation();
    if (navigation?.extras.skipLocationChange) {
      return;
    }

    const stored = this.storedDepth();
    let depth: number;
    if (this.depth === undefined || !navigation?.previousNavigation || navigation.trigger === 'popstate') {
      // First page of this document, a reload, or browser Back/Forward: the entry carries its own depth. An entry
      // without one is the first of the app (or was created before this service ran).
      depth = stored ?? 0;
    } else if (navigation.extras.replaceUrl || event.urlAfterRedirects === this.lastUrl) {
      // The router replaced the current entry (it also does so for a navigation to the same URL).
      depth = this.depth;
    } else {
      depth = this.depth + 1;
    }

    this.depth = depth;
    this.lastUrl = event.urlAfterRedirects;
    if (stored !== depth) {
      const state = this.currentState();
      this.location.replaceState(this.location.path(true), '', { ...state, [IN_APP_HISTORY_DEPTH_STATE_KEY]: depth });
    }
  }

  private currentState(): Record<string, unknown> {
    const state = this.location.getState();
    return state !== null && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  }

  private storedDepth(): number | undefined {
    const value = this.currentState()[IN_APP_HISTORY_DEPTH_STATE_KEY];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
  }
}

/**
 * Starts {@link InAppHistoryService} with the application, so it sees the first navigation. Included in
 * `provideMmSharedUi()`; use it directly only in apps that do not call that.
 */
export function provideInAppHistory(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    inject(InAppHistoryService);
  });
}
