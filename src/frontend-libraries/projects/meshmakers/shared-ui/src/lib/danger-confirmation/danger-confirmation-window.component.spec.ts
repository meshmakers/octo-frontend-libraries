import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogRef } from '@progress/kendo-angular-dialog';

import { DangerConfirmationResult, DangerConfirmationWindowComponent } from './danger-confirmation-window.component';
import {
  DANGER_CONFIRM_FALLBACK_WORD,
  DangerConfirmationOptions,
  dangerConfirmNameMatches,
  dangerConfirmTypingToken,
} from './danger-confirmation.model';
import { expectIconButtonsAccessible } from '../../../testing/src/public-api';

/** Danger confirmation naming the target (AB#5578). */
describe('DangerConfirmationWindowComponent (AB#5578)', () => {
  let fixture: ComponentFixture<DangerConfirmationWindowComponent>;
  let close: ReturnType<typeof vi.fn>;

  const base: DangerConfirmationOptions = {
    title: 'Delete adapter Mesh Adapter?',
    targetName: 'Mesh Adapter',
    consequence: 'The adapter is deleted. This cannot be undone.',
    confirmText: 'Delete adapter',
  };

  async function render(options: Partial<DangerConfirmationOptions> = {}): Promise<HTMLElement> {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [DangerConfirmationWindowComponent],
      providers: [{ provide: DialogRef, useValue: { close, dialog: { location: { nativeElement: document.createElement('div') } } } }],
    }).compileComponents();
    fixture = TestBed.createComponent(DangerConfirmationWindowComponent);
    fixture.componentInstance.options.set({ ...base, ...options });
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    (fixture?.nativeElement as HTMLElement | undefined)?.remove();
  });

  const button = (el: HTMLElement, action: string) => el.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;

  it('names the target and the consequence; Cancel left, danger confirm right', async () => {
    const el = await render();
    expect(el.querySelector('[data-target]')?.textContent).toBe('Mesh Adapter');
    expect(el.querySelector('[data-consequence]')?.textContent).toContain('cannot be undone');
    const buttons = Array.from(el.querySelectorAll('kendo-dialog-actions button')).map((b) => b.getAttribute('data-action'));
    expect(buttons).toEqual(['cancel', 'confirm']);
    expect(button(el, 'confirm').classList).toContain('k-button-error');
    expect(button(el, 'confirm').textContent?.trim()).toBe('Delete adapter');
    expect(el.querySelector('[data-production-warning]')).toBeNull();
    expect(el.querySelector('[data-type-to-confirm]')).toBeNull();
    button(el, 'confirm').click();
    expect(close).toHaveBeenCalledWith(new DangerConfirmationResult(true));
  });

  it('resolves false on Cancel', async () => {
    const el = await render();
    button(el, 'cancel').click();
    expect(close).toHaveBeenCalledWith(new DangerConfirmationResult(false));
  });

  it('puts the initial focus on Cancel, never on the destructive button', async () => {
    const el = await render();
    fixture.componentInstance.focusSafeElement();
    expect(document.activeElement).toBe(button(el, 'cancel'));
  });

  it('requires typing the target name in production, focuses the input and shows the environment notice', async () => {
    const el = await render({ requireTypingName: true, environmentLabel: 'PRODUCTION' });
    expect(el.querySelector('[data-production-warning]')?.textContent).toContain('PRODUCTION environment');
    const input = el.querySelector<HTMLInputElement>('[data-type-to-confirm]')!;
    expect(el.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Type Mesh Adapter to confirm');
    fixture.componentInstance.focusSafeElement();
    expect(document.activeElement).toBe(input);

    expect(button(el, 'confirm').disabled).toBe(true);
    button(el, 'confirm').click();
    expect(close).not.toHaveBeenCalled();

    input.value = 'Mesh';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el, 'confirm').disabled).toBe(true);

    input.value = ' Mesh Adapter ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el, 'confirm').disabled).toBe(false);
    button(el, 'confirm').click();
    expect(close).toHaveBeenCalledWith(new DangerConfirmationResult(true));
  });

  it('translates its texts via messages', async () => {
    const el = await render({ requireTypingName: true, messages: { cancel: 'Abbrechen', typeToConfirm: '{name} eingeben' } });
    expect(button(el, 'cancel').textContent?.trim()).toBe('Abbrechen');
    expect(el.querySelector('label')?.textContent).toBe('Mesh Adapter eingeben');
    expectIconButtonsAccessible(el);
  });

  it('matches the name trimmed and case-sensitive', () => {
    expect(dangerConfirmNameMatches(' a ', 'a')).toBe(true);
    expect(dangerConfirmNameMatches('A', 'a')).toBe(false);
    expect(dangerConfirmNameMatches(null, 'a')).toBe(false);
  });

  it('never matches an empty or whitespace target name (AB#5578 review fix 4)', () => {
    expect(dangerConfirmNameMatches('', '')).toBe(false);
    expect(dangerConfirmNameMatches('  ', ' ')).toBe(false);
    expect(dangerConfirmNameMatches(null, '')).toBe(false);
  });

  it('falls back to a non-empty word to type when the target name is empty', () => {
    expect(dangerConfirmTypingToken({ targetName: 'A', confirmText: 'Delete' })).toBe('A');
    expect(dangerConfirmTypingToken({ targetName: '  ', confirmText: 'Delete adapter' })).toBe('Delete adapter');
    expect(dangerConfirmTypingToken({ targetName: '', confirmText: ' ' })).toBe(DANGER_CONFIRM_FALLBACK_WORD);
  });

  it('with an empty target name, empty input never enables confirm; the shown fallback word does', async () => {
    const el = await render({ targetName: '  ', requireTypingName: true });
    const input = el.querySelector<HTMLInputElement>('[data-type-to-confirm]')!;
    expect(el.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Type Delete adapter to confirm');
    expect(button(el, 'confirm').disabled).toBe(true);

    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el, 'confirm').disabled).toBe(true);

    input.value = 'Delete adapter';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el, 'confirm').disabled).toBe(false);
  });
});
