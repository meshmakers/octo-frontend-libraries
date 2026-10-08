import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  PLATFORM_ID,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** The OctoBot animations shipped with shared-ui (AB#3444). */
export type OctoBotAnimation = 'idle' | 'blink' | 'look' | 'swim' | 'thinking' | 'wave';

/**
 * Image loading strategy (`loading` attribute): `lazy` (default) defers the request until the
 * figure nears the viewport; `eager` loads it right away — for places where the figure is visible
 * immediately (empty states, 404 / turned-off pages), so it does not pop in late.
 */
export type OctoBotLoading = 'lazy' | 'eager';

/** Rendered sizes: `sm` 60 px, `md` 120 px, `lg` 240 px (square). */
export type OctoBotSize = 'sm' | 'md' | 'lg';

/** Pixel edge length of each {@link OctoBotSize}. */
export const OCTOBOT_SIZE_PX: Readonly<Record<OctoBotSize, number>> = { sm: 60, md: 120, lg: 240 };

/**
 * Length of one loop of each animation in ms (identical for all sizes; read from the WebP frame
 * durations). Used by `playOnce`.
 */
export const OCTOBOT_LOOP_MS: Readonly<Record<OctoBotAnimation, number>> = {
  idle: 1900, blink: 2140, look: 2320, swim: 1750, thinking: 3520, wave: 2210
};

/**
 * Base URL of the OctoBot images, with a trailing slash. Default `assets/octobot/` (relative to
 * the document base). The files ship as library assets in
 * `node_modules/@meshmakers/shared-ui/assets/octobot`; a host app copies them with an
 * `angular.json` assets entry:
 *
 * ```json
 * { "glob": "**\/*", "input": "node_modules/@meshmakers/shared-ui/assets/octobot", "output": "/assets/octobot" }
 * ```
 *
 * Provide a different value when the app serves them elsewhere (a CDN, a sub path).
 */
export const OCTOBOT_ASSET_BASE_URL = new InjectionToken<string>('OCTOBOT_ASSET_BASE_URL', {
  providedIn: 'root',
  factory: () => 'assets/octobot/'
});

/**
 * App-wide "show stills only" switch, e.g. bound to a user setting "Reduce animations". When
 * `true`, every `mm-octobot` shows its still frame regardless of `prefers-reduced-motion`.
 */
export const OCTOBOT_FORCE_STILL = new InjectionToken<boolean>('OCTOBOT_FORCE_STILL', {
  providedIn: 'root',
  factory: () => false
});

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * `mm-octobot` — the meshmakers OctoBot mascot as a small animated pixel-art image (AB#3444).
 *
 * Renders one `<img>` with a fixed width and height (no layout shift), `loading="lazy"` (or
 * `eager` via the `loading` input),
 * `decoding="async"` and `image-rendering: pixelated`. The image is an 8-frame animated WebP
 * loaded by URL from {@link OCTOBOT_ASSET_BASE_URL} — nothing lands in the JS bundle.
 *
 * **Reduced motion:** while the user prefers reduced motion (`prefers-reduced-motion: reduce`,
 * followed live via `matchMedia`), when {@link OCTOBOT_FORCE_STILL} is `true` or when the `still`
 * input is set, the first frame is shown as a static PNG instead.
 *
 * **Accessibility:** without a `label` the figure is decorative (`alt=""`, `aria-hidden="true"`);
 * the surrounding text must carry the meaning (e.g. "Thinking…" next to `thinking`). With a
 * `label` the host gets `role="img"` and `aria-label`.
 *
 * **Placement rules (host responsibility, see `docs/actions.md` › OctoBot):** at most one
 * animated OctoBot per view — empty states (once per page), page loading, the assistant panel,
 * 404 / turned-off pages, onboarding. Never inside repeated elements (list rows, table cells,
 * cockpit tiles, buttons) and never in toasts or error messages (a still frame is acceptable
 * there if a figure is wanted at all).
 *
 * @example
 * ```html
 * <mm-octobot animation="idle" size="md" />
 * <mm-octobot animation="thinking" size="sm" label="The assistant is thinking" />
 * ```
 */
@Component({
  selector: 'mm-octobot',
  template: `<img
    class="mm-octobot__img"
    [src]="src()"
    [attr.width]="px()"
    [attr.height]="px()"
    alt=""
    [attr.loading]="loading()"
    decoding="async"
    draggable="false" />`,
  styles: [`
    :host {
      display: inline-block;
      flex: none;
      line-height: 0;
    }
    .mm-octobot__img {
      display: block;
      max-width: none;
      image-rendering: pixelated;
      user-select: none;
    }
  `],
  host: {
    'class': 'mm-octobot',
    '[attr.data-size]': 'size()',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.data-animation]': 'animation()',
    '[attr.data-still]': 'showStill() ? "true" : null'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OctoBotComponent {
  private readonly baseUrl = inject(OCTOBOT_ASSET_BASE_URL);
  private readonly forceStill = inject(OCTOBOT_FORCE_STILL);

  /** Which animation to play. Default `idle`. */
  readonly animation = input<OctoBotAnimation>('idle');
  /** Rendered size. Default `md` (120 px). */
  readonly size = input<OctoBotSize>('md');
  /** Accessible name; when empty the figure is decorative. */
  readonly label = input<string | null | undefined>(null);
  /** Image loading strategy; `eager` where the figure is visible right away. Default `lazy`. */
  readonly loading = input<OctoBotLoading>('lazy');
  /** Show the still frame instead of the animation (e.g. after the assistant finished). */
  readonly still = input(false, { transform: booleanAttribute });
  /**
   * Plays the animation once ({@link OCTOBOT_LOOP_MS}) and then rests on the still frame — for
   * greetings (`wave`) that should not loop forever. The WebPs themselves loop endlessly.
   */
  readonly playOnce = input(false, { transform: booleanAttribute });

  private readonly prefersReducedMotion = signal(false);
  private readonly played = signal(false);

  protected readonly px = computed(() => OCTOBOT_SIZE_PX[this.size()] ?? OCTOBOT_SIZE_PX.md);
  protected readonly showStill = computed(() => this.still() || this.forceStill || this.prefersReducedMotion() || this.played());
  protected readonly src = computed(() => {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const file = this.showStill() ? `octo_${this.animation()}_still.png` : `octo_${this.animation()}.webp`;
    return `${base}${this.size()}/${file}`;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Restart the single loop whenever the animation changes while playOnce is set.
    effect((onCleanup) => {
      const animation = this.animation();
      this.played.set(false);
      if (!this.playOnce()) {
        return;
      }
      const timer = setTimeout(() => this.played.set(true), OCTOBOT_LOOP_MS[animation] ?? 2000);
      onCleanup(() => clearTimeout(timer));
    });
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY) as MediaQueryList | undefined;
    if (!query) {
      // Stubbed or partial matchMedia (tests, embedded webviews): keep the animation, no live updates.
      return;
    }
    this.prefersReducedMotion.set(!!query.matches);
    const listener = (event: MediaQueryListEvent): void => this.prefersReducedMotion.set(event.matches);
    query.addEventListener?.('change', listener);
    destroyRef.onDestroy(() => query.removeEventListener?.('change', listener));
  }
}
