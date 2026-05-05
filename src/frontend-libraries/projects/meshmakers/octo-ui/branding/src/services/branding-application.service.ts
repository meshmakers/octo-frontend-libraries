import { DOCUMENT, effect, inject, Injectable } from '@angular/core';
import {
  OCTO_BRANDING_FALLBACK_ASSETS,
  OctoBrandingFallbackAssets,
} from '../branding.tokens';
import { BrandingData } from '../models/branding.models';
import { ThemePalette } from '../models/theme.models';
import { BrandingDataSource } from './branding-data-source.service';
import { ThemeService } from './theme.service';

type ColorPaletteShades = Record<number, string>;

/**
 * Writes tenant branding (Kendo color vars, gradients, favicon, document
 * title) inline on <html>. An effect re-applies the correct palette when
 * either the theme mode or the branding data changes, so mode toggles after
 * a save don't leave stale inline values behind.
 */
@Injectable({ providedIn: 'root' })
export class BrandingApplicationService {
  private document = inject(DOCUMENT);
  private themeService = inject(ThemeService);
  private brandingDataSource = inject(BrandingDataSource);
  private fallbackAssets = inject(OCTO_BRANDING_FALLBACK_ASSETS, {
    optional: true,
  }) as OctoBrandingFallbackAssets | null;

  // Cleared before every apply so unset palette fields fall through to the
  // static layer-2 brand-default instead of sticking from a prior save.
  private static readonly BRANDED_VARS: readonly string[] = [
    ...['primary', 'secondary', 'tertiary'].flatMap((c) => [
      `--kendo-color-${c}`,
      `--kendo-color-${c}-hover`,
      `--kendo-color-${c}-active`,
      `--kendo-color-on-${c}`,
      `--kendo-color-${c}-subtle`,
      `--kendo-color-${c}-subtle-hover`,
      `--kendo-color-${c}-subtle-active`,
      `--kendo-color-${c}-emphasis`,
      `--kendo-color-${c}-on-subtle`,
      `--kendo-color-${c}-on-surface`,
    ]),
    '--kendo-color-base',
    '--kendo-color-base-hover',
    '--kendo-color-base-active',
    '--kendo-color-on-base',
    '--kendo-color-base-subtle',
    '--kendo-color-base-subtle-hover',
    '--kendo-color-base-subtle-active',
    '--kendo-color-base-emphasis',
    '--kendo-color-base-on-subtle',
    '--kendo-color-subtle',
    '--kendo-color-border',
    '--kendo-color-border-alt',
    '--kendo-color-app-surface',
    '--kendo-color-on-app-surface',
    '--app-header-gradient-start',
    '--app-header-gradient-end',
    '--app-header-text',
    '--app-footer-gradient-start',
    '--app-footer-gradient-end',
    '--app-footer-text',
  ];

  constructor() {
    effect(() => {
      const isDark = this.themeService.isDark();
      const data = this.brandingDataSource.branding();

      // Tenant disabled dark-theme override (single-theme app) — force light
      // mode. Without this guard a stale 'dark' in localStorage (or system
      // prefers-color-scheme) carries over and we'd render light palette
      // values into html[data-theme='dark']: surface ladder collapses to
      // white and text becomes unreadable. ThemeSwitcherComponent also
      // disables the toggle when darkTheme is null so the user can't
      // re-enter this state interactively.
      if (data.darkTheme === null && isDark) {
        this.themeService.setDark(false);
        return;
      }

      const palette = isDark ? data.darkTheme! : data.lightTheme;
      this.apply(data, palette);
    });
  }

  apply(data: BrandingData, palette: ThemePalette): void {
    this.clearInlineBrandingVars();
    this.applyThemeColors(palette);
    this.applyFavicon(data.faviconUrl);
    // document.title is owned by AppTitleService (TitleStrategy) — it composes
    // `${branding().appName} | ${routeBreadcrumb}` per navigation. Setting
    // title here would race AppTitleService and overwrite the route portion
    // (e.g. /settings would flicker from "TecLink | Settings" to just "TecLink"
    // when branding finishes loading). The tab updates on next navigation
    // after a tenant edits appName/appTitle in Settings — acceptable trade-off.
  }

  applyThemeColors(palette: ThemePalette): void {
    const root = this.document.documentElement;

    if (palette.primaryColor) {
      this.applyColorPalette(root, 'primary', palette.primaryColor);
    }
    if (palette.secondaryColor) {
      this.applyColorPalette(root, 'secondary', palette.secondaryColor);
    }
    if (palette.tertiaryColor) {
      this.applyColorPalette(root, 'tertiary', palette.tertiaryColor);
    }
    if (palette.neutralColor) {
      this.applyNeutralColors(root, palette.neutralColor);
    }

    this.setIf(root, '--app-header-gradient-start', palette.headerGradient.startColor);
    this.setIf(root, '--app-header-gradient-end', palette.headerGradient.endColor);
    if (palette.headerGradient.startColor) {
      root.style.setProperty(
        '--app-header-text',
        this.getContrastColor(palette.headerGradient.startColor),
      );
    }
    this.setIf(root, '--app-footer-gradient-start', palette.footerGradient.startColor);
    this.setIf(root, '--app-footer-gradient-end', palette.footerGradient.endColor);
    if (palette.footerGradient.startColor) {
      root.style.setProperty(
        '--app-footer-text',
        this.getContrastColor(palette.footerGradient.startColor),
      );
    }

    if (palette.backgroundColor) {
      // Only write the root surface — --kendo-color-surface / -surface-alt /
      // -base / -border are aliased in styles.scss to --color-surface-* shades
      // that derive from --color-surface (= app-surface) via mode-aware
      // color-mix. Writing them directly here would collapse the shade ladder
      // (all surfaces flat = same colour → transparent-looking components).
      root.style.setProperty('--kendo-color-app-surface', palette.backgroundColor);
      // Contrast text on the surface — without this, a dark backgroundColor in
      // light mode (or vice versa) renders text against an inverted surface
      // and becomes unreadable. --color-on-surface in styles.scss aliases this.
      root.style.setProperty(
        '--kendo-color-on-app-surface',
        this.getContrastColor(palette.backgroundColor),
      );
    }
  }

  applyFavicon(faviconUrl: string | null): void {
    const href = faviconUrl ?? this.fallbackAssets?.favicon;
    if (!href) return;

    let link = this.document.querySelector<HTMLLinkElement>(
      "link[rel~='icon']",
    );
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'icon';
      this.document.head.appendChild(link);
    }
    link.href = href;
  }

  private clearInlineBrandingVars(): void {
    const root = this.document.documentElement;
    for (const name of BrandingApplicationService.BRANDED_VARS) {
      root.style.removeProperty(name);
    }
  }

  private setIf(
    root: HTMLElement,
    name: string,
    value: string | null | undefined,
  ): void {
    if (value) root.style.setProperty(name, value);
  }

  private applyColorPalette(
    root: HTMLElement,
    colorName: string,
    baseColor: string,
  ): void {
    const palette = this.generatePalette(baseColor);

    root.style.setProperty(`--kendo-color-${colorName}`, palette[40]);
    root.style.setProperty(`--kendo-color-${colorName}-hover`, palette[50]);
    root.style.setProperty(`--kendo-color-${colorName}-active`, palette[60]);
    root.style.setProperty(
      `--kendo-color-on-${colorName}`,
      this.getContrastColor(palette[40]),
    );
    root.style.setProperty(`--kendo-color-${colorName}-subtle`, palette[90]);
    root.style.setProperty(
      `--kendo-color-${colorName}-subtle-hover`,
      palette[80],
    );
    root.style.setProperty(
      `--kendo-color-${colorName}-subtle-active`,
      palette[70],
    );
    root.style.setProperty(`--kendo-color-${colorName}-emphasis`, palette[70]);
    root.style.setProperty(
      `--kendo-color-${colorName}-on-subtle`,
      palette[20],
    );
    root.style.setProperty(
      `--kendo-color-${colorName}-on-surface`,
      palette[40],
    );
  }

  private applyNeutralColors(root: HTMLElement, baseColor: string): void {
    const palette = this.generatePalette(baseColor);

    root.style.setProperty('--kendo-color-base', palette[95]);
    root.style.setProperty('--kendo-color-base-hover', palette[90]);
    root.style.setProperty('--kendo-color-base-active', palette[80]);
    root.style.setProperty('--kendo-color-on-base', palette[20]);
    root.style.setProperty('--kendo-color-base-subtle', palette[90]);
    root.style.setProperty('--kendo-color-base-subtle-hover', palette[80]);
    root.style.setProperty('--kendo-color-base-subtle-active', palette[70]);
    root.style.setProperty('--kendo-color-base-emphasis', palette[70]);
    root.style.setProperty('--kendo-color-base-on-subtle', palette[20]);
    root.style.setProperty('--kendo-color-subtle', palette[40]);
    root.style.setProperty('--kendo-color-border', palette[80]);
    root.style.setProperty('--kendo-color-border-alt', palette[70]);
  }

  // ---------------------------------------------------------------------------
  // Palette generation (ported from energy-community theme.service.ts)
  // ---------------------------------------------------------------------------
  generatePalette(baseColor: string): ColorPaletteShades {
    const rgb = this.hexToRgb(baseColor);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    const palette: ColorPaletteShades = {
      0: '#000000',
      100: '#ffffff',
    };

    palette[40] = baseColor;

    const baseL = hsl.l;
    const baseS = hsl.s;
    const baseH = hsl.h;

    const lighten = (amount: number): number => Math.min(1, baseL + amount);
    const darken = (amount: number): number => Math.max(0, baseL - amount);

    palette[50] = this.hslToHex(baseH, Math.min(1, baseS * 1.15), darken(0.12));
    palette[60] = this.hslToHex(baseH, Math.min(1, baseS * 1.08), darken(0.08));
    palette[70] = this.hslToHex(baseH, Math.max(0.25, baseS * 0.85), lighten(0.08));
    palette[80] = this.hslToHex(baseH, Math.max(0.15, baseS * 0.6), lighten(0.22));
    palette[90] = this.hslToHex(baseH, Math.max(0.08, baseS * 0.35), lighten(0.38));
    palette[95] = this.hslToHex(baseH, Math.max(0.04, baseS * 0.2), lighten(0.43));
    palette[98] = this.hslToHex(baseH, Math.max(0.02, baseS * 0.12), lighten(0.46));
    palette[99] = this.hslToHex(baseH, Math.max(0.01, baseS * 0.08), lighten(0.47));

    palette[10] = this.hslToHex(baseH, Math.min(1, baseS * 1.4), darken(0.72));
    palette[20] = this.hslToHex(baseH, Math.min(1, baseS * 1.25), darken(0.62));
    palette[25] = this.hslToHex(baseH, Math.min(1, baseS * 1.2), darken(0.57));
    palette[30] = this.hslToHex(baseH, Math.min(1, baseS * 1.15), darken(0.52));
    palette[35] = this.hslToHex(baseH, Math.min(1, baseS * 1.1), darken(0.42));

    return palette;
  }

  private hexToRgb(color: string): { r: number; g: number; b: number } {
    const hexResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (hexResult) {
      return {
        r: parseInt(hexResult[1], 16),
        g: parseInt(hexResult[2], 16),
        b: parseInt(hexResult[3], 16),
      };
    }
    const rgbResult = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
    if (rgbResult) {
      return {
        r: parseInt(rgbResult[1], 10),
        g: parseInt(rgbResult[2], 10),
        b: parseInt(rgbResult[3], 10),
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  private rgbToHsl(
    r: number,
    g: number,
    b: number,
  ): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case rn:
          h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
          break;
        case gn:
          h = ((bn - rn) / d + 2) / 6;
          break;
        case bn:
          h = ((rn - gn) / d + 4) / 6;
          break;
      }
    }

    return { h, s, l };
  }

  private hslToHex(h: number, s: number, l: number): string {
    let r: number;
    let g: number;
    let b: number;

    if (s === 0) {
      r = l;
      g = l;
      b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        let tn = t;
        if (tn < 0) tn += 1;
        if (tn > 1) tn -= 1;
        if (tn < 1 / 6) return p + (q - p) * 6 * tn;
        if (tn < 1 / 2) return q;
        if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return this.rgbToHex(
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255),
    );
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = Math.round(x).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
    );
  }

  private getContrastColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }
}
