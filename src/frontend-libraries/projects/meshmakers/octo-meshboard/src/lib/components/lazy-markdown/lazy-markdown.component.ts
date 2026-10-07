import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  OnInit,
  ViewChild,
  ViewContainerRef,
  createEnvironmentInjector,
  effect,
  inject,
  input,
  signal
} from '@angular/core';

type NgxMarkdownModule = typeof import('ngx-markdown');

let ngxMarkdownLoader: Promise<NgxMarkdownModule> | null = null;

/**
 * Loads `ngx-markdown` (and with it `marked`) on first use. The bare-specifier dynamic import stays
 * a real `import()` in the published bundle, so the application bundler puts both libraries into a
 * lazy chunk that is only fetched once a markdown block is actually rendered.
 */
export function loadNgxMarkdown(): Promise<NgxMarkdownModule> {
  if (!ngxMarkdownLoader) {
    ngxMarkdownLoader = import('ngx-markdown').catch((error: unknown) => {
      ngxMarkdownLoader = null;
      throw error;
    });
  }
  return ngxMarkdownLoader;
}

/**
 * Renders markdown with `ngx-markdown`'s `<markdown>` component, loading `ngx-markdown`/`marked`
 * lazily (AB#5621) so they stay out of the initial bundle of hosts that show MeshBoards eagerly.
 *
 * If the host already provides `MarkdownService` (e.g. `provideMarkdown({...})` at root or on a
 * route), that configuration is used; otherwise the component provides a default
 * `provideMarkdown()` itself, so no host setup is required.
 *
 * While the library loads nothing is shown; if loading fails, the raw text is shown instead.
 */
@Component({
  selector: 'mm-lazy-markdown',
  standalone: true,
  template: `
    @if (loadFailed()) {
      <div class="mm-lazy-markdown-fallback">{{ data() }}</div>
    }
    <ng-container #outlet></ng-container>
  `,
  styles: [`
    :host { display: block; }
    .mm-lazy-markdown-fallback { white-space: pre-wrap; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LazyMarkdownComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);

  /** Markdown source to render. */
  readonly data = input<string | null | undefined>('');

  /** True once the `<markdown>` component is attached. */
  readonly rendered = signal(false);

  /** True if `ngx-markdown` could not be loaded; the raw text is shown then. */
  readonly loadFailed = signal(false);

  @ViewChild('outlet', { read: ViewContainerRef, static: true })
  private outlet!: ViewContainerRef;

  private readonly markdownRef = signal<ComponentRef<unknown> | null>(null);
  private ownedInjector: EnvironmentInjector | null = null;
  private destroyed = false;

  constructor() {
    effect(() => {
      const ref = this.markdownRef();
      const data = this.data() ?? '';
      ref?.setInput('data', data);
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.markdownRef()?.destroy();
      this.ownedInjector?.destroy();
      this.ownedInjector = null;
    });
  }

  ngOnInit(): void {
    loadNgxMarkdown().then(
      (ngxMarkdown) => this.attach(ngxMarkdown),
      (error: unknown) => {
        console.error('mm-lazy-markdown: failed to load ngx-markdown', error);
        this.loadFailed.set(true);
      }
    );
  }

  private attach(ngxMarkdown: NgxMarkdownModule): void {
    if (this.destroyed) {
      return;
    }
    const hostProvidesMarkdown = this.injector.get(ngxMarkdown.MarkdownService, null) !== null;
    if (!hostProvidesMarkdown) {
      this.ownedInjector = createEnvironmentInjector(
        ngxMarkdown.provideMarkdown(),
        this.environmentInjector,
        'mm-lazy-markdown'
      );
    }
    const ref = this.outlet.createComponent(ngxMarkdown.MarkdownComponent, {
      injector: this.injector,
      environmentInjector: this.ownedInjector ?? undefined
    });
    ref.setInput('data', this.data() ?? '');
    this.markdownRef.set(ref);
    this.rendered.set(true);
  }
}
