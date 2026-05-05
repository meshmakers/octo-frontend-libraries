import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CreateBrandingDtoGQL,
  CreateBrandingMutationDto,
} from '../graphQL/createBranding';
import {
  GetBrandingDtoGQL,
  GetBrandingQueryDto,
} from '../graphQL/getBranding';
import {
  SystemUiBrandingInputDto,
  SystemUiThemePaletteInputDto,
} from '../graphQL/globalTypes';
import {
  UpdateBrandingDtoGQL,
  UpdateBrandingMutationDto,
} from '../graphQL/updateBranding';
import { OCTO_BRANDING_DEFAULTS } from '../branding.tokens';
import { BrandingData, BrandingUpdate } from '../models/branding.models';
import { ThemePalette } from '../models/theme.models';

const WELL_KNOWN_NAME = 'Branding';

type QueryItem = NonNullable<
  NonNullable<
    NonNullable<
      NonNullable<GetBrandingQueryDto['runtime']>['systemUIBranding']
    >['items']
  >[number]
>;

type CreateItem = NonNullable<
  NonNullable<
    NonNullable<
      NonNullable<CreateBrandingMutationDto['runtime']>['systemUIBrandings']
    >['create']
  >[number]
>;

type UpdateItem = NonNullable<
  NonNullable<
    NonNullable<
      NonNullable<UpdateBrandingMutationDto['runtime']>['systemUIBrandings']
    >['update']
  >[number]
>;

/** Shared structural shape across get/create/update — identical selection sets. */
type ServerBranding = QueryItem & CreateItem & UpdateItem;

type ServerPalette = NonNullable<QueryItem['lightTheme']>;

/**
 * Per-tenant branding. Source of truth is the `SystemUIBranding`
 * CK runtime entity (one record per tenant, `rtWellKnownName = 'Branding'`).
 * Loaded via GraphQL, mirrored into a signal for consumers.
 */
@Injectable({ providedIn: 'root' })
export class BrandingDataSource {
  private readonly getBrandingGQL = inject(GetBrandingDtoGQL);
  private readonly createBrandingGQL = inject(CreateBrandingDtoGQL);
  private readonly updateBrandingGQL = inject(UpdateBrandingDtoGQL);

  private readonly defaults = inject(OCTO_BRANDING_DEFAULTS);

  private readonly state = signal<BrandingData>({ ...this.defaults });
  readonly branding = this.state.asReadonly();

  async load(): Promise<void> {
    // `no-cache` (not `network-only`): Apollo's `InMemoryCache` normalizes
    // entities by `rtId`, but the singleton `RuntimeModelQuery` type has no
    // id — cache writes for `runtime.systemUIBranding`
    // clobber sibling fields (e.g. `runtime.basicTree` used by plant
    // hierarchy + /location). `no-cache` fetches from network AND skips
    // writing to cache, so /location keeps its hierarchy cache intact.
    const result = await firstValueFrom(
      this.getBrandingGQL.fetch({ fetchPolicy: 'no-cache' }),
    );
    const item =
      result.data?.runtime?.systemUIBranding?.items?.[0];
    if (!item) {
      this.state.set({ ...this.defaults });
      return;
    }
    this.state.set(await this.mapFromServer(item));
  }

  async save(update: BrandingUpdate): Promise<BrandingData> {
    const current = this.state();
    const input = await this.buildInput(update);
    const saved = current.rtId
      ? await this.runUpdate(current.rtId, input)
      : await this.runCreate(input);
    const mapped = await this.mapFromServer(saved);
    this.state.set(mapped);
    return mapped;
  }

  async resetToDefaults(): Promise<void> {
    await this.save({
      appName: this.defaults.appName,
      appTitle: this.defaults.appTitle,
      headerLogoFile: null,
      footerLogoFile: null,
      faviconFile: null,
      lightTheme: this.defaults.lightTheme,
      darkTheme: this.defaults.darkTheme,
    });
  }

  private async buildInput(
    update: BrandingUpdate,
  ): Promise<SystemUiBrandingInputDto> {
    const [headerLogo, footerLogo, favicon] = await Promise.all([
      this.prepareBinary(update.headerLogoFile),
      this.prepareBinary(update.footerLogoFile),
      this.prepareBinary(update.faviconFile),
    ]);

    const input: SystemUiBrandingInputDto = {
      rtWellKnownName: WELL_KNOWN_NAME,
      appName: update.appName,
      appTitle: update.appTitle,
      lightTheme: this.paletteToInput(update.lightTheme),
      darkTheme: update.darkTheme ? this.paletteToInput(update.darkTheme) : null,
    };

    // Tri-state: set the field only on replace (bytes) or clear (null);
    // omit when undefined so the server keeps the current blob.
    if (headerLogo !== undefined) input.headerLogo = headerLogo;
    if (footerLogo !== undefined) input.footerLogo = footerLogo;
    if (favicon !== undefined) input.favicon = favicon;

    return input;
  }

  private async runCreate(
    input: SystemUiBrandingInputDto,
  ): Promise<ServerBranding> {
    const result = await firstValueFrom(
      this.createBrandingGQL.mutate({
        variables: { branding: input },
        fetchPolicy: 'no-cache',
      }),
    );
    const item =
      result.data?.runtime?.systemUIBrandings?.create?.[0];
    if (!item) {
      throw new Error('createBranding returned no entity');
    }
    return item;
  }

  private async runUpdate(
    rtId: string,
    input: SystemUiBrandingInputDto,
  ): Promise<ServerBranding> {
    const result = await firstValueFrom(
      this.updateBrandingGQL.mutate({
        variables: { branding: { rtId, item: input } },
        fetchPolicy: 'no-cache',
      }),
    );
    const item =
      result.data?.runtime?.systemUIBrandings?.update?.[0];
    if (!item) {
      throw new Error('updateBranding returned no entity');
    }
    return item;
  }

  private paletteToInput(
    palette: ThemePalette,
  ): SystemUiThemePaletteInputDto {
    return {
      primaryColor: palette.primaryColor,
      secondaryColor: palette.secondaryColor,
      tertiaryColor: palette.tertiaryColor,
      neutralColor: palette.neutralColor,
      backgroundColor: palette.backgroundColor,
      headerGradient: {
        startColor: palette.headerGradient.startColor,
        endColor: palette.headerGradient.endColor,
      },
      footerGradient: {
        startColor: palette.footerGradient.startColor,
        endColor: palette.footerGradient.endColor,
      },
    };
  }

  private async mapFromServer(item: ServerBranding): Promise<BrandingData> {
    // `Binary` attribute in the ckType surfaces as GraphQL `[Byte]` (raw byte
    // array scalar). Client converts to a data URL locally for <img src>.
    // No second HTTP round-trip like the `BinaryLinked`/`LargeBinaryInfo`
    // pattern (which would return a downloadUri to fetch).
    const [headerLogoUrl, footerLogoUrl, faviconUrl] = await Promise.all([
      this.bytesToDataUrl(item.headerLogo),
      this.bytesToDataUrl(item.footerLogo),
      this.bytesToDataUrl(item.favicon),
    ]);

    return {
      rtId: item.rtId,
      appName: item.appName ?? this.defaults.appName,
      appTitle: item.appTitle ?? this.defaults.appTitle,
      headerLogoUrl: headerLogoUrl,
      footerLogoUrl: footerLogoUrl,
      faviconUrl: faviconUrl,
      lightTheme:
        this.paletteFromServer(item.lightTheme, this.defaults.lightTheme) ??
        this.defaults.lightTheme,
      darkTheme: this.paletteFromServer(
        item.darkTheme,
        this.defaults.darkTheme ?? this.defaults.lightTheme,
      ),
    };
  }

  // Defaults are passed in so light/dark palettes fall back to their own
  // defaults instead of always using lightTheme defaults (matters when only
  // partial dark palette comes from server).
  private paletteFromServer(
    palette: ServerPalette | null | undefined,
    defaults: ThemePalette,
  ): ThemePalette | null {
    if (!palette) return null;
    const { headerGradient, footerGradient } = palette;
    return {
      primaryColor: palette.primaryColor ?? defaults.primaryColor,
      secondaryColor: palette.secondaryColor ?? defaults.secondaryColor,
      tertiaryColor: palette.tertiaryColor ?? defaults.tertiaryColor,
      neutralColor: palette.neutralColor ?? defaults.neutralColor,
      backgroundColor: palette.backgroundColor ?? defaults.backgroundColor,
      headerGradient: headerGradient
        ? { startColor: headerGradient.startColor, endColor: headerGradient.endColor }
        : defaults.headerGradient,
      footerGradient: footerGradient
        ? { startColor: footerGradient.startColor, endColor: footerGradient.endColor }
        : defaults.footerGradient,
    };
  }

  /**
   * Convert a byte array from a GraphQL `[Byte]` field into a data URL.
   * Returns null for null/undefined/empty input. MIME type is detected from
   * the first few bytes (magic numbers) so <img src> works without a
   * server-provided content-type.
   */
  private async bytesToDataUrl(
    bytes: readonly (number | null)[] | null | undefined,
  ): Promise<string | null> {
    if (!bytes || bytes.length === 0) return null;
    // Codegen types `[Byte]` entries as `number | null`; strip nulls.
    const clean = bytes.filter((b): b is number => typeof b === 'number');
    if (clean.length === 0) return null;
    const uint8 = new Uint8Array(clean);
    const mime = this.detectImageMime(uint8) ?? 'application/octet-stream';
    try {
      return await this.blobToDataUrl(new Blob([uint8], { type: mime }));
    } catch (error) {
      console.warn('[BrandingDataSource] Failed to decode image bytes', error);
      return null;
    }
  }

  private detectImageMime(bytes: Uint8Array): string | null {
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
    if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return 'image/vnd.microsoft.icon';
    if (bytes.length >= 5 && bytes[0] === 0x3c && bytes[1] === 0x3f && bytes[2] === 0x78 && bytes[3] === 0x6d && bytes[4] === 0x6c) return 'image/svg+xml';
    // UTF-8 BOM-less SVG starts with '<svg'
    if (bytes.length >= 4 && bytes[0] === 0x3c && bytes[1] === 0x73 && bytes[2] === 0x76 && bytes[3] === 0x67) return 'image/svg+xml';
    return null;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('FileReader returned non-string result'));
        }
      };
      reader.onerror = (): void =>
        reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Three-value binary resolution for save():
   * - `null` → caller wants the asset cleared; forward null to the server.
   * - `undefined` → caller left the slot untouched; omit the field so the
   *   server keeps the existing blob.
   * - `File` → caller uploaded a new asset; serialize to byte array.
   */
  private async prepareBinary(
    file: File | null | undefined,
  ): Promise<number[] | null | undefined> {
    if (file === null) return null;
    if (file === undefined) return undefined;
    const buffer = await file.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  }
}
