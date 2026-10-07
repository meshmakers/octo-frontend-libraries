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

/** True when `typed` matches the target name (trimmed, case-sensitive). */
export function dangerConfirmNameMatches(typed: string | null | undefined, targetName: string): boolean {
  return (typed ?? '').trim() === targetName.trim();
}
