import {
  MESHBOARD_DESCRIPTION_MARKER,
  compareMeshBoardNavigation,
  joinEncodedDescription,
  normalizeNavigation,
  readMeshBoardNavigation,
  splitEncodedDescription,
  withMeshBoardNavigation
} from './meshboard-description-codec';

describe('meshboard-description-codec', () => {
  const encoded = (description: string, data: unknown) =>
    `${description}\n${MESHBOARD_DESCRIPTION_MARKER}\n${JSON.stringify(data)}`;

  describe('splitEncodedDescription', () => {
    it('returns the plain text and no data when there is no marker', () => {
      expect(splitEncodedDescription('Plain board')).toEqual({ description: 'Plain board', data: null });
      expect(splitEncodedDescription(null)).toEqual({ description: '', data: null });
      expect(splitEncodedDescription(undefined)).toEqual({ description: '', data: null });
    });

    it('splits text and JSON and strips the separating newlines', () => {
      const result = splitEncodedDescription(encoded('Sales', { autoRefreshSeconds: 30 }));
      expect(result.description).toBe('Sales');
      expect(result.data).toEqual({ autoRefreshSeconds: 30 });
    });

    it('copes with the backend trimming the leading newline on an empty description', () => {
      const result = splitEncodedDescription(`${MESHBOARD_DESCRIPTION_MARKER}\n{"navigation":{"pinned":true}}`);
      expect(result.description).toBe('');
      expect(result.data).toEqual({ navigation: { pinned: true } });
    });

    it('normalises the legacy bare variables array', () => {
      const variables = [{ name: 'site', value: 'A' }];
      const result = splitEncodedDescription(encoded('Legacy', variables));
      expect(result.data).toEqual({ variables });
    });

    it('keeps the text and drops the data when the JSON is unreadable', () => {
      const result = splitEncodedDescription(`Broken\n${MESHBOARD_DESCRIPTION_MARKER}\n{not json`);
      expect(result).toEqual({ description: 'Broken', data: null });
    });
  });

  describe('joinEncodedDescription', () => {
    it('omits the marker when there is nothing to store', () => {
      expect(joinEncodedDescription('Text', null)).toBe('Text');
      expect(joinEncodedDescription('Text', {})).toBe('Text');
    });

    it('round-trips through splitEncodedDescription', () => {
      const data = { variables: [{ name: 'x' }], navigation: { pinned: true, order: 2 } };
      const stored = joinEncodedDescription('Round trip', data);
      expect(splitEncodedDescription(stored)).toEqual({ description: 'Round trip', data });
    });
  });

  describe('navigation', () => {
    it('reads undefined for boards without a pin', () => {
      expect(readMeshBoardNavigation('No pin')).toBeUndefined();
      expect(readMeshBoardNavigation(encoded('Other settings', { autoRefreshSeconds: 5 }))).toBeUndefined();
      expect(readMeshBoardNavigation(encoded('Explicitly off', { navigation: { pinned: false } }))).toBeUndefined();
    });

    it('reads a pinned board including its order', () => {
      expect(readMeshBoardNavigation(encoded('Pinned', { navigation: { pinned: true, order: 3 } })))
        .toEqual({ pinned: true, order: 3 });
    });

    it('pins a board while keeping every other encoded setting', () => {
      const original = encoded('Keep me', { autoRefreshSeconds: 60, timeZoneMode: 'utc' });
      const pinned = withMeshBoardNavigation(original, { pinned: true });

      const { description, data } = splitEncodedDescription(pinned);
      expect(description).toBe('Keep me');
      expect(data).toEqual({ autoRefreshSeconds: 60, timeZoneMode: 'utc', navigation: { pinned: true } });
    });

    it('pins a board that had no encoded settings at all', () => {
      const pinned = withMeshBoardNavigation('Fresh board', { pinned: true });
      expect(readMeshBoardNavigation(pinned)).toEqual({ pinned: true });
      expect(splitEncodedDescription(pinned).description).toBe('Fresh board');
    });

    it('unpinning removes the entry and drops a now-empty marker', () => {
      const pinned = withMeshBoardNavigation('Solo', { pinned: true });
      expect(withMeshBoardNavigation(pinned, undefined)).toBe('Solo');
      expect(withMeshBoardNavigation(pinned, { pinned: false })).toBe('Solo');
    });

    it('unpinning keeps the other settings', () => {
      const original = encoded('Mixed', { autoRefreshSeconds: 60, navigation: { pinned: true } });
      const unpinned = withMeshBoardNavigation(original, undefined);
      expect(splitEncodedDescription(unpinned).data).toEqual({ autoRefreshSeconds: 60 });
    });

    it('normalizes garbage to undefined and ignores non-numeric orders', () => {
      expect(normalizeNavigation(null)).toBeUndefined();
      expect(normalizeNavigation('pinned')).toBeUndefined();
      expect(normalizeNavigation({ pinned: 'yes' })).toBeUndefined();
      expect(normalizeNavigation({ pinned: true, order: 'first' })).toEqual({ pinned: true });
      expect(normalizeNavigation({ pinned: true, order: Number.NaN })).toEqual({ pinned: true });
    });

    it('sorts explicit orders first, then unordered boards by name', () => {
      const boards = [
        { name: 'Zulu', navigation: { pinned: true } },
        { name: 'Alpha', navigation: { pinned: true } },
        { name: 'Second', navigation: { pinned: true, order: 2 } },
        { name: 'First', navigation: { pinned: true, order: 1 } }
      ];
      expect([...boards].sort(compareMeshBoardNavigation).map(b => b.name))
        .toEqual(['First', 'Second', 'Alpha', 'Zulu']);
    });
  });
});
