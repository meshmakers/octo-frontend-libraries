import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  computed,
  contentChild,
  input,
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

/**
 * Page layout: an optional header (title, subtitle, actions) above a content
 * area. Replaces the LCARS `lcars-page-header` / `lcars-content-panel` /
 * `lcars-footer` triple; there is no footer.
 *
 * The header renders only when there is something to show — a `pageTitle` /
 * `pageSubtitle` input or projected `[mmPageTitle]`, `[mmPageSubtitle]` or
 * `[mmPageActions]` content — so pages inside a space shell, which already
 * shows the area title, can use `<mm-page>` as a bare content frame.
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
 * Styling is token-based (`--theme-*` with neutral fallbacks); the host fills
 * its parent (`height: 100%`) and the content area scrolls.
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
    @if (hasHeader()) {
      <header class="mm-page__header">
        <div class="mm-page__heading">
          @if (hasTitle()) {
            <div class="mm-page__title" role="heading" [attr.aria-level]="headingLevel()">
              {{ pageTitle() }}<ng-content select="[mmPageTitle]" />
            </div>
          }
          @if (hasSubtitle()) {
            <div class="mm-page__subtitle">
              {{ pageSubtitle() }}<ng-content select="[mmPageSubtitle]" />
            </div>
          }
        </div>
        @if (actions()) {
          <div class="mm-page__actions">
            <ng-content select="[mmPageActions]" />
          </div>
        }
      </header>
    }
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

  /** `aria-level` of the title (the space shell usually owns level 1). */
  readonly headingLevel = input<PageHeadingLevel>(1);

  /** Pad the content area with the page gutter. Set `false` for full-bleed grids and editors. */
  readonly padded = input<boolean>(true);

  protected readonly titleContent = contentChild(PageTitleDirective);
  protected readonly subtitleContent = contentChild(PageSubtitleDirective);
  protected readonly actions = contentChild(PageActionsDirective);

  protected readonly hasTitle = computed(() => !!this.pageTitle() || !!this.titleContent());
  protected readonly hasSubtitle = computed(() => !!this.pageSubtitle() || !!this.subtitleContent());
  protected readonly hasHeader = computed(() => this.hasTitle() || this.hasSubtitle() || !!this.actions());
}
