import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DEFAULT_SHELL_MESSAGES, formatShellMessage, resolveShellMessages, SHELL_MESSAGES, shellMessages } from './shell.messages';

describe('shell messages', () => {
  it('defaults to English and lets later sources win, ignoring null and undefined members', () => {
    expect(resolveShellMessages()).toEqual(DEFAULT_SHELL_MESSAGES);
    const resolved = resolveShellMessages(
      { signIn: 'Anmelden', signOut: 'Abmelden' },
      null,
      { signOut: 'Ausloggen', theme: undefined as unknown as string, density: null as unknown as string }
    );
    expect(resolved.signIn).toBe('Anmelden');
    expect(resolved.signOut).toBe('Ausloggen');
    expect(resolved.theme).toBe('Theme');
    expect(resolved.density).toBe('Density');
  });

  it('fills placeholders and keeps unknown ones', () => {
    expect(formatShellMessage('Back to {target} {other}', { target: 'Adapters' })).toBe('Back to Adapters {other}');
  });

  it('merges the SHELL_MESSAGES token under the component input', () => {
    TestBed.configureTestingModule({ providers: [{ provide: SHELL_MESSAGES, useValue: { signIn: 'Anmelden', signOut: 'Abmelden' } }] });
    const input = signal<{ signOut?: string } | null>({ signOut: 'Raus' });
    const messages = TestBed.runInInjectionContext(() => shellMessages(input));
    expect(messages().signIn).toBe('Anmelden');
    expect(messages().signOut).toBe('Raus');
    input.set(null);
    expect(messages().signOut).toBe('Abmelden');
  });
});
