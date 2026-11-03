import type { EntitySelectorConfig } from '../models/meshboard.models';
import {
  effectiveSelector,
  eligibleLeaders,
  followersOf,
  followValidationError,
  labelList,
  resolveFollowLeader,
  selectorsFollowing,
  showsInToolbar
} from './entity-selector-follow';

/** Leader/follower helpers (AB#7722). Neutral fixtures only (Test/Site → Test/Device). */
describe('entity-selector-follow (AB#7722)', () => {
  const site: EntitySelectorConfig = { id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [] };
  const grid: EntitySelectorConfig = { id: 'grid', label: 'Grid', ckTypeId: 'Test/Site', attributeMappings: [], followsSelectorId: 'site' };
  const sensors: EntitySelectorConfig = { id: 'sensors', label: 'Sensors', ckTypeId: 'Test/Site', attributeMappings: [], followsSelectorId: 'site' };
  const room: EntitySelectorConfig = { id: 'room', label: 'Room', ckTypeId: 'Test/Room', attributeMappings: [] };

  describe('resolveFollowLeader', () => {
    it('returns none for a selector that follows nobody', () => {
      expect(resolveFollowLeader([site], site)).toEqual({ kind: 'none' });
    });

    it('returns the leader', () => {
      expect(resolveFollowLeader([site, grid], grid)).toEqual({ kind: 'leader', leader: site });
    });

    it('flags an unknown, a self and a chained leader as invalid', () => {
      const orphan = { ...grid, followsSelectorId: 'gone' };
      const self = { ...grid, followsSelectorId: 'grid' };
      const chained = { ...room, followsSelectorId: 'grid' };
      expect(resolveFollowLeader([site, orphan], orphan)).toEqual({ kind: 'invalid', problem: 'unknown', leaderId: 'gone' });
      expect(resolveFollowLeader([self], self)).toEqual({ kind: 'invalid', problem: 'self', leaderId: 'grid' });
      expect(resolveFollowLeader([site, grid, chained], chained)).toEqual({ kind: 'invalid', problem: 'chained', leaderId: 'grid' });
    });
  });

  it('followersOf returns only the valid followers of a leader', () => {
    expect(followersOf([site, grid, sensors, room], 'site')).toEqual([grid, sensors]);
    // A follower cannot lead: a selector following `grid` is not its follower.
    expect(followersOf([site, grid, { ...room, followsSelectorId: 'grid' }], 'grid')).toEqual([]);
  });

  it('showsInToolbar hides hidden selectors and every follower', () => {
    expect(showsInToolbar(site)).toBe(true);
    expect(showsInToolbar({ ...site, showInToolbar: false })).toBe(false);
    expect(showsInToolbar({ ...grid, showInToolbar: true })).toBe(false);
  });

  it('eligibleLeaders lists the other non-follower selectors', () => {
    expect(eligibleLeaders([site, grid, room], 'grid')).toEqual([site, room]);
    expect(eligibleLeaders([site, grid, room], 'site')).toEqual([room]);
  });

  it('selectorsFollowing lists every selector naming the id, valid or not', () => {
    expect(selectorsFollowing([site, grid, sensors], 'site')).toEqual([grid, sensors]);
    expect(selectorsFollowing([site], 'site')).toEqual([]);
  });

  it('effectiveSelector gives a follower its leader\'s CK type', () => {
    const stale = { ...grid, ckTypeId: 'Test/Old' };
    expect(effectiveSelector([site, stale], stale).ckTypeId).toBe('Test/Site');
    expect(effectiveSelector([site, grid], grid)).toBe(grid);
    expect(effectiveSelector([room], room)).toBe(room);
  });

  describe('followValidationError', () => {
    it('accepts none and a valid leader', () => {
      expect(followValidationError([site, room], 'room', undefined)).toBeNull();
      expect(followValidationError([site, room], 'room', 'site')).toBeNull();
    });

    it('tells the author why a choice is not allowed', () => {
      expect(followValidationError([site], 'site', 'site')).toBe('A selector cannot follow itself.');
      expect(followValidationError([site, grid, room], 'site', 'room'))
        .toBe('Followed by Grid — a selector that is followed cannot follow another one.');
      expect(followValidationError([site], 'room', 'gone'))
        .toBe('The leader \'gone\' does not exist — pick another leader or none.');
      expect(followValidationError([site, grid], 'room', 'grid'))
        .toBe('The leader \'Grid\' follows another selector — pick another leader or none.');
    });
  });

  it('labelList joins labels', () => {
    expect(labelList([])).toBe('');
    expect(labelList([site])).toBe('Site');
    expect(labelList([site, grid, room])).toBe('Site, Grid and Room');
  });
});
