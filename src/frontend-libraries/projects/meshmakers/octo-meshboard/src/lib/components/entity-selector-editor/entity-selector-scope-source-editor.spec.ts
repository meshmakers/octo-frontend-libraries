import type { EntitySelectorConfig } from '../../models/meshboard.models';
import { BUILDING, ROOM, SITE, TO_BUILDING, TO_ROOM, TO_STOREY } from '../../testing/entity-selector-scope-source.fixtures';
import {
  dependentsSentence,
  isInvalidScopeSource,
  lockLastHopTarget,
  scopeSourceLeaderOptions,
  scopeSourceSummary,
  scopeSourceToSave,
  scopeSourceValidationError,
  selectorsDependingOn
} from './entity-selector-scope-source-editor';

/** Editor rules of the "List only entities inside" section (AB#7917). Neutral fixtures only. */
describe('entity-selector-scope-source-editor (AB#7917)', () => {
  const follower: EntitySelectorConfig = { id: 'zone', label: 'Zone', ckTypeId: 'Test/Site', attributeMappings: [], followsSelectorId: 'site' };
  const plain: EntitySelectorConfig = { id: 'device', label: 'Device', ckTypeId: 'Test/Device', attributeMappings: [] };

  describe('scopeSourceLeaderOptions', () => {
    it('offers other selectors that are neither followers nor dependent', () => {
      expect(scopeSourceLeaderOptions([SITE, ROOM, follower, plain], 'room').map(s => s.id)).toEqual(['site', 'device']);
    });

    it('never offers the edited selector itself', () => {
      expect(scopeSourceLeaderOptions([SITE, plain], 'site').map(s => s.id)).toEqual(['device']);
    });
  });

  describe('selectorsDependingOn / dependentsSentence', () => {
    it('lists the selectors whose scope source names the selector', () => {
      expect(selectorsDependingOn([SITE, ROOM, BUILDING, plain], 'site').map(s => s.id)).toEqual(['room', 'building']);
      expect(selectorsDependingOn([SITE, ROOM], '')).toEqual([]);
    });

    it('builds the sentence in singular and plural', () => {
      expect(dependentsSentence([ROOM])).toBe('Room lists only entities inside this selector');
      expect(dependentsSentence([ROOM, BUILDING])).toBe('Room and Building list only entities inside this selector');
    });
  });

  describe('scopeSourceToSave / lockLastHopTarget', () => {
    it('saves one hop as a path with an explicit direction', () => {
      expect(scopeSourceToSave('site', [{ roleId: ' System/ParentChild ', targetCkTypeId: 'Test/Building' }]))
        .toEqual({ selectorId: 'site', path: [{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Building' }] });
    });

    it('sets only the last target to the selector type', () => {
      const hops = lockLastHopTarget([TO_BUILDING, { ...TO_STOREY, targetCkTypeId: 'Test/Other' }], 'Test/Room');
      expect(hops).toEqual([TO_BUILDING, { ...TO_STOREY, targetCkTypeId: 'Test/Room' }]);
      expect(lockLastHopTarget([], 'Test/Room')).toEqual([]);
    });
  });

  describe('scopeSourceValidationError', () => {
    it('accepts a valid leader and a path ending at the selector type', () => {
      expect(scopeSourceValidationError([SITE, ROOM], ROOM)).toBeNull();
      expect(scopeSourceValidationError([SITE, BUILDING], BUILDING)).toBeNull();
    });

    it('accepts a new selector that is not on the board yet', () => {
      expect(scopeSourceValidationError([SITE], { ...ROOM, id: 'room2' })).toBeNull();
    });

    it('ignores a follower (its scope source is dropped on save)', () => {
      expect(scopeSourceValidationError([SITE], { ...ROOM, followsSelectorId: 'site' })).toBeNull();
    });

    it('refuses a leader that follows another selector', () => {
      const room = { ...ROOM, scopeSource: { selectorId: 'zone', path: [TO_ROOM] } };
      expect(scopeSourceValidationError([SITE, follower, room], room)).toBe('Zone follows another selector - pick another leader or none.');
    });

    it('refuses a leader that is dependent itself', () => {
      const desk = { id: 'desk', label: 'Desk', ckTypeId: 'Test/Desk', attributeMappings: [], scopeSource: { selectorId: 'room', path: [{ ...TO_ROOM, targetCkTypeId: 'Test/Desk' }] } };
      expect(scopeSourceValidationError([SITE, ROOM, desk], desk)).toBe('Room lists only entities inside another selector - pick another leader or none.');
    });

    it('refuses a leader that does not exist', () => {
      const room = { ...ROOM, scopeSource: { selectorId: 'gone', path: [TO_ROOM] } };
      expect(scopeSourceValidationError([SITE, room], room)).toBe("The selector 'gone' does not exist - pick another leader or none.");
    });

    it('refuses the selector as its own leader', () => {
      const room = { ...ROOM, scopeSource: { selectorId: 'room', path: [TO_ROOM] } };
      expect(scopeSourceValidationError([SITE, room], room)).toBe('A selector cannot list only entities inside its own pick.');
    });

    it('refuses a selector that others depend on (one level)', () => {
      const site = { ...SITE, scopeSource: { selectorId: 'device', path: [{ ...TO_BUILDING, targetCkTypeId: 'Test/Site' }] } };
      expect(scopeSourceValidationError([site, ROOM, plain], site))
        .toBe('Room lists only entities inside this selector. A selector with dependents cannot list only entities inside another one.');
    });

    it('asks for at least one hop', () => {
      const room = { ...ROOM, scopeSource: { selectorId: 'site', path: [] } };
      expect(scopeSourceValidationError([SITE, room], room)).toBe('Add at least one hop from Test/Site to Test/Room.');
    });

    it('names a hop without role or target type', () => {
      const room = { ...ROOM, scopeSource: { selectorId: 'site', path: [{ ...TO_BUILDING, roleId: '' }, TO_ROOM] } };
      expect(scopeSourceValidationError([SITE, room], room)).toBe('Hop 1 needs an association and a target type.');
    });

    it('refuses more than five hops', () => {
      const room = { ...ROOM, scopeSource: { selectorId: 'site', path: [TO_BUILDING, TO_STOREY, TO_STOREY, TO_STOREY, TO_STOREY, TO_ROOM] } };
      expect(scopeSourceValidationError([SITE, room], room)).toBe('At most 5 hops.');
    });

    it('refuses a path that ends at another type', () => {
      const room = { ...ROOM, scopeSource: { selectorId: 'site', path: [TO_BUILDING] } };
      expect(scopeSourceValidationError([SITE, room], room)).toBe("The last hop must end at Test/Room (this selector's CK type).");
    });
  });

  describe('list summary', () => {
    it('shows the leader label and the hop count', () => {
      expect(scopeSourceSummary([SITE, ROOM], ROOM)).toBe('Inside: Site (3 hops)');
      expect(scopeSourceSummary([SITE, BUILDING], BUILDING)).toBe('Inside: Site (1 hop)');
    });

    it('shows nothing for a selector that is not dependent, or a follower', () => {
      expect(scopeSourceSummary([SITE], SITE)).toBe('');
      expect(scopeSourceSummary([SITE], { ...ROOM, followsSelectorId: 'site' })).toBe('');
    });

    it('marks a scope source that cannot be used', () => {
      expect(isInvalidScopeSource([SITE, ROOM], ROOM)).toBe(false);
      expect(isInvalidScopeSource([ROOM], ROOM)).toBe(true);
      expect(scopeSourceSummary([ROOM], ROOM)).toBe('Inside: site (3 hops)');
    });
  });
});
