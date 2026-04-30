import { Component, computed, inject } from '@angular/core';
import { BrandingDataSource, ThemeSwitcherComponent } from '@meshmakers/octo-ui/branding';

@Component({
  selector: 'app-branding-demo',
  standalone: true,
  imports: [ThemeSwitcherComponent],
  template: `
    <div class="demo">
      <header class="demo__intro">
        <h2>Branding components</h2>
        <p>
          The library exposes <code>&lt;mm-theme-switcher&gt;</code> plus the
          Settings page (mounted under <strong>Branding</strong> in the
          sidebar). Both share the tenant palette via
          <code>BrandingDataSource</code>; edit the palette there and the
          previews repaint immediately.
        </p>
        <p>
          The logo is intentionally <em>not</em> a component — hosts render an
          <code>&lt;img&gt;</code> bound to <code>BrandingDataSource</code>
          directly, which keeps sizing, layout, and accessibility decisions
          where they belong (the host's chrome). See the snippet below.
        </p>
      </header>

      <!-- ============================================================ -->
      <!-- Logo (inline pattern, no component)                            -->
      <!-- ============================================================ -->
      <section class="component">
        <header class="component__header">
          <h3>Rendering the tenant logo</h3>
          <p>
            Inject <code>BrandingDataSource</code>, read
            <code>branding().headerLogoUrl</code> (or
            <code>footerLogoUrl</code>) and bind an <code>img</code>. Apply
            sizing / layout via your own classes.
          </p>
        </header>

        <article class="variant">
          <div class="variant__meta">
            <h4>Recommended snippet</h4>
            <pre>{{ snippet }}</pre>
          </div>
          <div class="variant__preview variant__preview--inline">
            <img [src]="logoUrl()" alt="" class="logo-preview" />
          </div>
        </article>
      </section>

      <!-- ============================================================ -->
      <!-- ThemeSwitcher                                                 -->
      <!-- ============================================================ -->
      <section class="component">
        <header class="component__header">
          <h3>&lt;mm-theme-switcher&gt;</h3>
          <p>
            Light/dark toggle. Disabled automatically when the tenant has
            <code>darkTheme = null</code> (single-theme tenants). Already
            mounted in the top app-bar, but it can also be embedded inline:
          </p>
        </header>

        <article class="variant">
          <div class="variant__meta">
            <h4>Inline placement</h4>
            <p>
              The component owns its own state via <code>ThemeService</code> —
              wherever you mount it, all instances stay in sync.
            </p>
            <pre>&lt;mm-theme-switcher /&gt;</pre>
          </div>
          <div class="variant__preview variant__preview--inline">
            <mm-theme-switcher />
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--kendo-color-on-app-surface, inherit);
      }
      .demo {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 1rem 1.5rem 2rem;
      }
      .demo__intro {
        max-width: 80ch;
      }
      .demo__intro h2 {
        margin: 0 0 0.5rem;
      }
      .demo__intro p {
        margin: 0 0 0.5rem;
        opacity: 0.85;
      }
      .demo__intro p:last-child {
        margin-bottom: 0;
      }
      .component {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        border: 1px solid var(--kendo-color-border, currentColor);
        border-radius: 8px;
        background: transparent;
      }
      .component__header h3 {
        margin: 0 0 0.25rem;
        font-size: 1.05rem;
      }
      .component__header p {
        margin: 0;
        max-width: 80ch;
        opacity: 0.8;
        font-size: 0.9rem;
      }

      .variant {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
        gap: 1.25rem;
        padding: 1rem;
        border: 1px solid var(--kendo-color-border-alt, currentColor);
        border-radius: 6px;
        background: transparent;
      }
      @media (max-width: 900px) {
        .variant {
          grid-template-columns: 1fr;
        }
      }
      .variant__meta {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 0;
      }
      .variant__meta h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
      }
      .variant__meta p {
        margin: 0;
        opacity: 0.8;
        font-size: 0.85rem;
      }
      .variant__meta pre {
        margin: 0;
        padding: 0.6rem 0.8rem;
        background: color-mix(in srgb, currentColor 6%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 4px;
        font-size: 0.78rem;
        line-height: 1.4;
        overflow-x: auto;
        white-space: pre;
      }
      .variant__preview {
        display: block;
        width: 100%;
        min-width: 0;
      }
      .variant__preview--inline {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        align-items: center;
        padding: 0.5rem;
      }
      .variant__preview--inline > * {
        flex: 0 0 auto;
      }
      .logo-preview {
        display: block;
        max-height: 48px;
        max-width: 192px;
        height: auto;
        width: auto;
      }
    `,
  ],
})
export class BrandingDemoComponent {
  private readonly branding = inject(BrandingDataSource);

  protected readonly logoUrl = computed(
    () => this.branding.branding().headerLogoUrl ?? '/assets/demo-logo.svg',
  );

  protected readonly snippet = `// component
private readonly branding = inject(BrandingDataSource);
protected readonly logoUrl = computed(
  () => this.branding.branding().headerLogoUrl ?? '/your-fallback.svg',
);

// template
<img [src]="logoUrl()" alt="" class="your-logo-class" />`;
}
