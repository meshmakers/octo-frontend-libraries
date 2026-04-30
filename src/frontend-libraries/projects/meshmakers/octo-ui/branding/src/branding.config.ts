import {
  EnvironmentProviders,
  makeEnvironmentProviders,
  Provider,
} from '@angular/core';
import { TitleStrategy } from '@angular/router';
import { BrandingData } from './models/branding.models';
import {
  NEUTRAL_BRANDING_DEFAULTS,
  NEUTRAL_FALLBACK_ASSETS,
  OCTO_BRANDING_DEFAULTS,
  OCTO_BRANDING_FALLBACK_ASSETS,
  OctoBrandingFallbackAssets,
} from './branding.tokens';
import { AppTitleService } from './services/app-title.service';

export interface OctoBrandingConfig {
  /** Caller-supplied defaults; merged shallowly over `NEUTRAL_BRANDING_DEFAULTS`. */
  defaults?: Partial<BrandingData>;
  /** Bundled URLs used when the tenant has not uploaded a logo / favicon. */
  fallbackAssets?: OctoBrandingFallbackAssets;
  /**
   * When `true` (default) the library binds {@link AppTitleService} as the
   * application's `TitleStrategy`, so `document.title` automatically reflects
   * `<branding.appTitle> | <route.breadcrumb>` on every navigation. Set to
   * `false` if the host already provides its own `TitleStrategy`.
   */
  registerTitleStrategy?: boolean;
}

/**
 * Registers branding tokens, defaults, fallback assets, and (by default) the
 * `TitleStrategy` that drives `document.title` from the branding signal.
 *
 * Does **not** load the tenant's branding record. Loading must happen after
 * authentication is settled (Apollo's URI bakes in the tenant ID at the time
 * the first request fires; loading too early targets
 * `/tenants/undefined/GraphQL`). The host shell typically does:
 *
 * ```ts
 * inject(BrandingApplicationService); // start the apply effect
 * effect(() => {
 *   if (this.auth.isAuthenticated()) {
 *     this.brandingDataSource.load();
 *   }
 * });
 * ```
 *
 * `BrandingApplicationService` is `providedIn: 'root'`, so the host only has
 * to inject it once to activate the apply effect.
 */
export function provideOctoBranding(
  config?: OctoBrandingConfig,
): EnvironmentProviders {
  const merged: BrandingData = {
    ...NEUTRAL_BRANDING_DEFAULTS,
    ...(config?.defaults ?? {}),
    lightTheme: {
      ...NEUTRAL_BRANDING_DEFAULTS.lightTheme,
      ...(config?.defaults?.lightTheme ?? {}),
    },
    darkTheme:
      config?.defaults?.darkTheme === null
        ? null
        : {
            ...(NEUTRAL_BRANDING_DEFAULTS.darkTheme ??
              NEUTRAL_BRANDING_DEFAULTS.lightTheme),
            ...(config?.defaults?.darkTheme ?? {}),
          },
  };

  const providers: Provider[] = [
    { provide: OCTO_BRANDING_DEFAULTS, useValue: merged },
    {
      provide: OCTO_BRANDING_FALLBACK_ASSETS,
      useValue: config?.fallbackAssets ?? NEUTRAL_FALLBACK_ASSETS,
    },
  ];

  if (config?.registerTitleStrategy !== false) {
    providers.push({ provide: TitleStrategy, useExisting: AppTitleService });
  }

  return makeEnvironmentProviders(providers);
}
