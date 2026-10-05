import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  PageActionsDirective,
  PageComponent,
  PageHeadingLevel,
  PageSubtitleDirective,
  PageTitleDirective,
} from './page.component';

@Component({
  standalone: true,
  imports: [PageComponent, PageActionsDirective],
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
  readonly level = signal<PageHeadingLevel>(1);
  readonly padded = signal(true);
  readonly withActions = signal(false);
}

@Component({
  standalone: true,
  imports: [PageComponent, PageTitleDirective, PageSubtitleDirective],
  template: `
    <mm-page>
      <span mmPageTitle class="custom-title">Custom <b>title</b></span>
      <span mmPageSubtitle class="custom-subtitle">Custom subtitle</span>
      <p class="body">Body</p>
    </mm-page>
  `,
})
class ProjectedHostComponent {}

@Component({
  standalone: true,
  imports: [PageComponent],
  template: `<mm-page><p class="body">Only content</p></mm-page>`,
})
class BareHostComponent {}

describe('PageComponent', () => {
  const query = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  describe('with inputs', () => {
    let fixture: ComponentFixture<InputsHostComponent>;
    let host: InputsHostComponent;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [InputsHostComponent] });
      fixture = TestBed.createComponent(InputsHostComponent);
      host = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('renders the title as a heading of the requested level', () => {
      const title = query(fixture, '.mm-page__title');
      expect(title?.textContent?.trim()).toBe('Adapters');
      expect(title?.getAttribute('role')).toBe('heading');
      expect(title?.getAttribute('aria-level')).toBe('1');

      host.level.set(2);
      fixture.detectChanges();
      expect(query(fixture, '.mm-page__title')?.getAttribute('aria-level')).toBe('2');
    });

    it('does not put a native title attribute on the host', () => {
      expect(query(fixture, 'mm-page')?.hasAttribute('title')).toBe(false);
    });

    it('renders the subtitle only when set', () => {
      expect(query(fixture, '.mm-page__subtitle')).toBeNull();
      host.subtitle.set('12 registered');
      fixture.detectChanges();
      expect(query(fixture, '.mm-page__subtitle')?.textContent?.trim()).toBe('12 registered');
    });

    it('projects actions into the header', () => {
      expect(query(fixture, '.mm-page__actions')).toBeNull();
      host.withActions.set(true);
      fixture.detectChanges();
      expect(query(fixture, '.mm-page__actions .action')).not.toBeNull();
    });

    it('shows the header for actions alone and hides it when nothing is left', () => {
      host.title.set(undefined);
      host.withActions.set(true);
      fixture.detectChanges();
      expect(query(fixture, '.mm-page__header')).not.toBeNull();
      expect(query(fixture, '.mm-page__title')).toBeNull();

      host.withActions.set(false);
      fixture.detectChanges();
      expect(query(fixture, '.mm-page__header')).toBeNull();
      expect(query(fixture, 'mm-page')?.classList).toContain('mm-page--headerless');
    });

    it('projects the default content into the content area', () => {
      expect(query(fixture, '.mm-page__content .body')?.textContent).toBe('Body');
    });

    it('toggles the flush modifier with padded', () => {
      const page = query(fixture, 'mm-page');
      expect(page?.classList).toContain('mm-page');
      expect(page?.classList).not.toContain('mm-page--flush');
      host.padded.set(false);
      fixture.detectChanges();
      expect(page?.classList).toContain('mm-page--flush');
    });

    it('renders no footer', () => {
      expect(query(fixture, 'footer')).toBeNull();
      expect(query(fixture, '.lcars-footer')).toBeNull();
    });
  });

  describe('with projected title and subtitle', () => {
    it('uses the projected content', () => {
      TestBed.configureTestingModule({ imports: [ProjectedHostComponent] });
      const fixture = TestBed.createComponent(ProjectedHostComponent);
      fixture.detectChanges();

      expect(query(fixture, '.mm-page__title .custom-title')?.textContent).toBe('Custom title');
      expect(query(fixture, '.mm-page__subtitle .custom-subtitle')?.textContent).toBe('Custom subtitle');
      expect(query(fixture, '.mm-page__content .body')).not.toBeNull();
      // Projected header content must not leak into the content area.
      expect(query(fixture, '.mm-page__content .custom-title')).toBeNull();
    });
  });

  describe('without any header content', () => {
    it('renders only the content area', () => {
      TestBed.configureTestingModule({ imports: [BareHostComponent] });
      const fixture = TestBed.createComponent(BareHostComponent);
      fixture.detectChanges();

      expect(query(fixture, '.mm-page__header')).toBeNull();
      expect(query(fixture, '.mm-page__content .body')?.textContent).toBe('Only content');
    });
  });
});
