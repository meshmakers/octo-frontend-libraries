import { liveMessages, messagesFromTranslate } from './live-messages';

const KEYS = { search: 'SHELL.SEARCH', signOut: 'SHELL.SIGN_OUT', theme: 'SHELL.THEME' } as const;

describe('live-messages', () => {
  let store: Record<string, string>;
  const t = (key: string): string => store[key] ?? key;

  beforeEach(() => {
    store = { 'SHELL.SEARCH': 'Search', 'SHELL.SIGN_OUT': '' };
  });

  it('messagesFromTranslate leaves out missing, empty and key-echo members', () => {
    expect(messagesFromTranslate(KEYS, t)).toEqual({ search: 'Search' });
  });

  it('liveMessages members read the current translation', () => {
    const messages = liveMessages(KEYS, t);
    expect(messages.search).toBe('Search');
    expect(messages.signOut).toBeUndefined();
    expect(messages.theme).toBeUndefined();
    store = { 'SHELL.SEARCH': 'Suchen', 'SHELL.THEME': 'Design' };
    expect(messages.search).toBe('Suchen');
    expect(messages.theme).toBe('Design');
    expect(Object.keys(messages)).toEqual(['search', 'signOut', 'theme']);
  });

  it('a throwing lookup yields undefined members', () => {
    const messages = liveMessages(KEYS, () => {
      throw new Error('no store');
    });
    expect(messages.search).toBeUndefined();
    expect(messagesFromTranslate(KEYS, () => null)).toEqual({});
  });

  it('spreading a live object keeps the lib default for missing members', () => {
    const defaults = { search: 'Search', signOut: 'Sign out', theme: 'Theme' };
    const live = liveMessages(KEYS, t);
    const merged = { ...defaults, ...Object.fromEntries(Object.entries(live).filter(([, v]) => v !== undefined)) };
    expect(merged).toEqual({ search: 'Search', signOut: 'Sign out', theme: 'Theme' });
  });
});
