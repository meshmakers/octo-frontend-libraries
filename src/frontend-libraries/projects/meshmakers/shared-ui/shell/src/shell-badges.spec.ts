import { resolveShellBadge, SHELL_BADGE_MAX, shellBadgeText } from './shell-badges';

describe('shell badges (AB#5621)', () => {
  it('resolveShellBadge reads numbers and objects, the input winning over the own count', () => {
    expect(resolveShellBadge({ a: 2 }, 'a')).toEqual({ count: 2 });
    expect(resolveShellBadge({ a: { count: 3, attention: true } }, 'a')).toEqual({ count: 3, attention: true });
    expect(resolveShellBadge({ a: 1 }, 'a', 9)).toEqual({ count: 1 });
    expect(resolveShellBadge({}, 'a', 9)).toEqual({ count: 9 });
    expect(resolveShellBadge(null, 'a', 9)).toEqual({ count: 9 });
  });

  it('resolveShellBadge shows nothing for 0, negative, NaN or missing counts', () => {
    expect(resolveShellBadge({ a: 0 }, 'a')).toBeNull();
    expect(resolveShellBadge({ a: 0 }, 'a', 5)).toBeNull();
    expect(resolveShellBadge({ a: -1 }, 'a')).toBeNull();
    expect(resolveShellBadge({ a: Number.NaN }, 'a')).toBeNull();
    expect(resolveShellBadge({ a: { count: 0 } }, 'a')).toBeNull();
    expect(resolveShellBadge(undefined, 'a')).toBeNull();
  });

  it('shellBadgeText caps at 99+', () => {
    expect(shellBadgeText(1)).toBe('1');
    expect(shellBadgeText(SHELL_BADGE_MAX)).toBe('99');
    expect(shellBadgeText(SHELL_BADGE_MAX + 1)).toBe('99+');
  });
});
