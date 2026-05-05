import {
  effect,
  inject,
  Injectable,
  InjectionToken,
  Injector,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  TitleStrategy,
} from '@angular/router';
import { BrandingDataSource } from './branding-data-source.service';

/**
 * Optional function the host supplies to translate a breadcrumb key from
 * `route.data['breadcrumb']` into a localized string. The library has no i18n
 * dependency; without a translator the breadcrumb key is rendered verbatim.
 */
export type OctoTitleTranslator = (key: string) => string;

export const OCTO_TITLE_TRANSLATOR = new InjectionToken<OctoTitleTranslator>(
  'OCTO_TITLE_TRANSLATOR',
);

/**
 * `TitleStrategy` that composes `<branding.appTitle> | <route.breadcrumb>`
 * into `document.title` on every navigation, and re-applies on
 * `BrandingDataSource.branding()` changes (e.g. after Settings save).
 *
 * Wire as the application's `TitleStrategy`:
 * ```ts
 * { provide: TitleStrategy, useExisting: AppTitleService }
 * ```
 *
 * Optional translation of the breadcrumb key is supplied through
 * {@link OCTO_TITLE_TRANSLATOR}; without it the key from `route.data` is used
 * as-is.
 *
 * `BrandingDataSource` is resolved lazily via `injector.get()` rather than
 * field-injected. The router constructs `TitleStrategy` eagerly during
 * `APP_INITIALIZER`, before the host's tenant config has loaded. A direct
 * field-inject of `BrandingDataSource` here would chain into Apollo's
 * factory, which reads `tenantId` while it is still `undefined` and bakes
 * `/tenants/undefined/GraphQL` into the request URI. Lazy resolution defers
 * the chain to the first navigation, by which time config is loaded.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleService extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translator = inject(OCTO_TITLE_TRANSLATOR, {
    optional: true,
  });
  private readonly injector = inject(Injector);

  private lastRouterState?: RouterStateSnapshot;
  private brandingEffectInitialized = false;

  override updateTitle(routerState: RouterStateSnapshot): void {
    this.lastRouterState = routerState;
    this.applyTitle();
    this.ensureBrandingSubscription();
  }

  private ensureBrandingSubscription(): void {
    if (this.brandingEffectInitialized) return;
    this.brandingEffectInitialized = true;
    effect(() => this.applyTitle(), { injector: this.injector });
  }

  private applyTitle(): void {
    if (!this.lastRouterState) return;
    const data = this.injector.get(BrandingDataSource).branding();
    const baseTitle = data.appTitle || data.appName;
    const breadcrumbKey = this.getDeepestBreadcrumb(this.lastRouterState.root);
    if (breadcrumbKey) {
      const resolved = this.translator
        ? this.translator(breadcrumbKey)
        : breadcrumbKey;
      this.title.setTitle(`${baseTitle} | ${resolved}`);
    } else {
      this.title.setTitle(baseTitle);
    }
  }

  private getDeepestBreadcrumb(
    route: ActivatedRouteSnapshot,
  ): string | undefined {
    let breadcrumb: string | undefined =
      typeof route.data['breadcrumb'] === 'string'
        ? route.data['breadcrumb']
        : undefined;
    for (const child of route.children) {
      const childBreadcrumb = this.getDeepestBreadcrumb(child);
      if (childBreadcrumb) {
        breadcrumb = childBreadcrumb;
      }
    }
    return breadcrumb;
  }
}
