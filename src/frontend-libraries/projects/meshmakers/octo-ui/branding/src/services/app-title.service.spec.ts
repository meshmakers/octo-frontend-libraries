import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot } from '@angular/router';
import {
  AppTitleService,
  OCTO_TITLE_TRANSLATOR,
} from './app-title.service';
import { BrandingDataSource } from './branding-data-source.service';
import { NEUTRAL_BRANDING_DEFAULTS } from '../branding.tokens';

interface MutableRouteSnapshot {
  data: Record<string, unknown>;
  children: MutableRouteSnapshot[];
}

function makeRouterState(...breadcrumbs: string[]): RouterStateSnapshot {
  // Build a chain root → child → child… where the deepest data.breadcrumb
  // wins (matches the real Angular ActivatedRoute hierarchy).
  const head: MutableRouteSnapshot = { data: {}, children: [] };
  let cursor: MutableRouteSnapshot = head;
  for (const bc of breadcrumbs) {
    const next: MutableRouteSnapshot = {
      data: { breadcrumb: bc },
      children: [],
    };
    cursor.children = [next];
    cursor = next;
  }
  return { root: head } as unknown as RouterStateSnapshot;
}

describe('AppTitleService', () => {
  function configure(opts?: {
    appTitle?: string;
    appName?: string;
    translator?: (k: string) => string;
  }): {
    service: AppTitleService;
    titleStub: jasmine.SpyObj<Title>;
    brandingSignal: ReturnType<typeof signal<typeof NEUTRAL_BRANDING_DEFAULTS>>;
  } {
    const branding = signal({
      ...NEUTRAL_BRANDING_DEFAULTS,
      appTitle: opts?.appTitle ?? 'TabTitle',
      appName: opts?.appName ?? NEUTRAL_BRANDING_DEFAULTS.appName,
    });
    const titleStub = jasmine.createSpyObj<Title>('Title', ['setTitle']);
    TestBed.configureTestingModule({
      providers: [
        { provide: BrandingDataSource, useValue: { branding } },
        { provide: Title, useValue: titleStub },
        ...(opts?.translator
          ? [{ provide: OCTO_TITLE_TRANSLATOR, useValue: opts.translator }]
          : []),
      ],
    });
    return {
      service: TestBed.inject(AppTitleService),
      titleStub,
      brandingSignal: branding,
    };
  }

  it('sets only baseTitle when no breadcrumb in route', () => {
    const { service, titleStub } = configure();
    service.updateTitle(makeRouterState());
    expect(titleStub.setTitle).toHaveBeenCalledWith('TabTitle');
  });

  it('appends the deepest breadcrumb to baseTitle', () => {
    const { service, titleStub } = configure();
    service.updateTitle(makeRouterState('Home', 'Settings'));
    expect(titleStub.setTitle).toHaveBeenCalledWith('TabTitle | Settings');
  });

  it('translates breadcrumb when OCTO_TITLE_TRANSLATOR is provided', () => {
    const { service, titleStub } = configure({
      translator: (k) => (k === 'Settings' ? 'Ustawienia' : k),
    });
    service.updateTitle(makeRouterState('Settings'));
    expect(titleStub.setTitle).toHaveBeenCalledWith('TabTitle | Ustawienia');
  });

  it('falls back to appName when appTitle is empty', () => {
    const { service, titleStub } = configure({
      appTitle: '',
      appName: 'AppName',
    });
    service.updateTitle(makeRouterState());
    expect(titleStub.setTitle).toHaveBeenCalledWith('AppName');
  });

  it('re-applies title when branding signal changes', () => {
    const { service, titleStub, brandingSignal } = configure();
    service.updateTitle(makeRouterState());
    titleStub.setTitle.calls.reset();
    brandingSignal.set({ ...brandingSignal(), appTitle: 'NewTitle' });
    TestBed.flushEffects();
    expect(titleStub.setTitle).toHaveBeenCalledWith('NewTitle');
  });
});
