import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  afterEveryRender,
  booleanAttribute,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';

/** Marks projected content that replaces the page title text: `<span mmPageTitle>…</span>`. */
@Directive({ selector: '[mmPageTitle]', standalone: true })
export class PageTitleDirective {}

/** Marks projected content shown under the title: `<span mmPageSubtitle>…</span>`. */
@Directive({ selector: '[mmPageSubtitle]', standalone: true })
export class PageSubtitleDirective {}

/** Marks projected page actions (buttons), rendered at the end of the header: `<div mmPageActions>…</div>`. */
@Directive({ selector: '[mmPageActions]', standalone: true })
export class PageActionsDirective {}

/** Heading level used for the page title. */
export type PageHeadingLevel = 1 | 2 | 3;

interface ProjectedSlots {
  title: boolean;
  subtitle: boolean;
  actions: boolean;
}

/** True when a slot container holds an element or non-blank text. */
function hasProjectedContent(element: HTMLElement | undefined): boolean {
  if (!element) {
    return false;
  }
  return Array.from(element.childNodes).some(
    (node) =>
      node.nodeType === Node.ELEMENT_NODE ||
      (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''),
  );
}

/**
 * Page layout: an optional header (title, subtitle, actions) above a content
 * area. Replaces the retired LCARS page triple (header, content panel and
 * READY footer); there is no footer.
 *
 * The header renders only when there is something to show — a `pageTitle` /
 * `pageSubtitle` input or projected `[mmPageTitle]`, `[mmPageSubtitle]` or
 * `[mmPageActions]` content — so pages inside a space shell, which already
 * shows the area title, can use `<mm-page>` as a bare content frame.
 * Projected content is detected from the rendered DOM, so the slots work
 * whether or not the consumer imports the marker directives (`MM_PAGE`).
 *
 * ```html
 * <mm-page pageTitle="Adapters" pageSubtitle="12 registered">
 *   <div mmPageActions>
 *     <button kendoButton themeColor="primary">New adapter</button>
 *   </div>
 *   <mm-list-view …></mm-list-view>
 * </mm-page>
 * ```
 *
 * The header is a plain `<div>` (no banner landmark) and the title defaults to
 * heading level 2 — the app/space shell owns level 1. Styling is token-based
 * (`--theme-*` with neutral fallbacks); the host fills its parent
 * (`height: 100%`) and the content area scrolls.
 */
@Component({
  selector: 'mm-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mm-page',
    '[class.mm-page--flush]': '!padded()',
    '[class.mm-page--headerless]': '!hasHeader()',
  },
  template: `
    <div class="mm-page__header" [hidden]="!hasHeader()">
      <div class="mm-page__heading">
        <div class="mm-page__title" role="heading" [attr.aria-level]="headingLevel()" [hidden]="!hasTitle()">
          {{ pageTitle() ?? '' }}<span #titleSlot class="mm-page__slot"><ng-content select="[mmPageTitle]" /></span>
        </div>
        <div class="mm-page__subtitle" [hidden]="!hasSubtitle()">
          {{ pageSubtitle() ?? '' }}<span #subtitleSlot class="mm-page__slot"><ng-content select="[mmPageSubtitle]" /></span>
        </div>
      </div>
      <div #actionsSlot class="mm-page__actions" [hidden]="!projected().actions">
        <ng-content select="[mmPageActions]" />
      </div>
    </div>
    <div class="mm-page__content">
      <ng-content />
    </div>
  `,
  styleUrl: './page.component.scss',
})
export class PageComponent {
  /** Title text. Alternatively project `[mmPageTitle]` content. */
  readonly pageTitle = input<string | null | undefined>(undefined);

  /** Subtitle text under the title. Alternatively project `[mmPageSubtitle]` content. */
  readonly pageSubtitle = input<string | null | undefined>(undefined);

  /** `aria-level` of the title. Defaults to 2 — the app/space shell owns level 1. */
  readonly headingLevel = input<PageHeadingLevel>(2);

  /** Pad the content area with the page gutter. Set `false` for full-bleed grids and editors. */
  readonly padded = input(true, { transform: booleanAttribute });

  private readonly titleSlot = viewChild<ElementRef<HTMLElement>>('titleSlot');
  private readonly subtitleSlot = viewChild<ElementRef<HTMLElement>>('subtitleSlot');
  private readonly actionsSlot = viewChild<ElementRef<HTMLElement>>('actionsSlot');

  /** Which slots currently hold projected content (read from the DOM after each render). */
  protected readonly projected = signal<ProjectedSlots>({ title: false, subtitle: false, actions: false });

  protected readonly hasTitle = computed(() => !!this.pageTitle() || this.projected().title);
  protected readonly hasSubtitle = computed(() => !!this.pageSubtitle() || this.projected().subtitle);
  protected readonly hasHeader = computed(() => this.hasTitle() || this.hasSubtitle() || this.projected().actions);

  constructor() {
    // Projected nodes can appear or disappear with the consumer's own control
    // flow, so re-check after every render; the signal only changes (and only
    // schedules another pass) when a slot actually flips.
    afterEveryRender({
      read: () => {
        const next: ProjectedSlots = {
          title: hasProjectedContent(this.titleSlot()?.nativeElement),
          subtitle: hasProjectedContent(this.subtitleSlot()?.nativeElement),
          actions: hasProjectedContent(this.actionsSlot()?.nativeElement),
        };
        const current = this.projected();
        if (
          next.title !== current.title ||
          next.subtitle !== current.subtitle ||
          next.actions !== current.actions
        ) {
          this.projected.set(next);
        }
      },
    });
  }
}

/**
 * Everything a template needs for `<mm-page>` and its slots:
 * `imports: [...MM_PAGE]` (or `imports: [MM_PAGE]`).
 */
export const MM_PAGE = [PageComponent, PageTitleDirective, PageSubtitleDirective, PageActionsDirective] as const;
