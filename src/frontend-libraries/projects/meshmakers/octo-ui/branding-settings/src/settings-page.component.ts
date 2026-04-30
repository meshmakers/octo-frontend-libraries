import { Component, inject, input, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  BrandingData,
  BrandingDataSource,
  OCTO_BRANDING_DEFAULTS,
  ThemePalette,
} from '@meshmakers/octo-ui/branding';
import { MessageService } from '@meshmakers/shared-services';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { LayoutModule } from '@progress/kendo-angular-layout';
import { saveIcon, undoIcon, xIcon } from '@progress/kendo-svg-icons';
import { BrandingSettingsMessages } from './branding-settings.messages';

type LogoSlotName = 'header' | 'footer' | 'favicon';

interface LogoSlot {
  file: File | null;
  preview: string | null;
  cleared: boolean;
}

const EMPTY_LOGO_SLOT: LogoSlot = {
  file: null,
  preview: null,
  cleared: false,
};

@Component({
  selector: 'mm-branding-settings',
  standalone: true,
  imports: [
    InputsModule,
    LabelModule,
    ButtonsModule,
    LayoutModule,
    ReactiveFormsModule,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  readonly messages = input.required<BrandingSettingsMessages>();

  private readonly fb = inject(FormBuilder);
  private readonly branding = inject(BrandingDataSource);
  private readonly messageService = inject(MessageService);
  private readonly defaults = inject(OCTO_BRANDING_DEFAULTS);

  protected readonly saveIcon = saveIcon;
  protected readonly undoIcon = undoIcon;
  protected readonly xIcon = xIcon;

  protected readonly logoSlotNames: readonly LogoSlotName[] = [
    'header',
    'footer',
    'favicon',
  ];

  protected readonly saving = signal(false);

  protected readonly settingsForm: FormGroup;

  private readonly slotStates = {
    header: signal<LogoSlot>({ ...EMPTY_LOGO_SLOT }),
    footer: signal<LogoSlot>({ ...EMPTY_LOGO_SLOT }),
    favicon: signal<LogoSlot>({ ...EMPTY_LOGO_SLOT }),
  } as const satisfies Record<LogoSlotName, unknown>;

  private readonly persistedUrls = {
    header: signal<string | null>(null),
    footer: signal<string | null>(null),
    favicon: signal<string | null>(null),
  } as const satisfies Record<LogoSlotName, unknown>;

  constructor() {
    const { lightTheme, darkTheme } = this.defaults;
    const dark = darkTheme ?? lightTheme;

    // Seeding color controls with valid hex defaults is required: kendo-colorpicker
    // binds as a ControlValueAccessor and doesn't handle initial empty strings
    // cleanly inside kendo-formfield.
    this.settingsForm = this.fb.group({
      appName: [this.defaults.appName, Validators.required],
      appTitle: [this.defaults.appTitle],

      lightPrimaryColor: [lightTheme.primaryColor, Validators.required],
      lightSecondaryColor: [lightTheme.secondaryColor, Validators.required],
      lightTertiaryColor: [lightTheme.tertiaryColor, Validators.required],
      lightNeutralColor: [lightTheme.neutralColor, Validators.required],
      lightBackgroundColor: [lightTheme.backgroundColor],
      lightHeaderGradientStart: [lightTheme.headerGradient.startColor],
      lightHeaderGradientEnd: [lightTheme.headerGradient.endColor],
      lightFooterGradientStart: [lightTheme.footerGradient.startColor],
      lightFooterGradientEnd: [lightTheme.footerGradient.endColor],

      darkThemeEnabled: [darkTheme !== null],

      darkPrimaryColor: [dark.primaryColor, Validators.required],
      darkSecondaryColor: [dark.secondaryColor, Validators.required],
      darkTertiaryColor: [dark.tertiaryColor, Validators.required],
      darkNeutralColor: [dark.neutralColor, Validators.required],
      darkBackgroundColor: [dark.backgroundColor],
      darkHeaderGradientStart: [dark.headerGradient.startColor],
      darkHeaderGradientEnd: [dark.headerGradient.endColor],
      darkFooterGradientStart: [dark.footerGradient.startColor],
      darkFooterGradientEnd: [dark.footerGradient.endColor],
    });
  }

  protected darkThemeEnabled(): boolean {
    return this.settingsForm.get('darkThemeEnabled')?.value === true;
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.branding.load();
    } catch (error) {
      console.error('[SettingsPageComponent] Failed to load branding', error);
      this.messageService.showError(this.messages().loadError);
      return;
    }
    this.hydrate(this.branding.branding());
  }

  protected onLogoSelected(slot: LogoSlotName, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      this.slotStates[slot].set({
        file,
        preview: typeof result === 'string' ? result : null,
        cleared: false,
      });
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  protected clearLogo(slot: LogoSlotName): void {
    this.slotStates[slot].set({ file: null, preview: null, cleared: true });
    this.persistedUrls[slot].set(null);
  }

  protected previewUrl(slot: LogoSlotName): string | null {
    return this.slotStates[slot]().preview ?? this.persistedUrls[slot]();
  }

  protected async onSubmit(): Promise<void> {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      await this.branding.save({
        appName: this.strValue('appName'),
        appTitle: this.strValue('appTitle'),
        headerLogoFile: this.logoFileForSave('header'),
        footerLogoFile: this.logoFileForSave('footer'),
        faviconFile: this.logoFileForSave('favicon'),
        lightTheme: this.paletteFromForm('light'),
        darkTheme: this.darkThemeEnabled() ? this.paletteFromForm('dark') : null,
      });
      this.messageService.showInformation(this.messages().saveSuccess);
      this.hydrate(this.branding.branding());
      this.settingsForm.markAsPristine();
    } catch (error) {
      console.error('[SettingsPageComponent] Failed to save branding', error);
      this.messageService.showError(this.messages().saveError);
    } finally {
      this.saving.set(false);
    }
  }

  protected async onResetDefaults(): Promise<void> {
    this.saving.set(true);
    try {
      await this.branding.resetToDefaults();
      this.hydrate(this.branding.branding());
      this.settingsForm.markAsPristine();
      this.messageService.showInformation(this.messages().resetSuccess);
    } catch (error) {
      console.error('[SettingsPageComponent] Failed to reset branding', error);
      this.messageService.showError(this.messages().saveError);
    } finally {
      this.saving.set(false);
    }
  }

  private hydrate(data: BrandingData): void {
    this.persistedUrls.header.set(data.headerLogoUrl);
    this.persistedUrls.footer.set(data.footerLogoUrl);
    this.persistedUrls.favicon.set(data.faviconUrl);

    for (const slot of this.logoSlotNames) {
      this.slotStates[slot].set({ ...EMPTY_LOGO_SLOT });
    }

    const dark =
      data.darkTheme ?? this.defaults.darkTheme ?? this.defaults.lightTheme;

    this.settingsForm.patchValue({
      appName: data.appName,
      appTitle: data.appTitle,
      darkThemeEnabled: data.darkTheme !== null,

      lightPrimaryColor: data.lightTheme.primaryColor,
      lightSecondaryColor: data.lightTheme.secondaryColor,
      lightTertiaryColor: data.lightTheme.tertiaryColor,
      lightNeutralColor: data.lightTheme.neutralColor,
      lightBackgroundColor: data.lightTheme.backgroundColor,
      lightHeaderGradientStart: data.lightTheme.headerGradient.startColor,
      lightHeaderGradientEnd: data.lightTheme.headerGradient.endColor,
      lightFooterGradientStart: data.lightTheme.footerGradient.startColor,
      lightFooterGradientEnd: data.lightTheme.footerGradient.endColor,

      darkPrimaryColor: dark.primaryColor,
      darkSecondaryColor: dark.secondaryColor,
      darkTertiaryColor: dark.tertiaryColor,
      darkNeutralColor: dark.neutralColor,
      darkBackgroundColor: dark.backgroundColor,
      darkHeaderGradientStart: dark.headerGradient.startColor,
      darkHeaderGradientEnd: dark.headerGradient.endColor,
      darkFooterGradientStart: dark.footerGradient.startColor,
      darkFooterGradientEnd: dark.footerGradient.endColor,
    });
  }

  private logoFileForSave(slot: LogoSlotName): File | null | undefined {
    const state = this.slotStates[slot]();
    if (state.file) return state.file;
    if (state.cleared) return null;
    return undefined;
  }

  private strValue(name: string): string {
    const value = this.settingsForm.get(name)?.value;
    return typeof value === 'string' ? value : '';
  }

  private paletteFromForm(kind: 'light' | 'dark'): ThemePalette {
    return {
      primaryColor: this.strValue(`${kind}PrimaryColor`),
      secondaryColor: this.strValue(`${kind}SecondaryColor`),
      tertiaryColor: this.strValue(`${kind}TertiaryColor`),
      neutralColor: this.strValue(`${kind}NeutralColor`),
      backgroundColor: this.strValue(`${kind}BackgroundColor`),
      headerGradient: {
        startColor: this.strValue(`${kind}HeaderGradientStart`),
        endColor: this.strValue(`${kind}HeaderGradientEnd`),
      },
      footerGradient: {
        startColor: this.strValue(`${kind}FooterGradientStart`),
        endColor: this.strValue(`${kind}FooterGradientEnd`),
      },
    };
  }

  // Used with `[formControl]` (not `formControlName`) on kendo-colorpicker:
  // FormControl directive accepts the control instance directly and avoids
  // FormControlName's @Self() injection that historically tripped on the
  // colorpicker's forwardRef NG_VALUE_ACCESSOR. Goes through Reactive Forms
  // properly (tracks dirty/touched/validators), unlike the old [value] +
  // (valueChange) workaround.
  protected colorCtrl(controlName: string): FormControl<string> {
    return this.settingsForm.get(controlName) as FormControl<string>;
  }

  /**
   * Resolves a localized label for a given logo slot. The maco-app source used
   * dynamic translate-key concatenation (`'Settings_Logo_' + slot | translate`);
   * the library expresses the same idea by mapping slot names to fields on the
   * `BrandingSettingsMessages` interface.
   */
  protected logoLabel(slot: LogoSlotName): string {
    const m = this.messages();
    switch (slot) {
      case 'header':
        return m.logoHeader;
      case 'footer':
        return m.logoFooter;
      case 'favicon':
        return m.logoFavicon;
    }
  }
}
