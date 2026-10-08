import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject } from 'rxjs';
import { PALETTE_PROVIDERS, PALETTE_RECENT_ITEMS_SOURCE, PaletteProvider, PaletteQuery, PaletteResult } from './command-palette.models';
import { CommandPaletteComponent } from './command-palette.component';
import { CommandPaletteService } from './command-palette.service';
import { COMMAND_PALETTE_MESSAGES } from './command-palette.messages';

describe('CommandPaletteComponent', () => {
  const runAdapters = vi.fn().mockResolvedValue(undefined);
  const runPools = vi.fn().mockResolvedValue(undefined);
  const runTheme = vi.fn().mockResolvedValue(undefined);
  const runSwitchTenant = vi.fn().mockResolvedValue({ query: '/' });
  const copyRtId = vi.fn().mockResolvedValue(undefined);

  const pages: PaletteResult[] = [
    { id: 'page:adapters', group: 'page', label: 'Adapters', path: ['Integration'], run: runAdapters,
      actions: [
        { id: 'open', label: 'Open', hint: '↵', run: () => runAdapters('open') },
        { id: 'copy', label: 'Copy rtId', run: copyRtId }
      ] },
    { id: 'page:pools', group: 'page', label: 'Pools', path: ['Integration'], run: runPools },
    { id: 'page:data-flows', group: 'page', label: 'Data Flows', path: ['Integration'], run: vi.fn() }
  ];
  const actions: PaletteResult[] = [
    { id: 'action:theme', group: 'action', label: 'Switch to light theme', run: runTheme },
    { id: 'action:tenant', group: 'action', label: 'Switch tenant…', run: runSwitchTenant }
  ];

  function provider(id: string, groups: PaletteProvider['groups'], search: (q: PaletteQuery) => PaletteResult[]): PaletteProvider {
    return { id, groups, reset: vi.fn(), search: vi.fn((q: PaletteQuery): Observable<PaletteResult[]> => of(search(q))) };
  }

  const pagesProvider = provider('pages', ['page'], () => pages);
  const actionsProvider = provider('actions', ['action'], q => q.text || q.scope === 'action' ? actions : []);

  let fixture: ComponentFixture<CommandPaletteComponent>;
  let service: CommandPaletteService;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const input = (): HTMLInputElement => element().querySelector('input')!;
  const options = (): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>('[role="option"]'));
  const optionLabels = () => options().map(option => option.querySelector('.cp-label')?.textContent?.replace(/\s+/g, ' ').trim());
  const selected = () => options().find(option => option.getAttribute('aria-selected') === 'true');

  function key(name: string, init: KeyboardEventInit = {}): void {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
    fixture.detectChanges();
  }

  function type(value: string): void {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function create(initialQuery = ''): Promise<void> {
    service.open(initialQuery);
    fixture = TestBed.createComponent(CommandPaletteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [CommandPaletteComponent],
      providers: [
        { provide: PALETTE_PROVIDERS, useValue: pagesProvider, multi: true },
        { provide: PALETTE_PROVIDERS, useValue: actionsProvider, multi: true },
        { provide: PALETTE_RECENT_ITEMS_SOURCE, useValue: { frecencies: () => new Map<string, number>() } }
      ]
    });
    service = TestBed.inject(CommandPaletteService);
  });

  afterEach(() => service.close());

  it('renders a modal dialog with a combobox driving a listbox', async () => {
    await create();
    const dialog = element().querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().getAttribute('aria-controls')).toBe('cp-listbox');
    expect(element().querySelector('#cp-listbox')?.getAttribute('role')).toBe('listbox');
    expect(input().getAttribute('aria-activedescendant')).toBe('cp-option-0');
    expect(selected()?.id).toBe('cp-option-0');
  });

  it('gives every row the same four columns, so the Tab key lines up', async () => {
    await create();
    for (const option of options()) {
      expect(Array.from(option.children).map(child => child.className.split(' ')[0])).toEqual(['cp-icon', 'cp-label', 'cp-side', 'cp-tab-col']);
    }
    const [adapters, dataFlows] = options();
    expect(adapters.querySelector('.cp-tab-col .cp-tab-hint')).not.toBeNull();
    expect(dataFlows.querySelector('.cp-tab-col .cp-tab-hint')).toBeNull();
  });

  it('keeps the placeholder short and offers a Cancel button for the full-screen phone palette', async () => {
    await create();
    expect(input().placeholder.length).toBeLessThanOrEqual(32);
    element().querySelector<HTMLButtonElement>('.cp-close')!.click();
    expect(service.isOpen()).toBe(false);
  });

  it('focuses the input and resets the providers on open', async () => {
    await create();
    expect(document.activeElement).toBe(input());
    expect(pagesProvider.reset).toHaveBeenCalled();
    expect(actionsProvider.reset).toHaveBeenCalled();
  });

  it('groups the results under section headers and highlights the match', async () => {
    await create();
    type('ada');
    expect(optionLabels()).toEqual(['Adapters']);
    const header = element().querySelector('.cp-group-header');
    expect(header?.textContent?.trim()).toBe('Pages');
    expect(element().querySelector('mark')?.textContent).toBe('Ada');
    expect(element().querySelector('.cp-description')?.textContent).toContain('Integration ›');
  });

  it('adopts the initial query and a scoping prefix', async () => {
    await create('>');
    expect(input().value).toBe('>');
    expect(optionLabels()).toEqual(['Switch tenant…', 'Switch to light theme']);
    expect(pagesProvider.search).not.toHaveBeenCalledWith(expect.objectContaining({ scope: 'action' }));
  });

  it('moves with arrows (wrapping), Home and End', async () => {
    await create();
    expect(optionLabels()).toEqual(['Adapters', 'Data Flows', 'Pools']);
    key('ArrowDown');
    expect(selected()?.textContent).toContain('Data Flows');
    expect(input().getAttribute('aria-activedescendant')).toBe('cp-option-1');
    key('End');
    expect(selected()?.textContent).toContain('Pools');
    key('ArrowDown');
    expect(selected()?.textContent).toContain('Adapters');
    key('ArrowUp');
    expect(selected()?.textContent).toContain('Pools');
    key('Home');
    expect(selected()?.textContent).toContain('Adapters');
  });

  it('runs the highlighted result with Enter and closes', async () => {
    await create();
    key('ArrowDown');
    key('ArrowDown');
    key('Enter');
    await fixture.whenStable();
    expect(runPools).toHaveBeenCalledWith('open');
    expect(service.isOpen()).toBe(false);
  });

  it('opens in a new tab with Cmd/Ctrl+Enter', async () => {
    await create();
    key('Enter', { ctrlKey: true });
    await fixture.whenStable();
    expect(runAdapters).toHaveBeenCalledWith('newTab');
  });

  it('reopens with the query an action returns', async () => {
    await create();
    type('tenant');
    key('Enter');
    await fixture.whenStable();
    expect(runSwitchTenant).toHaveBeenCalled();
    expect(service.isOpen()).toBe(true);
    expect(service.request().query).toBe('/');
  });

  it('opens the actions sub-menu with Tab and runs an action', async () => {
    await create();
    key('Tab');
    const subMenu = element().querySelector('#cp-actions');
    expect(subMenu?.getAttribute('role')).toBe('listbox');
    expect(input().getAttribute('aria-controls')).toBe('cp-actions');
    expect(optionLabels()).toEqual(['Open', 'Copy rtId']);
    expect(input().getAttribute('aria-activedescendant')).toBe('cp-action-0');
    key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe('cp-action-1');
    key('Enter');
    await fixture.whenStable();
    expect(copyRtId).toHaveBeenCalled();
    expect(service.isOpen()).toBe(false);
  });

  it('does not open a sub-menu for a result without actions', async () => {
    await create();
    key('ArrowDown');
    key('Tab');
    expect(element().querySelector('#cp-actions')).toBeNull();
  });

  it('keeps Tab inside the dialog and closes the sub-menu with Tab, Shift+Tab or Esc', async () => {
    await create();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input().dispatchEvent(tab);
    fixture.detectChanges();
    expect(tab.defaultPrevented).toBe(true);
    key('Tab');
    expect(element().querySelector('#cp-actions')).toBeNull();
    key('Tab');
    key('Tab', { shiftKey: true });
    expect(element().querySelector('#cp-actions')).toBeNull();
    key('Tab');
    key('Escape');
    expect(element().querySelector('#cp-actions')).toBeNull();
    expect(service.isOpen()).toBe(true);
  });

  it('closes on Escape without letting it reach other handlers', async () => {
    await create();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    key('Escape');
    document.removeEventListener('keydown', outer);
    expect(service.isOpen()).toBe(false);
    expect(outer).not.toHaveBeenCalled();
  });

  it('closes when the backdrop is pressed, not the dialog', async () => {
    await create();
    element().querySelector('.cp-dialog')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(service.isOpen()).toBe(true);
    element().querySelector('.cp-scrim')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(service.isOpen()).toBe(false);
  });

  it('highlights on hover and runs on click', async () => {
    await create();
    options()[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    fixture.detectChanges();
    expect(selected()?.textContent).toContain('Pools');
    options()[2].click();
    await fixture.whenStable();
    expect(runPools).toHaveBeenCalledWith('open');
  });

  it('replaces the query when opened again while open', async () => {
    await create();
    service.open('>');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input().value).toBe('>');
    expect(optionLabels()).toEqual(['Switch tenant…', 'Switch to light theme']);
  });

  it('binds aria-expanded to whether options are shown', async () => {
    await create();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    type('zzzz');
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps focus in the input when the dialog chrome is pressed', async () => {
    await create();
    const onFooter = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    element().querySelector('.cp-footer')!.dispatchEvent(onFooter);
    expect(onFooter.defaultPrevented).toBe(true);
    const onInput = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    input().dispatchEvent(onInput);
    expect(onInput.defaultPrevented).toBe(false);
    expect(service.isOpen()).toBe(true);
  });

  it('renders every footer key hint as its own key + label pair (AB#5621)', async () => {
    await create();
    const prefixes = [...element().querySelectorAll('.cp-footer .cp-prefix')] as HTMLElement[];
    expect(prefixes.map(p => p.querySelector('kbd')?.textContent)).toEqual(['>', '@', '#', '/']);
    for (const prefix of prefixes) {
      expect(prefix.textContent!.replace(prefix.querySelector('kbd')!.textContent!, '').trim().length).toBeGreaterThan(0);
    }
  });

  it('shows an empty state', async () => {
    await create();
    type('zzzz');
    expect(options()).toHaveLength(0);
    expect(element().querySelector('.cp-empty')?.textContent).toContain('No results for “zzzz”');
    expect(element().querySelector('[role="status"]')?.textContent).toContain('0 results');
  });
});

describe('CommandPaletteComponent with late results', () => {
  const late = new Subject<PaletteResult[]>();
  const runPage = vi.fn().mockResolvedValue(undefined);
  const runEntity = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CommandPaletteComponent],
      providers: [
        { provide: PALETTE_PROVIDERS, multi: true, useValue: {
          id: 'pages', groups: ['page'],
          search: () => of([{ id: 'page:adapters', group: 'page', label: 'Adapters', run: runPage } satisfies PaletteResult])
        } satisfies PaletteProvider },
        { provide: PALETTE_PROVIDERS, multi: true, useValue: {
          id: 'entities', groups: ['entity'], search: () => late
        } satisfies PaletteProvider },
        { provide: PALETTE_RECENT_ITEMS_SOURCE, useValue: { frecencies: () => new Map<string, number>() } }
      ]
    });
  });

  it('appends late groups below the shown rows so Enter stays on what the user sees', async () => {
    const service = TestBed.inject(CommandPaletteService);
    // 'adapters' is a long query: a fresh ranking would list entities first.
    service.open('adapters');
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const labels = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="option"] .cp-label'))
      .map(option => option.textContent?.trim());
    expect(labels()).toEqual(['Adapters']);

    late.next([{ id: 'entity:a1', group: 'entity', label: 'adapters-edge', run: runEntity }]);
    fixture.detectChanges();
    expect(labels()).toEqual(['Adapters', 'adapters-edge']);

    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(runPage).toHaveBeenCalled();
    expect(runEntity).not.toHaveBeenCalled();
  });
});

describe('CommandPaletteComponent tokens and messages', () => {
  const run = vi.fn().mockResolvedValue(undefined);
  const rows: PaletteResult[] = [
    { id: 'page:alpha', group: 'page', label: 'Alpha pools', recentKey: '/t/alpha', run },
    { id: 'page:beta', group: 'page', label: 'Beta pools', recentKey: '/t/beta', run }
  ];
  const pagesProvider: PaletteProvider = { id: 'pages', groups: ['page'], search: () => of(rows) };

  async function render(providers: unknown[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [CommandPaletteComponent],
      providers: [{ provide: PALETTE_PROVIDERS, useValue: pagesProvider, multi: true }, ...providers as never[]]
    });
    const service = TestBed.inject(CommandPaletteService);
    service.open('pools');
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const labels = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('[role="option"] .cp-label')).map(label => label.textContent?.trim());

  it('works without a recent items source (no frecency boost)', async () => {
    const element = await render([]);
    expect(labels(element)).toEqual(['Alpha pools', 'Beta pools']);
  });

  it('boosts rows by the frecency of the recent items source', async () => {
    const element = await render([{ provide: PALETTE_RECENT_ITEMS_SOURCE, useValue: { frecencies: () => new Map([['/t/beta', 1]]) } }]);
    expect(labels(element)).toEqual(['Beta pools', 'Alpha pools']);
  });

  it('translates group headers and status through COMMAND_PALETTE_MESSAGES', async () => {
    const element = await render([{ provide: COMMAND_PALETTE_MESSAGES, useValue: { groupPage: 'Seiten', manyResults: '{count} Treffer' } }]);
    expect(element.querySelector('.cp-group-header')?.textContent?.trim()).toBe('Seiten');
    expect(element.querySelector('.cp-status')?.textContent?.trim()).toBe('2 Treffer');
    expect(element.querySelector('input')?.getAttribute('placeholder')).toBe('Search pages, entities, boards…');
  });
});
