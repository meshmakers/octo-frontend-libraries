import { Component, Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MM_PAGE, PageComponent, PageHeadingLevel } from './page.component';

@Component({
  standalone: true,
  imports: [MM_PAGE],
  template: `
    <mm-page
      [pageTitle]="title()"
      [pageSubtitle]="subtitle()"
      [headingLevel]="level()"
      [padded]="padded()">
      @if (withActions()) {
        <div mmPageActions><button class="action">New</button></div>
      }
      <p class="body">Body</p>
    </mm-page>
  `,
})
class InputsHostComponent {
  readonly title = signal<string | undefined>('Adapters');
  readonly subtitle = signal<string | undefined>(undefined);
  readonly level = signal<PageHeadingLevel>(2);
  readonly padded = signal(true);
  readonly withActions = signal(false);
}

@Component({
  standalone: true,
  imports: [MM_PAGE],
  template: `
    <mm-page>
      <span mmPageTitle class="custom-title">Custom <b>title</b></span>
      <span mmPageSubtitle class="custom-subtitle">Custom subtitle</span>
      <p class="body">Body</p>
    </mm-page>
  `,
})
class ProjectedHostComponent {}

/** Imports only the component, not the slot directives — the slots must still work. */
@Component({
  standalone: true,
  imports: [PageComponent],
  template: `
    <mm-page padded="false">
      <span mmPageTitle class="custom-title">Title without directive</span>
      <div mmPageActions><button class="action">Act</button></div>
      <p class="body">Body</p>
    </mm-page>
  `,
})
class NoDirectiveHostComponent {}

@Component({
  standalone: true,
  imports: [PageComponent],
  template: `<mm-page><p class="body">Only content</p></mm-page>`,
})
class BareHostComponent {}

describe('PageComponent', () => {
  const query = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);
  const isShown = (el: HTMLElement | null): boolean => !!el && !el.hidden;

  async function render<T>(type: Type<T>): Promise<ComponentFixture<T>> {
    TestBed.configureTestingModule({ imports: [type] });
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('exports the component and the three slot directives in MM_PAGE', () => {
    expect(MM_PAGE.length).toBe(4);
    expect(MM_PAGE[0]).toBe(PageComponent);
  });

  describe('with inputs', () => {
    let fixture: ComponentFixture<InputsHostComponent>;
    let host: InputsHostComponent;

    beforeEach(async () => {
      fixture = await render(InputsHostComponent);
      host = fixture.componentInstance;
    });

    it('renders the title as a heading, level 2 by default', async () => {
      const title = query(fixture, '.mm-page__title');
      expect(title?.textContent?.trim()).toBe('Adapters');
      expect(title?.getAttribute('role')).toBe('heading');
      expect(title?.getAttribute('aria-level')).toBe('2');

      host.level.set(1);
      await settle(fixture);
      expect(query(fixture, '.mm-page__title')?.getAttribute('aria-level')).toBe('1');
    });

    it('renders the header as a plain div, not a banner landmark', () => {
      const header = query(fixture, '.mm-page__header');
      expect(header?.tagName).toBe('DIV');
      expect(query(fixture, 'header')).toBeNull();
    });

    it('does not put a native title attribute on the host', () => {
      expect(query(fixture, 'mm-page')?.hasAttribute('title')).toBe(false);
    });

    it('shows the subtitle only when set', async () => {
      expect(isShown(query(fixture, '.mm-page__subtitle'))).toBe(false);
      host.subtitle.set('12 registered');
      await settle(fixture);
      const subtitle = query(fixture, '.mm-page__subtitle');
      expect(isShown(subtitle)).toBe(true);
      expect(subtitle?.textContent?.trim()).toBe('12 registered');
    });

    it('projects actions into the header when they appear later', async () => {
      expect(isShown(query(fixture, '.mm-page__actions'))).toBe(false);
      host.withActions.set(true);
      await settle(fixture);
      expect(isShown(query(fixture, '.mm-page__actions'))).toBe(true);
      expect(query(fixture, '.mm-page__actions .action')).not.toBeNull();
    });

    it('keeps the header for actions alone and hides it when nothing is left', async () => {
      host.title.set(undefined);
      host.withActions.set(true);
      await settle(fixture);
      expect(isShown(query(fixture, '.mm-page__header'))).toBe(true);
      expect(isShown(query(fixture, '.mm-page__title'))).toBe(false);

      host.withActions.set(false);
      await settle(fixture);
      expect(isShown(query(fixture, '.mm-page__header'))).toBe(false);
      expect(query(fixture, 'mm-page')?.classList).toContain('mm-page--headerless');
    });

    it('projects the default content into the content area', () => {
      expect(query(fixture, '.mm-page__content .body')?.textContent).toBe('Body');
    });

    it('toggles the flush modifier with padded', async () => {
      const page = query(fixture, 'mm-page');
      expect(page?.classList).toContain('mm-page');
      expect(page?.classList).not.toContain('mm-page--flush');
      host.padded.set(false);
      await settle(fixture);
      expect(page?.classList).toContain('mm-page--flush');
    });

    it('renders no footer', () => {
      expect(query(fixture, 'footer')).toBeNull();
      expect(query(fixture, '.lcars-footer')).toBeNull();
    });
  });

  describe('with projected title and subtitle', () => {
    it('uses the projected content', async () => {
      const fixture = await render(ProjectedHostComponent);

      expect(isShown(query(fixture, '.mm-page__header'))).toBe(true);
      expect(isShown(query(fixture, '.mm-page__title'))).toBe(true);
      expect(query(fixture, '.mm-page__title .custom-title')?.textContent).toBe('Custom title');
      expect(query(fixture, '.mm-page__subtitle .custom-subtitle')?.textContent).toBe('Custom subtitle');
      expect(query(fixture, '.mm-page__content .body')).not.toBeNull();
      // Projected header content must not leak into the content area.
      expect(query(fixture, '.mm-page__content .custom-title')).toBeNull();
    });
  });

  describe('without importing the slot directives', () => {
    it('still detects projected title and actions, and accepts padded="false"', async () => {
      const fixture = await render(NoDirectiveHostComponent);

      expect(isShown(query(fixture, '.mm-page__header'))).toBe(true);
      expect(isShown(query(fixture, '.mm-page__title'))).toBe(true);
      expect(query(fixture, '.mm-page__title .custom-title')).not.toBeNull();
      expect(isShown(query(fixture, '.mm-page__actions'))).toBe(true);
      expect(query(fixture, 'mm-page')?.classList).toContain('mm-page--flush');
    });
  });

  describe('without any header content', () => {
    it('hides the header and renders only the content area', async () => {
      const fixture = await render(BareHostComponent);

      expect(isShown(query(fixture, '.mm-page__header'))).toBe(false);
      expect(query(fixture, 'mm-page')?.classList).toContain('mm-page--headerless');
      expect(query(fixture, '.mm-page__content .body')?.textContent).toBe('Only content');
    });
  });
});
