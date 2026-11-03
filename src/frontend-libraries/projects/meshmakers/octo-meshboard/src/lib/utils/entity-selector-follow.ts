import type { EntitySelectorConfig } from '../models/meshboard.models';

/**
 * Leader/follower entity selectors (AB#7722).
 *
 * A follower (`followsSelectorId` set) has no picker of its own: it takes its
 * leader's current pick as its picked entity and resolves its own `childScope`
 * and attribute mappings from it. One level only — a leader can never itself be
 * a follower, so there are no chains and no cycles. Pure helpers, shared by the
 * view (runtime resolution), the toolbar and the selector editor.
 */

/** Why a follower's `followsSelectorId` cannot be used. */
export type FollowLeaderProblem = 'unknown' | 'self' | 'chained';

/**
 * The leader a selector follows:
 * - `none`: the selector does not follow another one.
 * - `leader`: a valid leader (exists, is not the selector itself, follows nobody).
 * - `invalid`: `followsSelectorId` names no selector of the board (`unknown`),
 *   the selector itself (`self`) or a selector that is itself a follower
 *   (`chained`). At runtime this is treated as "leader has no pick".
 */
export type FollowLeaderResolution =
  | { kind: 'none' }
  | { kind: 'leader'; leader: EntitySelectorConfig }
  | { kind: 'invalid'; problem: FollowLeaderProblem; leaderId: string };

/** True when the selector is configured to follow another selector. */
export function isFollowerSelector(selector: EntitySelectorConfig): boolean {
  return !!selector.followsSelectorId;
}

/** True when the selector renders a picker in the toolbar. Followers never do. */
export function showsInToolbar(selector: EntitySelectorConfig): boolean {
  return selector.showInToolbar !== false && !isFollowerSelector(selector);
}

/** Resolves the leader of `selector` among `selectors`. */
export function resolveFollowLeader(
  selectors: readonly EntitySelectorConfig[],
  selector: EntitySelectorConfig
): FollowLeaderResolution {
  const leaderId = selector.followsSelectorId;
  if (!leaderId) {
    return { kind: 'none' };
  }
  if (leaderId === selector.id) {
    return { kind: 'invalid', problem: 'self', leaderId };
  }
  const leader = selectors.find(s => s.id === leaderId);
  if (!leader) {
    return { kind: 'invalid', problem: 'unknown', leaderId };
  }
  if (isFollowerSelector(leader)) {
    return { kind: 'invalid', problem: 'chained', leaderId };
  }
  return { kind: 'leader', leader };
}

/**
 * The valid followers of `leaderId`: selectors whose `followsSelectorId` is
 * `leaderId`, provided the leader exists and is not itself a follower.
 */
export function followersOf(
  selectors: readonly EntitySelectorConfig[],
  leaderId: string
): EntitySelectorConfig[] {
  return selectors.filter(s =>
    s.followsSelectorId === leaderId && resolveFollowLeader(selectors, s).kind === 'leader'
  );
}

/**
 * Selectors that `selectorId` may follow (the editor's "Follows" list): every
 * other selector that does not follow one itself.
 */
export function eligibleLeaders(
  selectors: readonly EntitySelectorConfig[],
  selectorId: string
): EntitySelectorConfig[] {
  return selectors.filter(s => s.id !== selectorId && !isFollowerSelector(s));
}

/** Ids of the selectors that name `selectorId` as their leader (valid or not). */
export function selectorsFollowing(
  selectors: readonly EntitySelectorConfig[],
  selectorId: string
): EntitySelectorConfig[] {
  return selectors.filter(s => s.id !== selectorId && s.followsSelectorId === selectorId);
}

/**
 * The selector as it is resolved at runtime: a follower with a valid leader
 * picks from the leader's CK type (the editor fixes it to the leader's anyway;
 * this keeps an out-of-date stored type from breaking the entity fetch).
 */
export function effectiveSelector(
  selectors: readonly EntitySelectorConfig[],
  selector: EntitySelectorConfig
): EntitySelectorConfig {
  const resolution = resolveFollowLeader(selectors, selector);
  if (resolution.kind === 'leader' && resolution.leader.ckTypeId !== selector.ckTypeId) {
    return { ...selector, ckTypeId: resolution.leader.ckTypeId };
  }
  return selector;
}

/**
 * Editor validation of a "Follows" choice for the selector `selectorId`.
 * Returns the message that tells the author why the choice is not allowed, or
 * `null` when it is valid (including "follows nobody").
 */
export function followValidationError(
  selectors: readonly EntitySelectorConfig[],
  selectorId: string,
  followsSelectorId: string | undefined
): string | null {
  if (!followsSelectorId) {
    return null;
  }
  if (followsSelectorId === selectorId) {
    return 'A selector cannot follow itself.';
  }
  const followedBy = selectorsFollowing(selectors, selectorId);
  if (followedBy.length > 0) {
    return `Followed by ${labelList(followedBy)} — a selector that is followed cannot follow another one.`;
  }
  const leader = selectors.find(s => s.id === followsSelectorId);
  if (!leader) {
    return `The leader '${followsSelectorId}' does not exist — pick another leader or none.`;
  }
  if (isFollowerSelector(leader)) {
    return `The leader '${leader.label || leader.id}' follows another selector — pick another leader or none.`;
  }
  return null;
}

/** "A, B and C" from the selectors' labels (falling back to their ids). */
export function labelList(selectors: readonly EntitySelectorConfig[]): string {
  const labels = selectors.map(s => s.label || s.id);
  if (labels.length <= 1) {
    return labels.join('');
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
