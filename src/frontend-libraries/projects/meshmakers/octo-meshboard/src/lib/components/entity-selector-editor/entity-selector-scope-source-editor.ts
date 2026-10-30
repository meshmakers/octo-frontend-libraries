import type { EntitySelectorConfig, EntitySelectorScopeHop, EntitySelectorScopeSource } from '../../models/meshboard.models';
import { isFollowerSelector, labelList } from '../../utils/entity-selector-follow';
import { hasScopeSource, resolveScopeSource } from '../../utils/entity-selector-scope-source';
import { scopeHopsValidationError } from '../../utils/entity-selector-scope-path';

/**
 * Editor rules of the "List only entities inside" section of the selector
 * editor (AB#7917). Pure functions over the board's selectors; the runtime
 * rules stay in `utils/entity-selector-scope-source.ts` (AB#7915), which the
 * validation below delegates to.
 */

/** Label of a selector in editor texts: its label, else its id. */
export function selectorName(selector: EntitySelectorConfig | undefined, fallbackId = ''): string {
  return selector ? (selector.label || selector.id) : fallbackId;
}

/**
 * Selectors the edited selector may list "inside": other selectors that are
 * neither followers (AB#7722) nor dependent themselves (one level).
 */
export function scopeSourceLeaderOptions(
  selectors: readonly EntitySelectorConfig[],
  editedId: string
): EntitySelectorConfig[] {
  return selectors.filter(s => s.id !== editedId && !isFollowerSelector(s) && !hasScopeSource(s));
}

/** Selectors whose `scopeSource` names `selectorId` (valid or not). */
export function selectorsDependingOn(
  selectors: readonly EntitySelectorConfig[],
  selectorId: string
): EntitySelectorConfig[] {
  return selectorId ? selectors.filter(s => s.id !== selectorId && s.scopeSource?.selectorId === selectorId) : [];
}

/** "A lists" / "A and B list" — the dependents of a selector as the subject of a sentence. */
export function dependentsSentence(dependents: readonly EntitySelectorConfig[]): string {
  return `${labelList(dependents)} ${dependents.length === 1 ? 'lists' : 'list'} only entities inside this selector`;
}

/** The scope source to save: hop fields only, direction made explicit. */
export function scopeSourceToSave(selectorId: string, hops: readonly EntitySelectorScopeHop[]): EntitySelectorScopeSource {
  return {
    selectorId,
    path: hops.map(h => ({ roleId: h.roleId.trim(), direction: h.direction ?? 'in', targetCkTypeId: h.targetCkTypeId.trim() }))
  };
}

/**
 * Hops with the last hop's target type set to the selector's CK type — the
 * path always ends at the type the dependent picker lists.
 */
export function lockLastHopTarget(hops: readonly EntitySelectorScopeHop[], ckTypeId: string): EntitySelectorScopeHop[] {
  if (hops.length === 0 || !ckTypeId) return [...hops];
  const last = hops[hops.length - 1];
  return last.targetCkTypeId === ckTypeId
    ? [...hops]
    : [...hops.slice(0, -1), { ...last, targetCkTypeId: ckTypeId }];
}

/**
 * Validation message of the edited selector's scope source, or `null` when it
 * can be saved. `edited` is the selector as the form would save it (its
 * `followsSelectorId` and `scopeSource` included); `selectors` are the board's
 * selectors (the stored version of the edited one is replaced). A follower has
 * no picker: its scope source is dropped on save, so it never blocks.
 */
export function scopeSourceValidationError(
  selectors: readonly EntitySelectorConfig[],
  edited: EntitySelectorConfig
): string | null {
  if (!edited.scopeSource || isFollowerSelector(edited)) return null;

  const dependents = selectorsDependingOn(selectors, edited.id);
  if (dependents.length > 0) {
    return `${dependentsSentence(dependents)}. A selector with dependents cannot list only entities inside another one.`;
  }

  const board = selectors.some(s => s.id === edited.id)
    ? selectors.map(s => (s.id === edited.id ? edited : s))
    : [...selectors, edited];
  const resolution = resolveScopeSource(board, edited);
  const leader = board.find(s => s.id === edited.scopeSource?.selectorId);
  const leaderName = selectorName(leader, edited.scopeSource.selectorId);
  if (resolution.kind === 'invalid') {
    switch (resolution.problem) {
      case 'unknown':
        return `The selector '${leaderName}' does not exist - pick another leader or none.`;
      case 'self':
        return 'A selector cannot list only entities inside its own pick.';
      case 'leaderFollower':
        return `${leaderName} follows another selector - pick another leader or none.`;
      case 'leaderDependent':
        return `${leaderName} lists only entities inside another selector - pick another leader or none.`;
      case 'path': {
        const path = edited.scopeSource.path ?? [];
        if (path.length === 0) {
          return `Add at least one hop from ${leader?.ckTypeId || leaderName} to ${edited.ckTypeId}.`;
        }
        return scopeHopsValidationError(path) ?? `The path is not valid: ${resolution.reason}.`;
      }
      case 'follower':
        return null;
    }
  }
  if (resolution.kind === 'source') {
    const last = resolution.hops[resolution.hops.length - 1];
    if (last && last.targetCkTypeId !== edited.ckTypeId) {
      return `The last hop must end at ${edited.ckTypeId} (this selector's CK type).`;
    }
  }
  return null;
}

/** "Inside: Site (3 hops)" of a selector in the collapsed list, or '' when it is not dependent. */
export function scopeSourceSummary(selectors: readonly EntitySelectorConfig[], selector: EntitySelectorConfig): string {
  if (!selector.scopeSource || isFollowerSelector(selector)) return '';
  const leader = selectors.find(s => s.id === selector.scopeSource?.selectorId);
  const hops = Array.isArray(selector.scopeSource.path) ? selector.scopeSource.path.length : 0;
  return `Inside: ${selectorName(leader, selector.scopeSource.selectorId || '?')} (${hops} ${hops === 1 ? 'hop' : 'hops'})`;
}

/** True when the selector's scope source cannot be used at runtime (the list marks it as an error). */
export function isInvalidScopeSource(selectors: readonly EntitySelectorConfig[], selector: EntitySelectorConfig): boolean {
  return !!selector.scopeSource && !isFollowerSelector(selector) && resolveScopeSource(selectors, selector).kind === 'invalid';
}
