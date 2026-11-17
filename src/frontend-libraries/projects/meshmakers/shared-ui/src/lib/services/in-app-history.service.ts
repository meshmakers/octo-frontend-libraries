import { DestroyRef, EnvironmentProviders, inject, Injectable, provideEnvironmentInitializer } from '@angular/core';
import { Location } from '@angular/common';
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationExtras,
  NavigationSkipped,
  NavigationStart,
  Router,
  UrlTree
} from '@angular/router';

/**
 * Key of the history state entry that holds how many entries of this app lie before the current one.
 * Kept in `history.state`, so it survives a reload and browser Back/Forward.
 */
export const IN_APP_HISTORY_DEPTH_STATE_KEY = 'mmInAppHistoryDepth';

/**
 * Knows whether the previous browser history entry belongs to this app, so "Back" and "Cancel" buttons stay in the
 * app.
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
 * Where the service cannot be sure, it counts low, so {@link back} falls back to the route rather than leave the app:
 * an entry without a counter (created before the service ran, or by code outside the router) counts as the first
 * one, and a navigation that started with browser Back/Forward (also when a guard cancels or redirects it) takes the
 * counter of the entry the browser moved to.
 *
 * The service must run from the first navigation on: it is started by `provideMmSharedUi()` (or
 * {@link provideInAppHistory} for apps without it). It supports the router's default history handling
 * (`HistoryStateManager`), not the experimental Navigation API integration; there it only falls back more often.
 */
@Injectable({ providedIn: 'root' })
export class InAppHistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Depth of the current history entry; `undefined` until the first navigation was seen. */
  private depth: number | undefined;
  /** Browser path of the current entry when its depth was last set (the router replaces an entry for the same path). */
  private lastPath: string | undefined;
  /**
   * Depth of the entry browser Back/Forward moved to, from its `NavigationStart` until the navigation (or the redirect
   * that continues it) ends; `undefined` outside such a navigation.
   */
  private popstateTargetDepth: number | undefined;

  constructor() {
    const subscription = this.router.events.subscribe(event => this.onRouterEvent(event));
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /** True when the previous browser history entry is a page of this app, as far as the service can tell. */
  canGoBack(): boolean {
    return (this.depth ?? 0) > 0;
  }

  /**
   * Goes back to the previous page of this app, or, when there is none, navigates to `fallback` and replaces the
   * current history entry. Route guards (e.g. the unsaved-changes guard) run in both cases.
   *
   * The returned promise never rejects, so a button handler can drop it: a failed fallback navigation (e.g. a lazy
   * chunk that no longer loads after a deploy) is logged and resolves `false`, and the user stays on the page.
   *
   * @param fallback Absolute router commands or a URL tree used when the previous entry is not a page of this app.
   * @param extras Extras of the fallback navigation; `replaceUrl` is always set.
   * @returns For the fallback, the result of the navigation (`false` when refused or failed); `true` when the browser
   * was sent back (that navigation runs after the promise resolved).
   */
  async back(fallback: readonly unknown[] | UrlTree, extras: NavigationExtras = {}): Promise<boolean> {
    if (this.canGoBack()) {
      this.location.back();
      return true;
    }
    const navigationExtras: NavigationExtras = { ...extras, replaceUrl: true };
    try {
      return await (fallback instanceof UrlTree
        ? this.router.navigateByUrl(fallback, navigationExtras)
        : this.router.navigate([...fallback], navigationExtras));
    } catch (error) {
      console.error('Navigation to the fallback route failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  private onRouterEvent(event: RouterEvent): void {
    if (event instanceof NavigationStart) {
      if (event.navigationTrigger === 'popstate') {
        this.popstateTargetDepth = InAppHistoryService.depthOf(event.restoredState) ?? 0;
      }
    } else if (event instanceof NavigationEnd) {
      this.onNavigationEnd();
      this.popstateTargetDepth = undefined;
    } else if (event instanceof NavigationCancel) {
      if (event.code === NavigationCancellationCode.Redirect
        || event.code === NavigationCancellationCode.SupersededByNewNavigation) {
        // Another navigation continues this one; it decides the depth.
        return;
      }
      this.onNavigationAborted();
    } else if (event instanceof NavigationError) {
      this.onNavigationAborted();
    } else if (event instanceof NavigationSkipped) {
      this.popstateTargetDepth = undefined;
    }
  }

  private onNavigationEnd(): void {
    const navigation = this.router.lastSuccessfulNavigation();
    if (navigation?.extras.skipLocationChange) {
      return;
    }

    const stored = this.storedDepth();
    const path = this.location.path();
    let depth: number;
    if (this.popstateTargetDepth !== undefined) {
      // Browser Back/Forward, also when a guard redirected it: the browser is on the entry it moved to.
      depth = stored ?? this.popstateTargetDepth;
    } else if (this.depth === undefined || !navigation?.previousNavigation) {
      // First page of this document or a reload: the entry carries its own depth, or it is the first of the app.
      depth = stored ?? 0;
    } else if (navigation.extras.replaceUrl || path === this.lastPath) {
      // The router replaced the current entry (it also does so when the browser path stays the same).
      depth = this.depth;
    } else {
      depth = this.depth + 1;
    }
    this.setDepth(depth, stored);
  }

  /**
   * A navigation was refused (a guard said no) or failed. The router then rewrites the current entry without the
   * counter; after browser Back/Forward the browser also stays on the entry it moved to.
   */
  private onNavigationAborted(): void {
    const target = this.popstateTargetDepth;
    this.popstateTargetDepth = undefined;
    const depth = target ?? this.depth;
    if (depth === undefined) {
      return;
    }
    this.setDepth(depth, this.storedDepth());
  }

  private setDepth(depth: number, stored: number | undefined): void {
    this.depth = depth;
    this.lastPath = this.location.path();
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
    return InAppHistoryService.depthOf(this.currentState());
  }

  private static depthOf(state: unknown): number | undefined {
    if (state === null || typeof state !== 'object') {
      return undefined;
    }
    const value = (state as Record<string, unknown>)[IN_APP_HISTORY_DEPTH_STATE_KEY];
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
