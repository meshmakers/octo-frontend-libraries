import { nameSearchTerm } from './name-search-term';

/** What the server does with the term (`*` → `.*`, then a case-insensitive regex). */
function serverRegex(term: string): RegExp {
  return new RegExp(term.replace(/\*/g, '.*'), 'i');
}

describe('nameSearchTerm', () => {
  it('leaves plain text alone', () => {
    expect(nameSearchTerm('Test meter 4711')).toBe('Test meter 4711');
    expect(nameSearchTerm('')).toBe('');
  });

  it('escapes parentheses, so "Meter (24 h)" is a valid literal pattern', () => {
    const term = nameSearchTerm('Meter (24 h)');
    expect(term).toBe('Meter \\(24 h\\)');
    expect(serverRegex(term).test('Test Meter (24 h) daily')).toBe(true);
    expect(serverRegex(term).test('Meter 24 h')).toBe(false);
  });

  it('escapes every regex metacharacter', () => {
    expect(nameSearchTerm('a.b+c?d^e$f{1}g|h[i]j\\k')).toBe('a\\.b\\+c\\?d\\^e\\$f\\{1\\}g\\|h\\[i\\]j\\\\k');
    const text = '^a.b+c?$ {1} | [x] \\';
    expect(serverRegex(nameSearchTerm(text)).test(`prefix ${text} suffix`)).toBe(true);
  });

  it('matches * literally instead of as the server wildcard', () => {
    const term = nameSearchTerm('Test*meter');
    expect(term).toBe('Test\\x2Ameter');
    expect(term).not.toContain('*');
    expect(serverRegex(term).test('Test*meter')).toBe(true);
    expect(serverRegex(term).test('Test big meter')).toBe(false);
  });

  it('drops leading and trailing * (the search is unanchored anyway)', () => {
    expect(nameSearchTerm('Halle*')).toBe('Halle');
    expect(nameSearchTerm('*meter')).toBe('meter');
    expect(nameSearchTerm('**Test*meter**')).toBe('Test\\x2Ameter');
    expect(nameSearchTerm('***')).toBe('');
    expect(serverRegex(nameSearchTerm('Halle*')).test('Test Halle 3')).toBe(true);
  });

  it('writes a leading @ as \\x40, so it is searched literally and not as an expression', () => {
    const term = nameSearchTerm('@meter');
    expect(term).toBe('\\x40meter');
    expect(term.startsWith('@')).toBe(false);
    expect(serverRegex(term).test('Test @meter')).toBe(true);
    expect(nameSearchTerm('*@meter')).toBe('\\x40meter');
    expect(nameSearchTerm('a@b')).toBe('a@b');
  });
});
