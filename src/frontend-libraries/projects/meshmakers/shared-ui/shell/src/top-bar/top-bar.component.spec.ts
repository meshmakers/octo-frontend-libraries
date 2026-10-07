import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShellModeOption, ShellTopBarComponent } from './top-bar.component';
import { ShellSearchTriggerService } from '../shell-search-trigger.service';
import { ShellUserMenuComponent } from '../user-menu/user-menu.component';
import { shellEnvironmentChip } from '../shell-environment';
import { SHELL_MESSAGES } from '../shell.messages';

@Component({ selector: 'mm-shell-user-menu', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class StubUserMenuComponent {
  readonly user = input<unknown>(null);
  readonly sessionLoading = input(false);
  readonly theme = input('system');
  readonly densityOptions = input<unknown[]>([]);
  readonly density = input<string | null>(null);
  readonly languages = input<unknown[]>([]);
  readonly language = input<string | null>(null);
  readonly version = input<string | null>(null);
  readonly messages = input<unknown>(null);
  readonly signIn = output<void>();
  readonly signOut = output<void>();
  readonly themeChange = output<string>();
  readonly densityChange = output<string>();
  readonly languageChange = output<string>();
}

@Component({
  imports: [ShellTopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mm-shell-top-bar [tenantId]="tenantId"><span shellTenant class="projected-switcher">meshmakers ▾</span></mm-shell-top-bar>`
})
class ProjectingHostComponent {
  tenantId: string | null = 'meshmakers';
}

const MODES: ShellModeOption[] = [
  { id: 'workspace', label: 'Home', description: 'Cockpit, pinned MeshBoards, apps and reports' },
  { id: 'studio', label: 'Studio', description: 'Data, integration, UI, operations, access and settings' }
];

async function createTopBar(providers: unknown[] = []): Promise<ComponentFixture<ShellTopBarComponent>> {
  await TestBed.configureTestingModule({
    imports: [ShellTopBarComponent],
    providers: [...providers as never[]]
  })
    .overrideComponent(ShellTopBarComponent, {
      remove: { imports: [ShellUserMenuComponent] },
      add: { imports: [StubUserMenuComponent] }
    })
    .compileComponents();
  const fixture = TestBed.createComponent(ShellTopBarComponent);
  fixture.componentRef.setInput('tenantId', 'meshmakers');
  return fixture;
}

describe('ShellTopBarComponent', () => {
  let fixture: ComponentFixture<ShellTopBarComponent>;
  let element: HTMLElement;
  let searchTrigger: ShellSearchTriggerService;

  beforeEach(async () => {
    fixture = await createTopBar();
    fixture.componentRef.setInput('brandName', 'OctoMesh Studio');
    fixture.componentRef.setInput('brandMarkSrc', 'assets/OctoMesh-Mark.svg');
    fixture.componentRef.setInput('environment', shellEnvironmentChip('DEVELOPMENT'));
    fixture.componentRef.setInput('modes', MODES);
    fixture.componentRef.setInput('currentMode', 'workspace');
    searchTrigger = TestBed.inject(ShellSearchTriggerService);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const modeButtons = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('.mode-switch button'));

  it('shows the brand as mark plus name', () => {
    expect(element.querySelector<HTMLImageElement>('.brand-mark')?.getAttribute('src')).toBe('assets/OctoMesh-Mark.svg');
    expect(element.querySelector('.brand-name')?.textContent?.trim()).toBe('OctoMesh Studio');
  });

  it('leaves the mark out without an image and defaults the name', async () => {
    TestBed.resetTestingModule();
    const plain = await createTopBar();
    plain.detectChanges();
    const host = plain.nativeElement as HTMLElement;
    expect(host.querySelector('.brand-mark')).toBeNull();
    expect(host.querySelector('.brand-name')?.textContent?.trim()).toBe('OctoMesh');
    expect(host.querySelector('.env-chip')).toBeNull();
    expect(host.querySelector('.mode-switch')).toBeNull();
  });

  it('shows the environment chip and the avatar menu', () => {
    expect(element.querySelector('.env-label')?.textContent?.trim()).toBe('Development');
    expect(element.querySelector('.env-short')?.textContent?.trim()).toBe('Dev');
    expect(element.querySelector('.env-chip')?.classList).toContain('status-success');
    expect(element.querySelector('mm-shell-user-menu')).not.toBeNull();
  });

  it('has neither a density switch nor a theme toggle', () => {
    expect(element.querySelector('.density-toggle')).toBeNull();
    expect(element.querySelector('mm-theme-mode-toggle')).toBeNull();
  });

  it('tints the bottom edge for production tenants', () => {
    fixture.componentRef.setInput('environment', shellEnvironmentChip('PRODUCTION'));
    fixture.detectChanges();

    expect(element.querySelector('.top-bar')?.classList).toContain('production');
    expect(element.querySelector('.env-label')?.textContent?.trim()).toBe('Production');
    expect(element.querySelector('.env-short')?.textContent?.trim()).toBe('Prod');
  });

  it('offers the modes and marks the current one', () => {
    expect(modeButtons().map(b => b.textContent?.trim())).toEqual(['Home', 'Studio']);
    expect(modeButtons()[0].getAttribute('aria-pressed')).toBe('true');
    expect(modeButtons()[1].getAttribute('aria-pressed')).toBe('false');
    expect(modeButtons()[0].title).toBe(MODES[0].description);
  });

  it('emits the other mode only', () => {
    const emitted: string[] = [];
    fixture.componentInstance.modeChange.subscribe(mode => emitted.push(mode));

    modeButtons()[0].click();
    modeButtons()[1].click();

    expect(emitted).toEqual(['studio']);
  });

  it('hides the mode switch with a single mode (accounts without builder roles)', () => {
    fixture.componentRef.setInput('modes', MODES.slice(0, 1));
    fixture.detectChanges();

    expect(element.querySelector('.mode-switch')).toBeNull();
  });

  it('hides the mode switch and the environment chip on a denied tenant', () => {
    fixture.componentRef.setInput('isDenied', true);
    fixture.detectChanges();

    expect(element.querySelector('.mode-switch')).toBeNull();
    expect(element.querySelector('.env-chip')).toBeNull();
  });

  it('the search button raises the shell search hook and the output', () => {
    let requests = 0;
    let outputs = 0;
    searchTrigger.requested$.subscribe(() => requests++);
    fixture.componentInstance.searchRequested.subscribe(() => outputs++);
    const search = element.querySelector<HTMLButtonElement>('.search')!;

    expect(search.textContent).toContain('Search');
    expect(search.querySelector('kbd')?.textContent).toMatch(/^(⌘K|Ctrl K)$/);
    search.click();

    expect(requests).toBe(1);
    expect(outputs).toBe(1);
  });

  it('has no assistant toggle unless the assistant is available (default)', () => {
    expect(element.querySelector('.ai-btn')).toBeNull();
    expect(element.querySelector('[data-assistant-toggle]')).toBeNull();
    expect(element.textContent).not.toContain('✦');
  });

  it('passes the personal settings through to the user menu and forwards its outputs', () => {
    fixture.componentRef.setInput('languages', [{ code: 'en', label: 'English' }, { code: 'de', label: 'Deutsch' }]);
    fixture.componentRef.setInput('language', 'de');
    fixture.componentRef.setInput('version', '1.2.3');
    fixture.componentRef.setInput('density', 'compact');
    fixture.componentRef.setInput('theme', 'dark');
    fixture.componentRef.setInput('user', { initials: 'GL' });
    fixture.componentRef.setInput('sessionLoading', true);
    fixture.detectChanges();
    const menu = fixture.debugElement.query(debug => debug.name === 'mm-shell-user-menu').componentInstance as StubUserMenuComponent;
    expect(menu.language()).toBe('de');
    expect(menu.languages().length).toBe(2);
    expect(menu.version()).toBe('1.2.3');
    expect(menu.density()).toBe('compact');
    expect(menu.theme()).toBe('dark');
    expect(menu.user()).toEqual({ initials: 'GL' });
    expect(menu.sessionLoading()).toBe(true);

    const languages: string[] = [];
    const densities: string[] = [];
    fixture.componentInstance.languageChange.subscribe(code => languages.push(code));
    fixture.componentInstance.densityChange.subscribe(mode => densities.push(mode));
    const events: string[] = [];
    fixture.componentInstance.signIn.subscribe(() => events.push('signIn'));
    fixture.componentInstance.signOut.subscribe(() => events.push('signOut'));
    fixture.componentInstance.themeChange.subscribe(theme => events.push(`theme:${theme}`));
    menu.languageChange.emit('en');
    menu.densityChange.emit('auto');
    menu.signIn.emit();
    menu.signOut.emit();
    menu.themeChange.emit('light');
    expect(languages).toEqual(['en']);
    expect(densities).toEqual(['auto']);
    expect(events).toEqual(['signIn', 'signOut', 'theme:light']);
  });
});

describe('ShellTopBarComponent assistant toggle', () => {
  let fixture: ComponentFixture<ShellTopBarComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = await createTopBar();
    fixture.componentRef.setInput('assistantAvailable', true);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const toggle = (): HTMLButtonElement | null => element.querySelector<HTMLButtonElement>('.ai-btn');

  it('shows the ✦ Assistant button with its shortcut, wired to the panel', () => {
    const button = toggle()!;
    expect(button.textContent).toContain('✦');
    expect(button.textContent).toContain('Assistant');
    expect(button.querySelector('kbd')?.textContent).toMatch(/^(⌘J|Ctrl J)$/);
    expect(button.hasAttribute('aria-controls')).toBe(false);
    expect(button.getAttribute('aria-keyshortcuts')).toMatch(/^(Meta\+J Control\+J|Control\+J Meta\+J)$/);
    expect(button.hasAttribute('data-assistant-toggle')).toBe(true);
  });

  it('emits the toggle and reflects the panel state', () => {
    let toggles = 0;
    fixture.componentInstance.assistantToggle.subscribe(() => toggles++);
    toggle()!.click();
    expect(toggles).toBe(1);
    expect(toggle()!.getAttribute('aria-expanded')).toBe('false');
    expect(toggle()!.hasAttribute('aria-pressed')).toBe(false);
    fixture.componentRef.setInput('assistantOpen', true);
    fixture.detectChanges();
    expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
    expect(toggle()!.getAttribute('aria-controls')).toBe('assistant-panel');
  });

  it('is hidden outside a tenant and on a denied tenant', () => {
    fixture.componentRef.setInput('isDenied', true);
    fixture.detectChanges();
    expect(toggle()).toBeNull();
    fixture.componentRef.setInput('isDenied', false);
    fixture.componentRef.setInput('tenantId', null);
    fixture.detectChanges();
    expect(toggle()).toBeNull();
  });
});

describe('ShellTopBarComponent messages', () => {
  it('translates through SHELL_MESSAGES', async () => {
    const fixture = await createTopBar([{ provide: SHELL_MESSAGES, useValue: { search: 'Suche', searchAriaLabel: 'Suchen oder Befehl ausführen' } }]);
    fixture.detectChanges();
    const search = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.search')!;
    expect(search.querySelector('.search-label')?.textContent?.trim()).toBe('Suche');
    expect(search.getAttribute('aria-label')).toBe('Suchen oder Befehl ausführen');
  });
});

describe('ShellTopBarComponent tenant slot', () => {
  it('projects the host tenant switcher inside a tenant only', async () => {
    await TestBed.configureTestingModule({ imports: [ProjectingHostComponent] })
      .overrideComponent(ShellTopBarComponent, {
        remove: { imports: [ShellUserMenuComponent] },
        add: { imports: [StubUserMenuComponent] }
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ProjectingHostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tenant .projected-switcher')?.textContent).toContain('meshmakers');
  });
});
