import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShellNavNode } from '../shell-navigation.service';
import { SettingsSideNavComponent } from './settings-side-nav.component';
import { SettingsSideNavBadge } from './settings-side-nav-badges.service';
import { SHELL_MESSAGES } from '../shell.messages';

const node = (id: string, text: string, extra: Partial<ShellNavNode> = {}): ShellNavNode => ({
  id, text, separator: false, selected: false, active: false, navigable: true, external: false, children: [], ...extra
});

const SETTINGS = node('area-settings', 'Settings', {
  navigable: false,
  children: [
    node('settings-tenant', 'Tenant', { tooltip: 'Tenant settings', children: [node('settings-tenant-secrets', 'Secrets')] }),
    node('settings-sep', '', { separator: true, navigable: false }),
    node('settings-connections', 'Connections'),
  ],
});

@Component({
  imports: [SettingsSideNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mm-settings-side-nav [area]="area" [activeTabId]="activeTabId()" [homeActive]="homeActive()" [badges]="badges()"
                           (homeSelected)="home = home + 1" (tabSelected)="selected.push($event)" />`,
})
class HostComponent {
  readonly area = SETTINGS;
  readonly activeTabId = signal<string | null>(null);
  readonly homeActive = signal(true);
  readonly badges = signal<Record<string, SettingsSideNavBadge>>({});
  readonly selected: ShellNavNode[] = [];
  home = 0;
}

describe('SettingsSideNavComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const items = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('.side-nav__item'));
  const current = (): string[] => items().filter((b) => b.getAttribute('aria-current') === 'page').map((b) => b.textContent!.trim());

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('lists "All Settings" and the categories of the area, without separators, as one labelled nav', () => {
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Settings categories');
    expect(items().map((b) => b.textContent!.trim())).toEqual(['All Settings', 'Tenant', 'Connections']);
    expect(items().every((b) => b.type === 'button')).toBe(true);
    expect(items()[1].title).toBe('Tenant settings');
  });

  it('marks the home or the active category as the current page', () => {
    expect(current()).toEqual(['All Settings']);

    host.homeActive.set(false);
    host.activeTabId.set('settings-connections');
    fixture.detectChanges();
    expect(current()).toEqual(['Connections']);
  });

  it('emits the home and the selected category', () => {
    items()[0].click();
    items()[2].click();

    expect(host.home).toBe(1);
    expect(host.selected.map((n) => n.id)).toEqual(['settings-connections']);
  });

  it('shows counts and the re-entry badge with its label', () => {
    host.badges.set({
      'settings-tenant': { count: 2, attention: true, label: '2 secrets to re-enter' },
      'settings-connections': { count: 12 },
    });
    fixture.detectChanges();

    const tenant = element.querySelector<HTMLElement>('[data-badge="settings-tenant"]')!;
    expect(tenant.textContent!.trim()).toBe('2');
    expect(tenant.classList).toContain('is-attention');
    expect(tenant.getAttribute('aria-label')).toBe('2 secrets to re-enter');
    const connections = element.querySelector<HTMLElement>('[data-badge="settings-connections"]')!;
    expect(connections.textContent!.trim()).toBe('12');
    expect(connections.classList).not.toContain('is-attention');
    expect(connections.hasAttribute('aria-label')).toBe(false);
  });
});

describe('SettingsSideNavComponent messages', () => {
  it('formats the navigation and home labels from SHELL_MESSAGES', () => {
    TestBed.configureTestingModule({ providers: [{ provide: SHELL_MESSAGES, useValue: { areaCategories: 'Kategorien: {area}', allOfArea: 'Alle ({area})' } }] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Kategorien: Settings');
    expect(element.querySelector('[data-side-nav="home"]')?.textContent?.trim()).toBe('Alle (Settings)');
  });
});

describe('SettingsSideNavComponent labels as given (AB#5621)', () => {
  it('passes the area name to "All {area}" unchanged (no lower-casing)', () => {
    TestBed.configureTestingModule({ providers: [{ provide: SHELL_MESSAGES, useValue: { allOfArea: 'Alle {area}' } }] });
    const fixture = TestBed.createComponent(SettingsSideNavComponent);
    fixture.componentRef.setInput('area', node('area-settings', 'Einstellungen', { navigable: false, children: [node('settings-mail', 'E-Mail-Postfach')] }));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-side-nav="home"]')?.textContent?.trim()).toBe('Alle Einstellungen');
    expect(element.querySelector('[data-tab-id="settings-mail"]')?.textContent?.trim()).toBe('E-Mail-Postfach');
  });

  it('applies no text-transform to entries and group headings', () => {
    const fixture = TestBed.createComponent(SettingsSideNavComponent);
    fixture.componentRef.setInput('area', SETTINGS);
    fixture.componentRef.setInput('groups', [{ id: 'org', label: 'Organisation und Konten', tabIds: ['settings-tenant'] }]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const transformOf = (selector: string): string => getComputedStyle(element.querySelector<HTMLElement>(selector)!).textTransform;

    const heading = element.querySelector<HTMLElement>('.side-nav__group-label')!;
    expect(heading.textContent!.trim()).toBe('Organisation und Konten');
    for (const selector of ['.side-nav__group-label', '[data-side-nav="home"]', '[data-tab-id="settings-tenant"]']) {
      expect(['', 'none']).toContain(transformOf(selector));
    }
  });
});

describe('SettingsSideNavComponent groups (AB#5621)', () => {
  const AREA = node('area-settings', 'Settings', {
    navigable: false,
    children: [
      node('settings-company', 'Company'),
      node('settings-bank', 'Bank'),
      node('settings-mail', 'Mail'),
      node('settings-users', 'Users'),
    ],
  });
  let fixture: ComponentFixture<SettingsSideNavComponent>;
  let element: HTMLElement;

  const render = (groups?: unknown): void => {
    fixture = TestBed.createComponent(SettingsSideNavComponent);
    fixture.componentRef.setInput('area', AREA);
    fixture.componentRef.setInput('activeTabId', 'settings-mail');
    if (groups) {
      fixture.componentRef.setInput('groups', groups);
    }
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  };
  const texts = (root: ParentNode): string[] =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('.side-nav__item')).map((b) => b.textContent!.trim());

  it('stays flat without groups', () => {
    render();

    expect(element.querySelectorAll('.side-nav__group').length).toBe(0);
    expect(texts(element)).toEqual(['All Settings', 'Company', 'Bank', 'Mail', 'Users']);
  });

  it('puts labelled groups over their categories in group order, ungrouped ones last', () => {
    render([
      { id: 'org', label: 'Organisation', tabIds: ['settings-company', 'settings-users'] },
      { id: 'integrations', label: 'Integrations', tabIds: ['settings-mail', 'settings-missing'] },
      { id: 'empty', label: 'Empty', tabIds: ['settings-gone'] },
    ]);

    const groups = Array.from(element.querySelectorAll<HTMLElement>('.side-nav__group'));
    expect(groups.map((g) => g.getAttribute('data-group'))).toEqual(['org', 'integrations']);
    expect(texts(groups[0])).toEqual(['Company', 'Users']);
    expect(texts(groups[1])).toEqual(['Mail']);
    expect(texts(element)).toEqual(['All Settings', 'Company', 'Users', 'Mail', 'Bank']);

    const heading = groups[0].querySelector('.side-nav__group-label')!;
    expect(groups[0].getAttribute('role')).toBe('group');
    expect(groups[0].getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.textContent!.trim()).toBe('Organisation');
  });

  it('gives each side nav instance its own group heading ids', () => {
    const groups = [{ id: 'org', label: 'Organisation', tabIds: ['settings-company'] }];
    render(groups);
    const firstId = element.querySelector('.side-nav__group-label')!.id;
    render(groups);
    const secondId = element.querySelector('.side-nav__group-label')!.id;

    expect(firstId).toContain('org');
    expect(secondId).not.toBe(firstId);
  });

  it('lists a category only once and keeps aria-current and selection inside groups', () => {
    render([
      { id: 'a', label: 'A', tabIds: ['settings-mail'] },
      { id: 'b', label: 'B', tabIds: ['settings-mail', 'settings-bank'] },
    ]);
    const selected: string[] = [];
    fixture.componentInstance.tabSelected.subscribe((tab) => selected.push(tab.id));

    expect(texts(element)).toEqual(['All Settings', 'Mail', 'Bank', 'Company', 'Users']);
    const mail = element.querySelector<HTMLButtonElement>('[data-tab-id="settings-mail"]')!;
    expect(mail.getAttribute('aria-current')).toBe('page');
    mail.click();
    expect(selected).toEqual(['settings-mail']);
  });
});
