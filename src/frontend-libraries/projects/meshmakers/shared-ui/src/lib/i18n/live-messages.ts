/**
 * Bridges between a host's translation store and the libraries' `*_MESSAGES` objects
 * (`SHELL_MESSAGES`, `COMMAND_PALETTE_MESSAGES`, `ASSISTANT_MESSAGES`, `MM_ROW_ACTIONS_MESSAGES`,
 * `ListViewMessages`, …). Moved here from the meshmakers-app (`shell-messages.i18n.ts`) so every
 * app wires the tokens the same way (Studio i18n concept §6, AB#6163).
 *
 * A key map assigns a translation key to each message member:
 * ```ts
 * const KEYS = { search: 'SHELL.MESSAGES.SEARCH', signOut: 'SHELL.MESSAGES.SIGN_OUT' } as const
 *   satisfies Partial<Record<keyof ShellMessages, string>>;
 * { provide: SHELL_MESSAGES, useFactory: () => {
 *     const translate = inject(TranslateService);
 *     return liveMessages(KEYS, (k) => translate.instant(k) as string);
 * } }
 * ```
 * A member whose lookup returns nothing, an empty string or the key itself (ngx-translate's answer
 * for a missing key) stays `undefined`, so the library's English default applies instead of a raw
 * key.
 */

/** A lookup into the host's translation store. */
export type MessageLookup = (key: string) => string | null | undefined;

function translated(t: MessageLookup, key: string): string | undefined {
  let value: string | null | undefined;
  try {
    value = t(key);
  } catch {
    return undefined;
  }
  return value && value !== key ? value : undefined;
}

/**
 * A snapshot of the messages in the active language. Re-run it on every language change and feed
 * the result to a component's `messages` input or a signal-backed messages factory.
 */
export function messagesFromTranslate<K extends string>(
  keys: Readonly<Record<K, string>>,
  t: MessageLookup
): Partial<Record<K, string>> {
  const messages: Partial<Record<K, string>> = {};
  for (const [member, key] of Object.entries(keys) as [K, string][]) {
    const value = translated(t, key);
    if (value !== undefined) {
      messages[member] = value;
    }
  }
  return messages;
}

/**
 * A messages object whose members are getters over the CURRENT translation — for app-wide tokens
 * that are injected once: a service that reads a member while deriving a text picks up a language
 * switch on its next read, without re-providing the token. Members without a translation are
 * `undefined` (the library keeps its English default).
 */
export function liveMessages<K extends string>(
  keys: Readonly<Record<K, string>>,
  t: MessageLookup
): Partial<Record<K, string>> {
  const messages = {} as Partial<Record<K, string>>;
  for (const [member, key] of Object.entries(keys) as [K, string][]) {
    Object.defineProperty(messages, member, {
      enumerable: true,
      get: (): string | undefined => translated(t, key),
    });
  }
  return messages;
}
