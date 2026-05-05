import { Component } from '@angular/core';
import {
  BrandingSettingsMessages,
  SettingsPageComponent,
} from '@meshmakers/octo-ui/branding-settings';

const DEMO_MESSAGES: BrandingSettingsMessages = {
  sectionGeneral: 'General',
  sectionLogos: 'Logos',
  sectionLightTheme: 'Light theme',
  sectionDarkTheme: 'Dark theme',
  enableDarkTheme: 'Enable dark theme',
  appName: 'App name',
  appTitle: 'App title (browser tab)',
  logoHeader: 'Header logo',
  logoFooter: 'Footer logo',
  logoFavicon: 'Favicon',
  logoRemove: 'Remove',
  uploadLogo: 'Drop or click to upload logo',
  uploadFavicon: 'Drop or click to upload favicon',
  colorPrimary: 'Primary',
  colorSecondary: 'Secondary',
  colorTertiary: 'Tertiary',
  colorNeutral: 'Neutral',
  colorBackground: 'Background',
  gradientHeader: 'Header gradient',
  gradientFooter: 'Footer gradient',
  gradientStart: 'Start',
  gradientEnd: 'End',
  required: 'Required',
  save: 'Save',
  resetDefaults: 'Reset to defaults',
  saveSuccess: 'Branding saved.',
  saveError: 'Failed to save branding.',
  resetSuccess: 'Branding reset to defaults.',
  loadError: 'Failed to load branding.',
};

@Component({
  selector: 'app-branding-settings-demo',
  standalone: true,
  imports: [SettingsPageComponent],
  templateUrl: './branding-settings-demo.component.html',
})
export class BrandingSettingsDemoComponent {
  protected readonly messages = DEMO_MESSAGES;
}
