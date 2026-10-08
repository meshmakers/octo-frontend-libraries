import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssistantComposerComponent } from './assistant-composer.component';

describe('AssistantComposerComponent', () => {
  let fixture: ComponentFixture<AssistantComposerComponent>;
  let element: HTMLElement;
  let sent: string[];

  beforeEach(() => {
    fixture = TestBed.createComponent(AssistantComposerComponent);
    sent = [];
    fixture.componentInstance.send.subscribe(text => sent.push(text));
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const textarea = (): HTMLTextAreaElement => element.querySelector('textarea')!;
  const type = (value: string): void => {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    textarea().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  const options = (): string[] => Array.from(element.querySelectorAll('[role="option"] .cmd')).map(o => o.textContent!.trim());

  it('lists the slash commands when the text starts with /', () => {
    type('/');
    expect(options()).toEqual(['/explain', '/query', '/summarise', '/draft-pipeline']);
    expect(textarea().getAttribute('aria-expanded')).toBe('true');
    expect(textarea().getAttribute('aria-activedescendant')).toBe(element.querySelector('[role="option"]')!.id);
    type('/su');
    expect(options()).toEqual(['/summarise']);
    type('/summarise now');
    expect(options()).toEqual([]);
    expect(textarea().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves with arrows (wrapping) and picks with Enter or Tab without sending', () => {
    fixture.componentRef.setInput('canSend', true);
    type('/');
    press('ArrowDown');
    press('ArrowDown');
    expect(element.querySelector('[aria-selected="true"] .cmd')?.textContent).toBe('/summarise');
    press('ArrowUp');
    press('ArrowUp');
    press('ArrowUp');
    expect(element.querySelector('[aria-selected="true"] .cmd')?.textContent).toBe('/draft-pipeline');
    press('Enter');
    expect(fixture.componentInstance.text()).toBe('/draft-pipeline ');
    expect(sent).toEqual([]);

    type('/q');
    press('Tab');
    expect(fixture.componentInstance.text()).toBe('/query ');
  });

  it('Esc closes the list and keeps Esc from reaching the panel; a second Esc passes', () => {
    type('/');
    const first = press('Escape');
    expect(first.defaultPrevented).toBe(true);
    expect(options()).toEqual([]);
    expect(press('Escape').defaultPrevented).toBe(false);
  });

  it('picks with a click', () => {
    type('/');
    (element.querySelectorAll<HTMLElement>('[role="option"]')[0]).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.text()).toBe('/explain ');
  });

  it('Enter sends only when allowed; Shift+Enter is a newline', () => {
    type('why is edge-plc-08 offline?');
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(sent).toEqual([]);
    expect((element.querySelector('.send') as HTMLButtonElement).disabled).toBe(true);

    fixture.componentRef.setInput('canSend', true);
    fixture.detectChanges();
    expect(press('Enter', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(sent).toEqual([]);
    press('Enter');
    expect(sent).toEqual(['why is edge-plc-08 offline?']);
  });

  it('shows a stop button while a turn runs', () => {
    const stop = vi.fn();
    fixture.componentInstance.stop.subscribe(stop);
    fixture.componentRef.setInput('sending', true);
    fixture.detectChanges();
    (element.querySelector('.send') as HTMLButtonElement).click();
    expect(stop).toHaveBeenCalled();
  });

  it('focus() puts the caret after a prefill', () => {
    document.body.appendChild(element);
    fixture.componentInstance.text.set('/explain edge');
    fixture.detectChanges();
    fixture.componentInstance.focus();
    expect(document.activeElement).toBe(textarea());
    expect(textarea().selectionStart).toBe('/explain edge'.length);
    element.remove();
  });
});
