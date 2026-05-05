import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  BrandingDataSource,
  NEUTRAL_BRANDING_DEFAULTS,
  OCTO_BRANDING_DEFAULTS,
} from '@meshmakers/octo-ui/branding';
import { MessageService } from '@meshmakers/shared-services';
import { SettingsPageComponent } from './settings-page.component';
import { BrandingSettingsMessages } from './branding-settings.messages';

const TEST_MESSAGES: BrandingSettingsMessages = {
  sectionGeneral: 'General',
  sectionLogos: 'Logos',
  sectionLightTheme: 'Light',
  sectionDarkTheme: 'Dark',
  enableDarkTheme: 'Enable dark',
  appName: 'App name',
  appTitle: 'App title',
  logoHeader: 'Header',
  logoFooter: 'Footer',
  logoFavicon: 'Favicon',
  logoRemove: 'Remove',
  uploadLogo: 'Upload logo',
  uploadFavicon: 'Upload favicon',
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
  resetDefaults: 'Reset',
  saveSuccess: 'OK',
  saveError: 'ERR',
  resetSuccess: 'RESET',
  loadError: 'LOAD ERR',
};

describe('SettingsPageComponent', () => {
  function configure(): {
    fixture: ReturnType<typeof TestBed.createComponent<SettingsPageComponent>>;
    el: HTMLElement;
    dataSource: {
      branding: ReturnType<typeof signal<typeof NEUTRAL_BRANDING_DEFAULTS>>;
      load: jasmine.Spy;
      save: jasmine.Spy;
      resetToDefaults: jasmine.Spy;
    };
    msg: jasmine.SpyObj<MessageService>;
  } {
    const branding = signal(NEUTRAL_BRANDING_DEFAULTS);
    const dataSource = {
      branding,
      load: jasmine.createSpy('load').and.returnValue(Promise.resolve()),
      save: jasmine
        .createSpy('save')
        .and.callFake((_u: unknown) =>
          Promise.resolve(NEUTRAL_BRANDING_DEFAULTS),
        ),
      resetToDefaults: jasmine
        .createSpy('resetToDefaults')
        .and.returnValue(Promise.resolve()),
    };
    const msg = jasmine.createSpyObj<MessageService>('MessageService', [
      'showError',
      'showInformation',
    ]);
    TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        { provide: BrandingDataSource, useValue: dataSource },
        { provide: MessageService, useValue: msg },
        { provide: OCTO_BRANDING_DEFAULTS, useValue: NEUTRAL_BRANDING_DEFAULTS },
        provideNoopAnimations(),
      ],
    });
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.componentRef.setInput('messages', TEST_MESSAGES);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, dataSource, msg };
  }

  it('renders section headers from messages input', () => {
    const { el } = configure();
    expect(el.textContent).toContain('General');
    expect(el.textContent).toContain('Logos');
    expect(el.textContent).toContain('Light');
  });

  it('calls dataSource.load() on init', () => {
    const { dataSource } = configure();
    expect(dataSource.load).toHaveBeenCalled();
  });

  it('save() calls dataSource.save with form values and shows success message', async () => {
    const { fixture, dataSource, msg } = configure();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      onSubmit: () => Promise<void>;
    };
    await component.onSubmit();
    expect(dataSource.save).toHaveBeenCalled();
    expect(msg.showInformation).toHaveBeenCalled();
  });

  it('reset() calls dataSource.resetToDefaults', async () => {
    const { fixture, dataSource } = configure();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      onResetDefaults: () => Promise<void>;
    };
    await component.onResetDefaults();
    expect(dataSource.resetToDefaults).toHaveBeenCalled();
  });
});
