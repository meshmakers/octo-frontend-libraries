import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SVGIconComponent } from '@progress/kendo-angular-icons';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import {
  PALETTE_PROVIDERS,
  PALETTE_RECENT_ITEMS_SOURCE,
  PaletteAction,
  PaletteGroup,
  PaletteQuery,
  PaletteResult,
  PaletteRunMode,
  PaletteRunResult
} from './command-palette.models';
import { CommandPaletteMessages, commandPaletteMessages, formatCommandPaletteMessage, paletteGroupLabel } from './command-palette.messages';
import { CommandPaletteService } from './command-palette.service';
import { parsePaletteQuery } from './palette-query';
import { highlightSegments, rankResults, RankedGroup, stabilizeRanking } from './palette-ranking';
import { searchProviders } from './palette-search';

interface PaletteRow {
  index: number;
  result: PaletteResult;
  segments: { text: string; match: boolean }[];
  side: string;
}

interface PaletteSection {
  group: PaletteGroup;
  label: string;
  rows: PaletteRow[];
}

/**
 * The command palette overlay (Cmd/Ctrl+K, ui-concept §4). Render it only while
 * {@link CommandPaletteService.isOpen} — one component instance is one palette session:
 *
 * ```html
 * @if (commandPalette.isOpen()) { <mm-command-palette /> }
 * ```
 *
 * Results come from the {@link PALETTE_PROVIDERS}; the frecency boost from the optional
 * {@link PALETTE_RECENT_ITEMS_SOURCE}.
 *
 * Accessibility: modal dialog; the input is a combobox driving a listbox via
 * `aria-activedescendant`, so focus never leaves the input (Tab is taken for
 * the actions sub-menu, which keeps keyboard focus trapped in the dialog);
 * focus goes back to the invoking element on close (the service does that).
 */
@Component({
  selector: 'mm-command-palette',
  imports: [SVGIconComponent],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommandPaletteComponent implements OnInit {
  private readonly palette = inject(CommandPaletteService);
  private readonly providers = inject(PALETTE_PROVIDERS, { optional: true }) ?? [];
  private readonly recents = inject(PALETTE_RECENT_ITEMS_SOURCE, { optional: true });

  /** Translations; members left out fall back to {@link COMMAND_PALETTE_MESSAGES}, then English. */
  readonly messages = input<Partial<CommandPaletteMessages> | null>(null);
  protected readonly m = commandPaletteMessages(this.messages);
  private readonly destroyRef = inject(DestroyRef);

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly query = signal('');
  private readonly query$ = new BehaviorSubject<string>('');
  private readonly ranked = signal<RankedGroup[]>([]);
  private readonly parsed = computed<PaletteQuery>(() => parsePaletteQuery(this.query()));

  private readonly results = computed(() => this.ranked().flatMap(section => section.results));
  /** Id of the highlighted row; null means "the first row" (reset whenever the user types). */
  private readonly activeId = signal<string | null>(null);
  protected readonly activeIndex = computed(() => {
    const results = this.results();
    const id = this.activeId();
    const index = id === null ? -1 : results.findIndex(result => result.id === id);
    return index >= 0 ? index : results.length > 0 ? 0 : -1;
  });

  /** The result whose actions sub-menu is open (Tab), or null. */
  protected readonly actionsFor = signal<PaletteResult | null>(null);
  protected readonly activeActionIndex = signal(0);

  protected readonly sections = computed<PaletteSection[]>(() => {
    const text = this.parsed().text;
    let index = 0;
    return this.ranked().map(section => ({
      group: section.group,
      label: paletteGroupLabel(section.group, this.m()),
      rows: section.results.map(result => ({
        index: index++,
        result,
        segments: result.group === 'ai' ? [{ text: result.label, match: false }] : highlightSegments(result.label, text),
        side: [result.path?.length ? `${result.path.join(' › ')} ›` : '', result.description ?? ''].filter(Boolean).join('  ')
      }))
    }));
  });

  protected readonly activeDescendant = computed(() => {
    if (this.actionsFor()) {
      return `cp-action-${this.activeActionIndex()}`;
    }
    const index = this.activeIndex();
    return index >= 0 ? `cp-option-${index}` : null;
  });

  /** Whether a listbox with options is shown (bound to the combobox's aria-expanded). */
  protected readonly expanded = computed(() =>
    this.actionsFor() ? (this.actionsFor()?.actions?.length ?? 0) > 0 : this.results().length > 0);

  protected readonly statusText = computed(() => {
    const count = this.results().length;
    return count === 1 ? this.m().oneResult : formatCommandPaletteMessage(this.m().manyResults, { count });
  });

  protected readonly emptyText = computed(() =>
    this.parsed().text ? formatCommandPaletteMessage(this.m().noResultsFor, { text: this.parsed().text }) : this.m().typeToSearch);

  protected get modifierLabel(): string {
    return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
  }

  constructor() {
    // open('…') while already open replaces the query (e.g. the top bar's trigger).
    effect(() => {
      const request = this.palette.request();
      untracked(() => this.setQuery(request.query));
    });
    afterNextRender(() => this.focusInput());
  }

  ngOnInit(): void {
    for (const provider of this.providers) {
      provider.reset?.();
    }
    this.setQuery(this.palette.request().query);

    // Frecency is read once per session; a palette session is short.
    const now = Date.now();
    const frecency = this.recents?.frecencies(now) ?? new Map<string, number>();
    const frecencyOf = (key: string): number => frecency.get(key) ?? 0;

    const parsed$ = this.query$.pipe(distinctUntilChanged(), map(raw => parsePaletteQuery(raw)));
    // Late answers for the same query only fill in below what is shown (§4.2 rule 5).
    let rankedFor: string | null = null;
    searchProviders(this.providers, parsed$).pipe(
      map(results => {
        const raw = this.query$.value;
        const fresh = rankResults(results, parsePaletteQuery(raw), frecencyOf);
        const ranked = raw === rankedFor ? stabilizeRanking(this.ranked(), fresh) : fresh;
        rankedFor = raw;
        return ranked;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(ranked => this.ranked.set(ranked));
  }

  protected groupLabel(group: PaletteGroup): string {
    return paletteGroupLabel(group, this.m());
  }

  protected format(message: string, values: Record<string, string>): string {
    return formatCommandPaletteMessage(message, values);
  }

  protected onInput(event: Event): void {
    this.setQuery((event.target as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.moveTo(Number.MAX_SAFE_INTEGER);
        break;
      case 'Enter': {
        event.preventDefault();
        const target = this.actionsFor();
        if (target) {
          const action = target.actions?.[this.activeActionIndex()];
          if (action) {
            void this.runAction(action);
          }
        } else {
          const result = this.results()[this.activeIndex()];
          if (result) {
            void this.execute(result, event.metaKey || event.ctrlKey ? 'newTab' : 'open');
          }
        }
        break;
      }
      case 'Tab':
        // Keeps focus in the dialog (trap) and toggles the actions sub-menu.
        event.preventDefault();
        if (event.shiftKey || this.actionsFor()) {
          this.actionsFor.set(null);
        } else {
          this.openActions();
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (this.actionsFor()) {
          this.actionsFor.set(null);
        } else {
          this.palette.close();
        }
        break;
    }
  }

  /** Clicks on the dialog's chrome (header, footer, group headers) must not take focus from the input. */
  protected onDialogMouseDown(event: MouseEvent): void {
    if (event.target !== this.input().nativeElement) {
      event.preventDefault();
    }
  }

  protected close(): void {
    this.palette.close();
  }

  protected onScrimMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.palette.close();
    }
  }

  protected onOptionHover(result: PaletteResult): void {
    if (this.activeId() !== result.id) {
      this.activeId.set(result.id);
    }
  }

  protected onOptionClick(result: PaletteResult, event: MouseEvent): void {
    void this.execute(result, event.metaKey || event.ctrlKey ? 'newTab' : 'open');
  }

  /** Runs a result. The palette closes first; an outcome with a query reopens it with that query. */
  protected async execute(result: PaletteResult, mode: PaletteRunMode): Promise<void> {
    await this.finish(() => result.run(mode));
  }

  protected async runAction(action: PaletteAction): Promise<void> {
    await this.finish(() => action.run());
  }

  private async finish(run: () => Promise<PaletteRunResult>): Promise<void> {
    this.palette.close();
    try {
      const outcome = await run();
      if (outcome && typeof outcome.query === 'string') {
        this.palette.open(outcome.query);
      }
    } catch (error) {
      console.error('Command palette: running the result failed', error);
    }
  }

  private openActions(): void {
    const result = this.results()[this.activeIndex()];
    if (result?.actions?.length) {
      this.actionsFor.set(result);
      this.activeActionIndex.set(0);
    }
  }

  private move(delta: number): void {
    const count = this.actionsFor() ? this.actionsFor()?.actions?.length ?? 0 : this.results().length;
    if (count === 0) {
      return;
    }
    const current = this.actionsFor() ? this.activeActionIndex() : Math.max(0, this.activeIndex());
    this.moveTo((current + delta + count) % count);
  }

  private moveTo(index: number): void {
    const target = this.actionsFor();
    if (target) {
      const count = target.actions?.length ?? 0;
      if (count > 0) {
        this.activeActionIndex.set(Math.min(index, count - 1));
      }
    } else {
      const results = this.results();
      if (results.length === 0) {
        return;
      }
      this.activeId.set(results[Math.min(index, results.length - 1)].id);
    }
    this.scrollActiveIntoView();
  }

  private setQuery(value: string): void {
    if (value === this.query() && value === this.query$.value) {
      return;
    }
    this.query.set(value);
    this.activeId.set(null);
    this.actionsFor.set(null);
    this.query$.next(value);
  }

  private focusInput(): void {
    const element = this.input().nativeElement;
    element.focus();
    const end = element.value.length;
    element.setSelectionRange(end, end);
  }

  private scrollActiveIntoView(): void {
    const id = this.activeDescendant();
    const element = id ? document.getElementById(id) : null;
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }
}
