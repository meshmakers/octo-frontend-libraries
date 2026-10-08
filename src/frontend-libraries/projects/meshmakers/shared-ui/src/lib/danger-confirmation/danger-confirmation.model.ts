import {InjectionToken} from '@angular/core';

/**
 * Texts of the danger confirmation (AB#5578); apps translate them like the other shared-ui
 * dialogs (`Partial<…Messages>` per call or as `ConfirmationService.defaultDangerMessages`).
 */
export interface DangerConfirmationMessages {
  /** Dismissing button. Default: "Cancel" */
  cancel: string;
  /** Label of the type-to-confirm input; `{name}` = target name. Default: "Type {name} to confirm" */
  typeToConfirm: string;
  /** Environment notice; `{environment}` = environment label. Default: "{environment} environment. Check the target before you confirm." */
  environmentNotice: string;
  /** Label in front of the target. Default: "Target" */
  target: string;
}

export const DEFAULT_DANGER_CONFIRMATION_MESSAGES: DangerConfirmationMessages = {
  cancel: 'Cancel',
  typeToConfirm: 'Type {name} to confirm',
  environmentNotice: '{environment} environment. Check the target before you confirm.',
  target: 'Target',
};

/**
 * A destructive action's confirmation (Studio action guideline §2.4, AB#5578): the title names
 * the target, the body says what is lost, the confirming button names the verb + object and is
 * danger-styled on the right, Cancel on the left. Optionally the user has to type the target
 * name before the confirming button enables (production tenants).
 *
 * ```ts
 * const ok = await confirmation.showDangerConfirm({
 *   title: 'Delete adapter Mesh Adapter?',
 *   targetName: 'Mesh Adapter',
 *   consequence: 'The adapter and its configuration are deleted. This cannot be undone.',
 *   confirmText: 'Delete adapter',
 * });
 * ```
 */
export interface DangerConfirmationOptions {
  /** Dialog title naming the target ("Delete adapter Mesh Adapter?"). */
  title: string;
  /** Name of the affected item ("Mesh Adapter", "3 adapters"); shown emphasised and typed when required. */
  targetName: string;
  /** What is lost and whether it can be undone. */
  consequence: string;
  /** Confirming button: verb + object ("Delete adapter"), never "Yes" / "OK". */
  confirmText: string;
  /** Overrides `messages.cancel`. */
  cancelText?: string;
  /** The confirming button enables only once `targetName` is typed exactly (trimmed). */
  requireTypingName?: boolean;
  /** Environment label ("PRODUCTION", "STAGING") — shows the environment notice; omit in dev/test tenants. */
  environmentLabel?: string | null;
  messages?: Partial<DangerConfirmationMessages>;
}

/** Word typed when the target name is empty and no confirm text is set either. */
export const DANGER_CONFIRM_FALLBACK_WORD = 'DELETE';

/**
 * The text the user has to type when `requireTypingName` is set: the target name, or — when the
 * target name is empty/whitespace — the confirm button text, else {@link DANGER_CONFIRM_FALLBACK_WORD}.
 * Never empty, so an empty input can never satisfy the type-to-confirm rule.
 */
export function dangerConfirmTypingToken(options: Pick<DangerConfirmationOptions, 'targetName' | 'confirmText'>): string {
  return (options.targetName ?? '').trim() || (options.confirmText ?? '').trim() || DANGER_CONFIRM_FALLBACK_WORD;
}

/**
 * True when `typed` matches the target name (trimmed, case-sensitive). An empty/whitespace target
 * name never matches — use {@link dangerConfirmTypingToken} to get a non-empty word to type.
 */
export function dangerConfirmNameMatches(typed: string | null | undefined, targetName: string): boolean {
  const expected = (targetName ?? '').trim();
  return expected.length > 0 && (typed ?? '').trim() === expected;
}

/**
 * App-wide environment defaults of {@link ConfirmationService.showDangerConfirm} (AB#5578), e.g.
 * "production tenants type the target name". Applied whenever a caller — typically a library
 * component — leaves `requireTypingName` / `environmentLabel` unset; explicit caller options win.
 */
export interface DangerConfirmEnvironment {
  /** Default of `requireTypingName`. */
  requireTypingName: boolean;
  /** Default of `environmentLabel` ("PRODUCTION", "STAGING"); `null`/omitted = no notice. */
  environmentLabel?: string | null;
}

/**
 * Optional hook providing the current {@link DangerConfirmEnvironment}; evaluated each time a
 * danger confirmation opens (so it may read signals). Absent = behaviour unchanged.
 *
 * ```ts
 * { provide: DANGER_CONFIRM_ENVIRONMENT, useFactory: () => {
 *   const mode = inject(MyEnvironmentService);
 *   return () => ({ requireTypingName: mode.isProduction(), environmentLabel: mode.label() });
 * } }
 * ```
 */
export const DANGER_CONFIRM_ENVIRONMENT = new InjectionToken<() => DangerConfirmEnvironment>('DANGER_CONFIRM_ENVIRONMENT');

/** Applies the environment defaults to options that leave `requireTypingName` / `environmentLabel` unset. */
export function applyDangerConfirmEnvironment(
  options: DangerConfirmationOptions,
  environment: DangerConfirmEnvironment | null | undefined,
): DangerConfirmationOptions {
  if (!environment) {
    return options;
  }
  return {
    ...options,
    requireTypingName: options.requireTypingName ?? environment.requireTypingName,
    environmentLabel: options.environmentLabel !== undefined ? options.environmentLabel : (environment.environmentLabel ?? null),
  };
}
