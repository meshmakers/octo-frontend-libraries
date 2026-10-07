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

  it('lists "All settings" and the categories of the area, without separators, as one labelled nav', () => {
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Settings categories');
    expect(items().map((b) => b.textContent!.trim())).toEqual(['All settings', 'Tenant', 'Connections']);
    expect(items().every((b) => b.type === 'button')).toBe(true);
    expect(items()[1].title).toBe('Tenant settings');
  });

  it('marks the home or the active category as the current page', () => {
    expect(current()).toEqual(['All settings']);

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
    expect(element.querySelector('[data-side-nav="home"]')?.textContent?.trim()).toBe('Alle (settings)');
  });
});
