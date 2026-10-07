import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssistantComposerComponent } from './assistant-composer.component';

describe('AssistantComposerComponent attachments (AB#5621)', () => {
  let fixture: ComponentFixture<AssistantComposerComponent>;
  let element: HTMLElement;
  let sent: string[];

  function create(attachments: unknown): void {
    fixture = TestBed.createComponent(AssistantComposerComponent);
    sent = [];
    fixture.componentInstance.send.subscribe(text => sent.push(text));
    fixture.componentRef.setInput('canSend', true);
    if (attachments !== undefined) {
      fixture.componentRef.setInput('attachments', attachments);
    }
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const fileInput = (): HTMLInputElement | null => element.querySelector('input[type="file"]');
  const attach = (): HTMLButtonElement | null => element.querySelector('.attach');
  const sendButton = (): HTMLButtonElement => element.querySelector('.send')!;
  const pick = (...files: File[]): void => {
    const input = fileInput()!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const pdf = (name = 'invoice.pdf', size = 10): File => new File([new Uint8Array(size)], name, { type: 'application/pdf' });

  it('shows no attachment UI without attachment options', () => {
    create(undefined);
    expect(attach()).toBeNull();
    expect(fileInput()).toBeNull();
    expect(element.querySelector('.files')).toBeNull();
  });

  it('offers a labelled attach button and a file input limited to accept', () => {
    create({ accept: 'application/pdf', maxFiles: 1 });
    expect(attach()!.getAttribute('aria-label')).toBe('Attach file');
    expect(fileInput()!.getAttribute('accept')).toBe('application/pdf');
    expect(fileInput()!.multiple).toBe(false);
    const click = vi.spyOn(fileInput()!, 'click').mockImplementation(() => undefined);
    attach()!.click();
    expect(click).toHaveBeenCalled();
  });

  it('lists picked files, allows sending without text and removes a file', () => {
    create({ accept: '.pdf', maxFiles: 2 });
    expect(fileInput()!.multiple).toBe(true);
    expect(sendButton().disabled).toBe(true);
    pick(pdf('a.pdf'), pdf('b.pdf'));
    expect(fixture.componentInstance.files().map(f => f.name)).toEqual(['a.pdf', 'b.pdf']);
    const list = element.querySelector('.files')!;
    expect(list.getAttribute('aria-label')).toBe('Attached files');
    expect(Array.from(list.querySelectorAll('.file-name')).map(n => n.textContent)).toEqual(['a.pdf', 'b.pdf']);
    expect(sendButton().disabled).toBe(false);
    const remove = list.querySelector<HTMLButtonElement>('button')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove attachment a.pdf');
    remove.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.files().map(f => f.name)).toEqual(['b.pdf']);
    sendButton().click();
    expect(sent).toEqual(['']);
  });

  it('announces rejected files in an alert', () => {
    create({ accept: 'application/pdf', maxFiles: 1, maxFileSizeBytes: 1024 });
    pick(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(element.querySelector('[role="alert"]')!.textContent).toContain('notes.txt is not an accepted file type.');
    pick(pdf('huge.pdf', 4096));
    expect(element.querySelector('[role="alert"]')!.textContent).toContain('huge.pdf is larger than 1 KB.');
    expect(fixture.componentInstance.files()).toEqual([]);
  });

  it('does not send files-only content without attachment options', () => {
    create(undefined);
    fixture.componentRef.setInput('files', [pdf()]);
    fixture.detectChanges();
    expect(sendButton().disabled).toBe(true);
  });
});
