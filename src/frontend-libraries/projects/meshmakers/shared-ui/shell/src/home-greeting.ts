import { ShellMessages, formatShellMessage, resolveShellMessages } from './shell.messages';

/**
 * The Home space header (wireframe screen 1, AB#5558): instead of the area name "Home" it greets
 * the user — "Good morning, Gerald" — with a short meta line naming the tenant. Pass the results
 * to `mm-space-shell` as `heading` and `meta`.
 *
 * Every helper takes optional {@link ShellMessages} overrides (translations).
 */

/** A label/value pair of the space header meta line (the value is set in mono). */
export interface SpaceMetaItem {
  label: string;
  value: string;
}

/** The parts of the signed-in user the greeting reads. */
export interface GreetingUser {
  given_name?: string | null;
}

/** Morning 05–11, afternoon 12–17, evening otherwise (local time of the browser). */
export function greetingPhrase(now: Date, messages?: Partial<ShellMessages> | null): string {
  const m = resolveShellMessages(messages);
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) {
    return m.greetingMorning;
  }
  if (hour >= 12 && hour < 18) {
    return m.greetingAfternoon;
  }
  return m.greetingEvening;
}

/** The first name: the `given_name` claim, else the first word of the display name, else null. */
export function firstNameOf(user: GreetingUser | null | undefined, displayName: string | null | undefined): string | null {
  const given = user?.given_name?.trim();
  if (given) {
    return given;
  }
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/** "Good morning, Gerald", or just "Good morning" when the name is unknown. */
export function homeGreeting(
  user: GreetingUser | null | undefined,
  displayName: string | null | undefined,
  now: Date,
  messages?: Partial<ShellMessages> | null
): string {
  const phrase = greetingPhrase(now, messages);
  const name = firstNameOf(user, displayName);
  return name ? formatShellMessage(resolveShellMessages(messages).greetingWithName, { greeting: phrase, name }) : phrase;
}

/** The meta line of the Home header: the tenant (nothing without one). */
export function homeMeta(tenantId: string | null | undefined, messages?: Partial<ShellMessages> | null): SpaceMetaItem[] {
  return tenantId ? [{ label: resolveShellMessages(messages).tenant, value: tenantId }] : [];
}
