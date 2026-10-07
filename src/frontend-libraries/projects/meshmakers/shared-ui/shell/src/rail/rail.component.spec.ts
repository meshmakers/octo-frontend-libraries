import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RAIL_FLYOUT_CLOSE_DELAY, RAIL_FLYOUT_OPEN_DELAY, ShellRailComponent } from './rail.component';
import { ShellNavNode } from '../shell-navigation.service';

const node = (id: string, children: ShellNavNode[] = [], extra: Partial<ShellNavNode> = {}): ShellNavNode => ({
  id, text: id, separator: false, selected: false, active: false, navigable: true, external: false, children, ...extra
});
const separator = (id: string): ShellNavNode => node(id, [], { separator: true, navigable: false });

const HOME = node('area-home', [node('home-cockpit'), separator('home-sep'), node('home-app-1', [], { external: true })], { navigable: false });
const DATA = node('area-data', [node('data-libraries')], { navigable: false });
const SETTINGS = node('area-settings', [node('settings-sign-in', [node('settings-sign-in-identity-providers')])], { navigable: false });

describe('ShellRailComponent', () => {
  afterEach(() => vi.restoreAllMocks());
  let fixture: ComponentFixture<ShellRailComponent>;
  let element: HTMLElement;

  const buttons = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('.rail-item'));
  const button = (id: string): HTMLButtonElement => element.querySelector<HTMLButtonElement>(`[data-area-id="${id}"]`)!;
  const entry = (id: string): HTMLElement => element.querySelector<HTMLElement>(`[data-entry-id="${id}"]`)!;
  const key = (target: HTMLElement, keyName: string): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
    fixture.detectChanges();
  };

  const hover = (id: string, type: 'mouseenter' | 'mouseleave'): void => {
    entry(id).dispatchEvent(new MouseEvent(type));
    fixture.detectChanges();
  };
  /** Hover and wait out the intent delay. */
  const hoverOpen = (id: string): void => {
    hover(id, 'mouseenter');
    vi.advanceTimersByTime(RAIL_FLYOUT_OPEN_DELAY);
    fixture.detectChanges();
  };
  const advance = (ms: number): void => {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  };
  /** A real mouse click: pointerdown on the target, then click with detail 1. */
  const pointerClick = (target: HTMLElement): void => {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    fixture.detectChanges();
  };
  const isOpen = (id: string): boolean => entry(id).classList.contains('open');

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no matchMedia; give spyOn something to replace.
    if (typeof window.matchMedia !== 'function') {
      Object.defineProperty(window, 'matchMedia', { value: () => undefined, writable: true, configurable: true });
    }
    // Desktop rail (not the phone bottom bar), independent of other specs' matchMedia fakes.
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    } as unknown as MediaQueryList));
    fixture = TestBed.createComponent(ShellRailComponent);
    fixture.componentRef.setInput('areas', [HOME, DATA]);
    fixture.componentRef.setInput('bottomAreas', [SETTINGS]);
    fixture.componentRef.setInput('activeAreaId', 'area-data');
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('keeps padding and border inside its box, so it never outgrows the shell (AB#5516 visual check)', () => {
    expect(getComputedStyle(element.querySelector('nav.rail')!).boxSizing).toBe('border-box');
  });

  it('renders one labelled button per area, Settings in the bottom list', () => {
    expect(buttons().map(b => b.getAttribute('aria-label'))).toEqual(['area-home', 'area-data', 'area-settings']);
    expect(element.querySelector('.rail-bottom [data-area-id="area-settings"]')).not.toBeNull();
  });

  it('marks only the active area with aria-current', () => {
    expect(button('area-data').getAttribute('aria-current')).toBe('true');
    expect(button('area-home').getAttribute('aria-current')).toBeNull();
  });

  it('puts only the active area in the tab order (roving tabindex)', () => {
    expect(buttons().map(b => b.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('is a disclosure, not a menu button: aria-expanded/-controls, no aria-haspopup', () => {
    expect(button('area-home').getAttribute('aria-haspopup')).toBeNull();
    expect(button('area-home').getAttribute('aria-expanded')).toBe('false');
    expect(button('area-home').getAttribute('aria-controls')).toBe('rail-flyout-area-home');
    expect(element.querySelector('[role="menu"], [role="menuitem"]')).toBeNull();
  });

  it('does not open the flyout on focus alone', () => {
    button('area-home').focus();
    fixture.detectChanges();

    expect(entry('area-home').classList).not.toContain('open');
  });

  it('emits areaSelected on keyboard activation and closes the flyout', () => {
    const selected: ShellNavNode[] = [];
    fixture.componentInstance.areaSelected.subscribe(area => selected.push(area));

    hoverOpen('area-home');
    expect(entry('area-home').classList).toContain('open');

    // Enter/Space (a click without pointer detail) keeps the plain behaviour.
    button('area-home').click();
    fixture.detectChanges();

    expect(selected.map(a => a.id)).toEqual(['area-home']);
    expect(entry('area-home').classList).not.toContain('open');
  });

  it('opens the flyout on hover and lists the entries with separators and external markers', () => {
    hoverOpen('area-home');

    expect(entry('area-home').classList).toContain('open');
    expect(button('area-home').getAttribute('aria-expanded')).toBe('true');
    const flyout = entry('area-home').querySelector('.rail-flyout')!;
    expect(flyout.querySelectorAll('.flyout-item').length).toBe(2);
    expect(flyout.querySelectorAll('.flyout-separator').length).toBe(1);
    expect(flyout.querySelector('.flyout-external')?.getAttribute('aria-hidden')).toBe('true');
    expect(flyout.querySelector('.visually-hidden')?.textContent).toContain('opens in a new tab');

    hover('area-home', 'mouseleave');
    advance(RAIL_FLYOUT_CLOSE_DELAY);
    expect(entry('area-home').classList).not.toContain('open');
  });

  it('lists nested entries (Settings pages below their category)', () => {
    const items = Array.from(entry('area-settings').querySelectorAll('.flyout-item')).map(i => i.textContent?.trim());

    expect(items).toEqual(['settings-sign-in', 'settings-sign-in-identity-providers']);
  });

  it('emits itemSelected for a flyout entry and keeps focus on the area icon', () => {
    const selected: ShellNavNode[] = [];
    fixture.componentInstance.itemSelected.subscribe(item => selected.push(item));
    hoverOpen('area-data');
    const item = entry('area-data').querySelector<HTMLButtonElement>('.flyout-item')!;
    item.focus();

    item.click();
    fixture.detectChanges();

    expect(selected.map(i => i.id)).toEqual(['data-libraries']);
    expect(document.activeElement).toBe(button('area-data'));
    expect(entry('area-data').classList).not.toContain('open');
  });

  it('moves focus between areas with the arrow keys, wrapping around', () => {
    button('area-data').focus();
    key(button('area-data'), 'ArrowDown');
    expect(document.activeElement).toBe(button('area-settings'));

    key(button('area-settings'), 'ArrowDown');
    expect(document.activeElement).toBe(button('area-home'));

    key(button('area-home'), 'ArrowUp');
    expect(document.activeElement).toBe(button('area-settings'));
    expect(button('area-settings').tabIndex).toBe(0);
  });

  it('Arrow Right enters the flyout, Escape returns to the area', () => {
    button('area-home').focus();
    key(button('area-home'), 'ArrowRight');

    const items = entry('area-home').querySelectorAll<HTMLElement>('.flyout-item');
    expect(document.activeElement).toBe(items[0]);

    key(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);

    key(items[1], 'Escape');
    expect(document.activeElement).toBe(button('area-home'));
    expect(entry('area-home').classList).not.toContain('open');
  });

  describe('pointer robustness (AB#5516: flyout closed while moving towards it)', () => {
    it('bridges the gap: the flyout host starts at the icon edge and is part of the entry', () => {
      const host = entry('area-settings').querySelector('.rail-flyout-host');

      expect(host).not.toBeNull();
      expect(host!.querySelector('#rail-flyout-area-settings')).not.toBeNull();
    });

    it('opens on hover only after the intent delay', () => {
      hover('area-home', 'mouseenter');
      expect(isOpen('area-home')).toBe(false);

      advance(RAIL_FLYOUT_OPEN_DELAY - 1);
      expect(isOpen('area-home')).toBe(false);

      advance(1);
      expect(isOpen('area-home')).toBe(true);
    });

    it('does not open when the pointer only passes over the icon', () => {
      hover('area-home', 'mouseenter');
      advance(RAIL_FLYOUT_OPEN_DELAY / 2);
      hover('area-home', 'mouseleave');
      advance(RAIL_FLYOUT_OPEN_DELAY + RAIL_FLYOUT_CLOSE_DELAY);

      expect(isOpen('area-home')).toBe(false);
    });

    it('stays open when the pointer comes back within the grace delay', () => {
      hoverOpen('area-settings');
      hover('area-settings', 'mouseleave');
      advance(RAIL_FLYOUT_CLOSE_DELAY - 50);
      expect(isOpen('area-settings')).toBe(true);

      // e.g. the pointer cut a corner and now reaches the flyout (inside the entry)
      hover('area-settings', 'mouseenter');
      advance(RAIL_FLYOUT_CLOSE_DELAY * 2);

      expect(isOpen('area-settings')).toBe(true);
    });

    it('closes after the grace delay once the pointer left icon and flyout', () => {
      hoverOpen('area-settings');
      hover('area-settings', 'mouseleave');
      advance(RAIL_FLYOUT_CLOSE_DELAY - 1);
      expect(isOpen('area-settings')).toBe(true);

      advance(1);
      expect(isOpen('area-settings')).toBe(false);
      expect(button('area-settings').getAttribute('aria-expanded')).toBe('false');
    });

    it('switches to another area at once while a flyout is showing', () => {
      hoverOpen('area-home');
      hover('area-home', 'mouseleave');
      hover('area-data', 'mouseenter');

      expect(isOpen('area-data')).toBe(true);
      expect(isOpen('area-home')).toBe(false);
    });
  });

  describe('pinned by click', () => {
    it('a mouse click on the gear navigates and pins the flyout open', () => {
      const selected: ShellNavNode[] = [];
      fixture.componentInstance.areaSelected.subscribe(area => selected.push(area));

      pointerClick(button('area-settings'));

      expect(selected.map(a => a.id)).toEqual(['area-settings']);
      expect(isOpen('area-settings')).toBe(true);
      expect(entry('area-settings').classList).toContain('pinned');

      hover('area-settings', 'mouseleave');
      advance(RAIL_FLYOUT_CLOSE_DELAY * 5);
      expect(isOpen('area-settings')).toBe(true);
    });

    it('keeps a hover-opened flyout open when the icon is clicked', () => {
      hoverOpen('area-settings');
      pointerClick(button('area-settings'));
      hover('area-settings', 'mouseleave');
      advance(RAIL_FLYOUT_CLOSE_DELAY * 2);

      expect(isOpen('area-settings')).toBe(true);
    });

    it('does not open other flyouts on hover while pinned', () => {
      pointerClick(button('area-settings'));
      hover('area-settings', 'mouseleave');
      hoverOpen('area-home');

      expect(isOpen('area-home')).toBe(false);
      expect(isOpen('area-settings')).toBe(true);
    });

    it('stays open on clicks inside the flyout that are not entries', () => {
      pointerClick(button('area-settings'));
      entry('area-settings').querySelector<HTMLElement>('.flyout-title')!
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      entry('area-settings').dispatchEvent(new FocusEvent('focusout', { relatedTarget: null }));
      fixture.detectChanges();

      expect(isOpen('area-settings')).toBe(true);
    });

    it('closes on an outside click', () => {
      pointerClick(button('area-settings'));
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      fixture.detectChanges();

      expect(isOpen('area-settings')).toBe(false);
    });

    it('closes on Escape', () => {
      pointerClick(button('area-settings'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(isOpen('area-settings')).toBe(false);
    });

    it('closes when an entry is chosen', () => {
      const selected: ShellNavNode[] = [];
      fixture.componentInstance.itemSelected.subscribe(item => selected.push(item));
      pointerClick(button('area-settings'));

      pointerClick(entry('area-settings').querySelector<HTMLElement>('.flyout-item')!);

      expect(selected.map(i => i.id)).toEqual(['settings-sign-in']);
      expect(isOpen('area-settings')).toBe(false);
    });

    it('closes when focus moves outside the entry', () => {
      pointerClick(button('area-settings'));
      entry('area-settings').dispatchEvent(new FocusEvent('focusout', { relatedTarget: button('area-home') }));
      fixture.detectChanges();

      expect(isOpen('area-settings')).toBe(false);
    });

    it('a second click on the same icon closes it without navigating again', () => {
      const selected: ShellNavNode[] = [];
      fixture.componentInstance.areaSelected.subscribe(area => selected.push(area));
      pointerClick(button('area-settings'));

      pointerClick(button('area-settings'));

      expect(isOpen('area-settings')).toBe(false);
      expect(selected.length).toBe(1);
    });

    it('Arrow Right pins too: the pointer leaving does not close it', () => {
      button('area-home').focus();
      key(button('area-home'), 'ArrowRight');
      hover('area-home', 'mouseleave');
      advance(RAIL_FLYOUT_CLOSE_DELAY * 2);

      expect(isOpen('area-home')).toBe(true);
    });
  });
});

describe('ShellRailComponent messages', () => {
  it('labels the rail through the messages input', () => {
    const fixture = TestBed.createComponent(ShellRailComponent);
    fixture.componentRef.setInput('messages', { railLabel: 'Bereiche' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')?.getAttribute('aria-label')).toBe('Bereiche');
  });
});

describe('ShellRailComponent areas without entries (AB#5621)', () => {
  const INBOX = node('area-inbox', [], { navigable: true });
  let fixture: ComponentFixture<ShellRailComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    if (typeof window.matchMedia !== 'function') {
      Object.defineProperty(window, 'matchMedia', { value: () => undefined, writable: true, configurable: true });
    }
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: false, media: query } as unknown as MediaQueryList));
    fixture = TestBed.createComponent(ShellRailComponent);
    fixture.componentRef.setInput('areas', [INBOX, DATA]);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });
  afterEach(() => vi.restoreAllMocks());

  it('emits areaSelected for a mouse click and for Enter/Space, without a flyout', () => {
    const selected: string[] = [];
    fixture.componentInstance.areaSelected.subscribe(area => selected.push(area.id));
    const inbox = element.querySelector<HTMLButtonElement>('[data-area-id="area-inbox"]')!;

    inbox.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    inbox.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    fixture.detectChanges();

    expect(selected).toEqual(['area-inbox', 'area-inbox']);
    expect(inbox.getAttribute('aria-expanded')).toBeNull();
    expect(element.querySelector('[data-entry-id="area-inbox"] .rail-flyout')).toBeNull();
  });
});

describe('ShellRailComponent badges (AB#5621)', () => {
  const INBOX = node('area-inbox', [node('inbox-uploads'), node('inbox-todos', [node('inbox-todos-mine')])], { navigable: false });
  let fixture: ComponentFixture<ShellRailComponent>;
  let element: HTMLElement;

  const badge = (id: string): HTMLElement | null => element.querySelector<HTMLElement>(`[data-badge="${id}"]`);
  const areaButton = (id: string): HTMLButtonElement => element.querySelector<HTMLButtonElement>(`[data-area-id="${id}"]`)!;
  const render = (areas: ShellNavNode[], badges?: Record<string, unknown>): void => {
    fixture.componentRef.setInput('areas', areas);
    if (badges) {
      fixture.componentRef.setInput('badges', badges);
    }
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(ShellRailComponent);
    element = fixture.nativeElement as HTMLElement;
  });

  it('shows a count on the area icon and adds it to the accessible name', () => {
    render([INBOX, DATA], { 'area-inbox': 3 });

    expect(badge('area-inbox')?.textContent?.trim()).toBe('3');
    expect(badge('area-inbox')?.getAttribute('aria-hidden')).toBe('true');
    expect(areaButton('area-inbox').getAttribute('aria-label')).toBe('area-inbox, 3 open');
    expect(areaButton('area-data').getAttribute('aria-label')).toBe('area-data');
  });

  it('hides the badge for 0, null, undefined and missing counts', () => {
    render([INBOX, DATA], { 'area-inbox': 0, 'area-data': null, 'inbox-uploads': undefined });

    expect(element.querySelectorAll('[data-badge]').length).toBe(0);
    expect(areaButton('area-inbox').getAttribute('aria-label')).toBe('area-inbox');
  });

  it('shows badges on flyout entries (also nested ones) with screen-reader text', () => {
    render([INBOX], { 'inbox-uploads': 2, 'inbox-todos-mine': { count: 5, label: '5 open ToDos', attention: true } });

    const uploads = badge('inbox-uploads')!;
    expect(uploads.textContent?.trim()).toBe('2');
    expect(uploads.nextElementSibling?.textContent).toBe(', 2 open');
    const todos = badge('inbox-todos-mine')!;
    expect(todos.classList.contains('attention')).toBe(true);
    expect(todos.nextElementSibling?.textContent).toBe(', 5 open ToDos');
  });

  it('falls back to the node badgeCount; the badges input wins', () => {
    render([{ ...INBOX, badgeCount: 4 }, { ...DATA, badgeCount: 7 }], { 'area-data': 1 });

    expect(badge('area-inbox')?.textContent?.trim()).toBe('4');
    expect(badge('area-data')?.textContent?.trim()).toBe('1');
  });

  it('caps large counts at 99+ and keeps the full count for screen readers', () => {
    render([INBOX], { 'area-inbox': 250 });

    expect(badge('area-inbox')?.textContent?.trim()).toBe('99+');
    expect(areaButton('area-inbox').getAttribute('aria-label')).toBe('area-inbox, 250 open');
  });

  it('translates the badge texts through the messages input', () => {
    fixture.componentRef.setInput('messages', { navBadge: '{count} offen', navItemWithBadge: '{label} ({badge})' });
    render([INBOX], { 'area-inbox': 3 });

    expect(areaButton('area-inbox').getAttribute('aria-label')).toBe('area-inbox (3 offen)');
  });
});
