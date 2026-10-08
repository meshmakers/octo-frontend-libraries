import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownService, provideMarkdown } from 'ngx-markdown';
import { LazyMarkdownComponent, loadNgxMarkdown } from './lazy-markdown.component';

describe('LazyMarkdownComponent', () => {
  let fixture: ComponentFixture<LazyMarkdownComponent>;

  async function render(data: string): Promise<HTMLElement> {
    fixture = TestBed.createComponent(LazyMarkdownComponent);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    await loadNgxMarkdown();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.componentInstance.rendered()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('markdown')?.innerHTML).toContain('<');
    });
    return fixture.nativeElement as HTMLElement;
  }

  describe('without a host-provided MarkdownService', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [LazyMarkdownComponent] }).compileComponents();
    });

    it('loads ngx-markdown on demand and renders the markdown', async () => {
      const element = await render('# Title\n\nSome **bold** text');

      expect(element.querySelector('markdown h1')?.textContent).toContain('Title');
      expect(element.querySelector('markdown strong')?.textContent).toBe('bold');
    });

    it('re-renders when the data input changes', async () => {
      const element = await render('# First');

      fixture.componentRef.setInput('data', '## Second');
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(element.querySelector('markdown h2')?.textContent).toContain('Second');
      });
      expect(element.querySelector('markdown h1')).toBeNull();
    });

    it('shows nothing but the outlet until the library is attached', () => {
      fixture = TestBed.createComponent(LazyMarkdownComponent);
      fixture.componentRef.setInput('data', '# Pending');
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.mm-lazy-markdown-fallback')).toBeNull();
    });
  });

  describe('with a host-provided MarkdownService', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [LazyMarkdownComponent],
        providers: [provideMarkdown()]
      }).compileComponents();
    });

    it('uses the host service instead of creating its own', async () => {
      const hostService = TestBed.inject(MarkdownService);
      const parseSpy = vi.spyOn(hostService, 'parse');

      const element = await render('*host*');

      expect(parseSpy).toHaveBeenCalled();
      expect(element.querySelector('markdown em')?.textContent).toBe('host');
    });
  });
});
