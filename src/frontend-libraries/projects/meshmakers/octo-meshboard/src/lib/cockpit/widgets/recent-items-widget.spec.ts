import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { RecentItemsWidgetConfig } from '../../models/meshboard.models';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { COCKPIT_RECENT_ITEMS, CockpitRecentItem, CockpitRecentItemsSource, provideCockpitWidgetHost } from '../cockpit-host';
import { RecentItemsConfigDialogComponent } from './recent-items-config-dialog.component';
import { COCKPIT_WIDGET_MESSAGES, resolveCockpitWidgetMessages } from '../cockpit-messages';
import { DEFAULT_RECENT_ITEMS_MAX, recentRelativeTime, RecentItemsWidgetComponent } from './recent-items-widget.component';

const base = { id: 'r1', title: 'Recently opened', col: 4, row: 4, colSpan: 3, rowSpan: 2, dataSource: { type: 'static' as const } };

const item = (key: string, extra: Partial<CockpitRecentItem> = {}): CockpitRecentItem => ({
  key, kind: 'page', label: `${key} label`, kindLabel: 'Integration', lastVisitedAt: Date.now() - 3 * 60_000, href: `/app${key}`, ...extra
});

describe('RecentItemsWidgetComponent (AB#5558)', () => {
  const boardState = { setWidgetHiddenForViewer: vi.fn(), setWidgetContentHeight: vi.fn() };
  let revision: ReturnType<typeof signal<number>>;
  let source: { revision: ReturnType<typeof signal<number>>; items: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn>; openPalette?: ReturnType<typeof vi.fn>; paletteShortcut?: string };

  function configure(withSource = true): void {
    revision = signal(0);
    source = { revision, items: vi.fn().mockResolvedValue([]), open: vi.fn(), openPalette: vi.fn(), paletteShortcut: '⌘K' };
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: boardState },
        ...(withSource ? [{ provide: COCKPIT_RECENT_ITEMS, useValue: source as unknown as CockpitRecentItemsSource }] : [])
      ]
    });
  }

  async function render(config: Partial<RecentItemsWidgetConfig> = {}) {
    const fixture = TestBed.createComponent(RecentItemsWidgetComponent);
    fixture.componentRef.setInput('config', { ...base, type: 'recentItems', ...config });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => vi.clearAllMocks());

  it('lists the host entries as real links with kind and relative time', async () => {
    configure();
    source.items.mockResolvedValue([item('/a', { kind: 'board', label: 'Finance Cockpit', kindLabel: 'MeshBoard' }), item('/b', { kind: 'entity' })]);
    const fixture = await render();
    expect(source.items).toHaveBeenCalledWith(DEFAULT_RECENT_ITEMS_MAX);
    const list: HTMLElement = fixture.nativeElement.querySelector('ul[role="list"]');
    expect(list.getAttribute('aria-label')).toBe('Recently opened');
    const links = list.querySelectorAll('a.recent-row');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/app/a');
    expect(links[0].textContent).toContain('Finance Cockpit');
    expect(links[0].textContent).toContain('MeshBoard');
    expect(links[0].querySelector('.recent-glyph')?.textContent).toBe('#');
    expect(links[1].querySelector('.recent-glyph')?.textContent).toBe('◎');
    const time = links[0].querySelector('time')!;
    expect(time.textContent).toBe('3 min ago');
    expect(time.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(boardState.setWidgetHiddenForViewer).not.toHaveBeenCalled();
  });

  it('translates its texts through COCKPIT_WIDGET_MESSAGES (AB#5622)', async () => {
    configure();
    TestBed.configureTestingModule({ providers: [{ provide: COCKPIT_WIDGET_MESSAGES, useValue: {
      recentEmpty: 'Noch nichts geöffnet.', recentPaletteHint: 'zeigt dieselbe Liste', recentPaletteTitle: 'Befehlspalette öffnen'
    } }] });
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-state="empty"]').textContent).toContain('Noch nichts geöffnet.');
    const hint = fixture.nativeElement.querySelector('.palette-hint') as HTMLElement;
    expect(hint.textContent).toContain('zeigt dieselbe Liste');
    expect(hint.getAttribute('title')).toBe('Befehlspalette öffnen');
  });

  it('asks for the configured number of rows and never shows more', async () => {
    configure();
    source.items.mockResolvedValue([item('/a'), item('/b'), item('/c')]);
    const fixture = await render({ maxItems: 2 });
    expect(source.items).toHaveBeenCalledWith(2);
    expect(fixture.nativeElement.querySelectorAll('a.recent-row').length).toBe(2);
  });

  it('opens a plain left click through the host and leaves modified clicks to the browser', async () => {
    configure();
    const entry = item('/a');
    source.items.mockResolvedValue([entry]);
    const fixture = await render();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.recent-row');

    const plain = new MouseEvent('click', { button: 0, bubbles: true, cancelable: true });
    link.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(source.open).toHaveBeenCalledWith(entry);

    source.open.mockClear();
    const modified = new MouseEvent('click', { button: 0, metaKey: true, bubbles: true, cancelable: true });
    link.addEventListener('click', e => e.preventDefault(), { once: false });
    link.dispatchEvent(modified);
    expect(source.open).not.toHaveBeenCalled();
  });

  it('shows the empty state and the palette hint', async () => {
    configure();
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-state="empty"]').textContent).toContain('Nothing opened yet');
    const hint: HTMLButtonElement = fixture.nativeElement.querySelector('.palette-hint');
    expect(hint.textContent).toContain('⌘K');
    hint.click();
    expect(source.openPalette).toHaveBeenCalled();
  });

  it('re-reads when the host history changes', async () => {
    configure();
    const fixture = await render();
    expect(source.items).toHaveBeenCalledTimes(1);
    source.items.mockResolvedValue([item('/new')]);
    revision.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(source.items).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[data-recent="/new"]')).toBeTruthy();
  });

  it('says so when the history cannot be read', async () => {
    configure();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    source.items.mockRejectedValue(new Error('storage blocked'));
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-state="error"]').textContent).toContain('could not be read');
    expect(fixture.componentInstance.error()).not.toBeNull();
    warn.mockRestore();
  });

  it('without a host source says "Not available" and collapses outside edit mode', async () => {
    configure(false);
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-state="unavailable"]').textContent).toContain('Not available');
    expect(boardState.setWidgetHiddenForViewer).toHaveBeenCalledWith('r1', true);
  });

  it('formats relative times like the command palette', () => {
    const now = 10 * 24 * 3_600_000;
    expect(recentRelativeTime(now - 10_000, now)).toBe('just now');
    expect(recentRelativeTime(now - 12 * 60_000, now)).toBe('12 min ago');
    expect(recentRelativeTime(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(recentRelativeTime(now - 26 * 3_600_000, now)).toBe('yesterday');
    expect(recentRelativeTime(now - 4 * 24 * 3_600_000, now)).toBe('4 days ago');
    const de = resolveCockpitWidgetMessages({ recentJustNow: 'gerade eben', recentMinutesAgo: 'vor {count} Min.', recentYesterday: 'gestern' });
    expect(recentRelativeTime(now - 10_000, now, de)).toBe('gerade eben');
    expect(recentRelativeTime(now - 12 * 60_000, now, de)).toBe('vor 12 Min.');
    expect(recentRelativeTime(now - 26 * 3_600_000, now, de)).toBe('gestern');
    expect(recentRelativeTime(now - 3 * 3_600_000, now, de)).toBe('3 h ago');
  });

  it('is provided through provideCockpitWidgetHost({ recents })', () => {
    const host = { items: async () => [], open: () => undefined } satisfies CockpitRecentItemsSource;
    TestBed.configureTestingModule({ providers: [...provideCockpitWidgetHost({ recents: () => host })] });
    expect(TestBed.inject(COCKPIT_RECENT_ITEMS)).toBe(host);
  });

  describe('config dialog', () => {
    const windowRef = { close: vi.fn() };

    function dialog(initial?: number): RecentItemsConfigDialogComponent {
      TestBed.configureTestingModule({ providers: [RecentItemsConfigDialogComponent, { provide: WindowRef, useValue: windowRef }] });
      const component = TestBed.inject(RecentItemsConfigDialogComponent);
      component.initialMaxItems = initial;
      component.ngOnInit();
      return component;
    }

    it('defaults to eight rows and saves the count', () => {
      const component = dialog();
      expect(component.maxItems).toBe(8);
      component.maxItems = 5;
      component.onSave();
      expect(windowRef.close).toHaveBeenCalledWith({ ckTypeId: '', maxItems: 5 });
    });

    it('clamps the count to 1…20', () => {
      const component = dialog(12);
      expect(component.maxItems).toBe(12);
      component.maxItems = 99;
      component.onSave();
      expect(windowRef.close).toHaveBeenLastCalledWith({ ckTypeId: '', maxItems: 20 });
    });
  });
});
