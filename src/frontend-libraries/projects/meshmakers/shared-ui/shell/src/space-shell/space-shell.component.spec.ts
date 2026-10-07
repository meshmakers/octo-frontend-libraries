import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpaceShellComponent } from './space-shell.component';
import { ShellNavNode } from '../shell-navigation.service';
import { SpaceStatusChip } from '../space-header.service';
import { SpaceMetaItem } from '../home-greeting';

const node = (id: string, text: string, extra: Partial<ShellNavNode> = {}): ShellNavNode => ({
  id, text, separator: false, selected: false, active: false, navigable: true, external: false, children: [], ...extra
});

const OPERATE = node('area-operate', 'Operate', {
  navigable: false,
  children: [
    node('operate-events', 'Events'),
    node('operate-jobs', 'Jobs', { external: true }),
    node('operate-sep', '', { separator: true, navigable: false }),
    node('operate-swagger', 'Swagger', {
      navigable: false,
      children: [node('swagger-bot', 'BotServices', { external: true })]
    })
  ]
});

@Component({
  imports: [SpaceShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mm-space-shell [area]="area()" [activeTabId]="activeTabId()" [chips]="chips()" [heading]="heading()" [meta]="meta()"
                     [objectDetail]="objectDetail()" [backTarget]="backTarget()" [showTabs]="showTabs()" (tabSelected)="selected.push($event)">
      <span spaceCrumbs class="crumbs">Operate › Events</span>
      <button spaceActions class="action">New</button>
    </mm-space-shell>`
})
class HostComponent {
  readonly area = signal<ShellNavNode | null>(OPERATE);
  readonly activeTabId = signal<string | null>('operate-events');
  readonly chips = signal<SpaceStatusChip[]>([]);
  readonly heading = signal<string | null>(null);
  readonly meta = signal<SpaceMetaItem[]>([]);
  readonly objectDetail = signal(false);
  readonly showTabs = signal(true);
  readonly backTarget = signal<ShellNavNode | null>(null);
  readonly selected: ShellNavNode[] = [];
}

describe('SpaceShellComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;

  const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('.space-tab'));
  const tab = (id: string): HTMLButtonElement => element.querySelector<HTMLButtonElement>(`[data-tab-id="${id}"]`)!;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('shows the area title, projected crumbs and actions', () => {
    expect(element.querySelector('.space-title')?.textContent?.trim()).toBe('Operate');
    expect(element.querySelector('.space-crumbs .crumbs')).not.toBeNull();
    expect(element.querySelector('.space-actions .action')).not.toBeNull();
  });

  it('replaces the area name by a title and shows the meta line (Home greeting, AB#5558)', () => {
    expect(element.querySelector('.space-meta')).toBeNull();
    host.heading.set('Good morning, Gerald');
    host.meta.set([{ label: 'Tenant', value: 'meshmakers' }]);
    fixture.detectChanges();
    expect(element.querySelector('.space-title')?.textContent?.trim()).toBe('Good morning, Gerald');
    expect(element.querySelector('.space-meta')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Tenant meshmakers');
    expect(element.querySelector('.space-meta-value')?.textContent).toBe('meshmakers');
    // The tabs stay: the greeting replaces only the title.
    expect(tabs().length).toBeGreaterThan(0);
  });

  it('scrolls only the tab strip so the active tab is visible (phones)', () => {
    const strip = element.querySelector<HTMLElement>('.space-tabs')!;
    const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    // jsdom has no layout: give the strip a writable scroll position and boxes.
    let scrollLeft = 0;
    Object.defineProperty(strip, 'scrollLeft', { get: () => scrollLeft, set: (value: number) => scrollLeft = value, configurable: true });
    strip.getBoundingClientRect = () => rect(0, 300);
    tab('operate-jobs').getBoundingClientRect = () => rect(320, 380);
    const shell = fixture.debugElement.children[0].componentInstance as SpaceShellComponent;
    const reveal = vi.spyOn(shell, 'revealTab');

    host.activeTabId.set('operate-jobs');
    fixture.detectChanges();
    TestBed.tick();

    expect(reveal).toHaveBeenCalledWith('operate-jobs');
    // 380 - 300 + 16 margin.
    expect(scrollLeft).toBe(96);
  });

  it('leaves the tab strip out when the page lists the entries itself (showTabs false)', () => {
    expect(tabs().length).toBeGreaterThan(0);
    host.showTabs.set(false);
    fixture.detectChanges();
    expect(tabs().length).toBe(0);
    expect(element.querySelector('.space-title')?.textContent?.trim()).toBe('Operate');
  });

  it('shows no back link outside an object detail page', () => {
    host.backTarget.set(OPERATE.children[0]);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="space-back"]')).toBeNull();
    expect(element.querySelector('.space-head')?.classList).not.toContain('object-detail');
  });

  describe('on an object detail page (AB#5547)', () => {
    beforeEach(() => {
      host.chips.set([{ label: '3 adapters', status: 'info' }]);
      host.objectDetail.set(true);
      host.backTarget.set(OPERATE.children[0]);
      fixture.detectChanges();
    });

    it('replaces area title, chips and tab strip by a back link, keeping crumbs and actions', () => {
      expect(element.querySelector('.space-head')?.classList).toContain('object-detail');
      expect(element.querySelector('.space-title')).toBeNull();
      expect(element.querySelector('.space-chips')).toBeNull();
      expect(element.querySelector('nav.space-tabs')).toBeNull();
      expect(element.querySelector('.space-crumbs .crumbs')).not.toBeNull();
      expect(element.querySelector('.space-actions .action')).not.toBeNull();
    });

    it('offers a keyboard-reachable back link named after the list', () => {
      const back = element.querySelector<HTMLButtonElement>('[data-testid="space-back"]')!;
      expect(back.tagName).toBe('BUTTON');
      expect(back.type).toBe('button');
      expect(back.getAttribute('aria-label')).toBe('Back to Events');
      expect(back.textContent?.replace(/\s+/g, ' ').trim()).toBe('← Events');

      back.click();
      expect(host.selected.map(t => t.id)).toEqual(['operate-events']);
    });

    it('omits the back link when there is no list to return to', () => {
      host.backTarget.set(null);
      fixture.detectChanges();

      expect(element.querySelector('[data-testid="space-back"]')).toBeNull();
      expect(element.querySelector('.space-crumbs .crumbs')).not.toBeNull();
    });
  });

  it('builds one tab per entry and a divider for the separator', () => {
    expect(tabs().map(t => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Events', 'Jobs ↗(opens in a new tab)', 'Swagger ▾']);
    expect(element.querySelectorAll('.tab-separator').length).toBe(1);
    expect(element.querySelector('nav.space-tabs')?.getAttribute('aria-label')).toBe('Operate pages');
  });

  it('marks the active tab with aria-current="page"', () => {
    expect(tab('operate-events').getAttribute('aria-current')).toBe('page');
    expect(tab('operate-jobs').getAttribute('aria-current')).toBeNull();

    host.activeTabId.set('operate-jobs');
    fixture.detectChanges();
    expect(tab('operate-jobs').getAttribute('aria-current')).toBe('page');
  });

  it('emits tabSelected for a page tab', () => {
    tab('operate-jobs').click();

    expect(host.selected.map(t => t.id)).toEqual(['operate-jobs']);
  });

  const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve));
  const openSwagger = async (): Promise<void> => {
    tab('operate-swagger').click();
    fixture.detectChanges();
    await flush();
  };

  it('opens a menu for a grouping tab, focuses it and emits its entry', async () => {
    await openSwagger();

    expect(tab('operate-swagger').getAttribute('aria-expanded')).toBe('true');
    expect(tab('operate-swagger').getAttribute('aria-controls')).toBe('space-tab-menu-operate-swagger');
    expect(document.activeElement).toBe(element.querySelector('.tab-menu-item'));
    expect(host.selected).toEqual([]);

    element.querySelector<HTMLButtonElement>('.tab-menu-item')!.click();
    fixture.detectChanges();

    expect(host.selected.map(t => t.id)).toEqual(['swagger-bot']);
    expect(element.querySelector('.tab-menu')).toBeNull();
    expect(document.activeElement).toBe(tab('operate-swagger'));
  });

  it('positions the menu from the tab button, not with a fixed offset', async () => {
    vi.spyOn(tab('operate-swagger'), 'getBoundingClientRect').mockReturnValue({ bottom: 100, left: 240 } as DOMRect);

    await openSwagger();
    const menu = element.querySelector<HTMLElement>('.tab-menu')!;

    expect(menu.style.top).toBe('104px');
    expect(menu.style.left).toBe('240px');
  });

  it('Escape in the menu closes it and returns focus to the button', async () => {
    await openSwagger();

    element.querySelector('.tab-menu-item')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('.tab-menu')).toBeNull();
    expect(document.activeElement).toBe(tab('operate-swagger'));
  });

  it('Escape on the button closes, Arrow Down on the button opens', async () => {
    tab('operate-swagger').focus();
    tab('operate-swagger').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await flush();
    expect(element.querySelector('.tab-menu')).not.toBeNull();

    tab('operate-swagger').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('.tab-menu')).toBeNull();
    expect(document.activeElement).toBe(tab('operate-swagger'));
  });

  it('a click outside closes the menu', async () => {
    await openSwagger();

    document.body.click();
    fixture.detectChanges();

    expect(element.querySelector('.tab-menu')).toBeNull();
  });

  it('focus leaving the menu closes it', async () => {
    await openSwagger();

    element.querySelector('.tab-wrapper[data-wrapper-id="operate-swagger"]')!
      .dispatchEvent(new FocusEvent('focusout', { relatedTarget: tab('operate-events') }));
    fixture.detectChanges();

    expect(element.querySelector('.tab-menu')).toBeNull();
  });

  it('renders status chips with their status class', () => {
    host.chips.set([{ label: '1 pool unregistered', status: 'warning' }]);
    fixture.detectChanges();

    const chip = element.querySelector('.space-chip')!;
    expect(chip.textContent?.trim()).toBe('1 pool unregistered');
    expect(chip.classList).toContain('status-warning');
  });

  it('without an area keeps crumbs and actions but shows no title or tabs', () => {
    host.area.set(null);
    fixture.detectChanges();

    expect(element.querySelector('.space-title')).toBeNull();
    expect(element.querySelector('.space-tabs')).toBeNull();
    expect(element.querySelector('.space-crumbs .crumbs')).not.toBeNull();
  });
});
