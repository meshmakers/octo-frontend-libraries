import { buildUrlWithRtId, buildInitialUrlWithRtId } from './url-sync';

describe('buildUrlWithRtId', () => {
  describe('route with :rtId param', () => {
    it('replaces the last path segment with the new rtId', () => {
      expect(buildUrlWithRtId({
        currentUrl: '/tenant/ui/meshboards/old-id',
        rtId: 'new-id',
        hasRtIdParam: true,
        syncUrlOptIn: false
      })).toBe('/tenant/ui/meshboards/new-id');
    });

    it('preserves the query string when replacing', () => {
      expect(buildUrlWithRtId({
        currentUrl: '/tenant/ui/meshboards/old-id?tf_type=year&tf_year=2026',
        rtId: 'new-id',
        hasRtIdParam: true,
        syncUrlOptIn: false
      })).toBe('/tenant/ui/meshboards/new-id?tf_type=year&tf_year=2026');
    });
  });

  describe('route without :rtId param, meshBoardSyncUrl opt-in', () => {
    it('appends the rtId to the current path', () => {
      expect(buildUrlWithRtId({
        currentUrl: '/tenant/ui/meshboards',
        rtId: 'board-1',
        hasRtIdParam: false,
        syncUrlOptIn: true
      })).toBe('/tenant/ui/meshboards/board-1');
    });

    it('preserves the query string when appending', () => {
      expect(buildUrlWithRtId({
        currentUrl: '/tenant/ui/meshboards?es_mp=rt-123',
        rtId: 'board-1',
        hasRtIdParam: false,
        syncUrlOptIn: true
      })).toBe('/tenant/ui/meshboards/board-1?es_mp=rt-123');
    });
  });

  describe('route without :rtId param, no opt-in (embedded boards, AB#4457)', () => {
    it('returns null so the URL is not rewritten', () => {
      expect(buildUrlWithRtId({
        currentUrl: '/dashboard',
        rtId: 'board-1',
        hasRtIdParam: false,
        syncUrlOptIn: false
      })).toBeNull();
    });

    it('returns null also when a query string is present', () => {
      expect(buildUrlWithRtId({
        currentUrl: '/de-AT/energy-measurements?tf_type=year',
        rtId: 'board-1',
        hasRtIdParam: false,
        syncUrlOptIn: false
      })).toBeNull();
    });
  });
});

describe('buildInitialUrlWithRtId', () => {
  it('appends the loaded rtId on an opt-in route opened without one, preserving the query string', () => {
    expect(buildInitialUrlWithRtId({
      currentUrl: '/energyiq/ui/meshboards?tf_type=relative&tf_rv=24&tf_ru=hours',
      loadedRtId: 'board-1',
      rtIdFromRoute: null,
      hasRtIdParam: false,
      syncUrlOptIn: true
    })).toBe('/energyiq/ui/meshboards/board-1?tf_type=relative&tf_rv=24&tf_ru=hours');
  });

  it('returns null when the URL already carried the rtId', () => {
    expect(buildInitialUrlWithRtId({
      currentUrl: '/energyiq/ui/meshboards/board-1',
      loadedRtId: 'board-1',
      rtIdFromRoute: 'board-1',
      hasRtIdParam: true,
      syncUrlOptIn: false
    })).toBeNull();
  });

  it('returns null when no board loaded', () => {
    expect(buildInitialUrlWithRtId({
      currentUrl: '/energyiq/ui/meshboards',
      loadedRtId: null,
      rtIdFromRoute: null,
      hasRtIdParam: false,
      syncUrlOptIn: true
    })).toBeNull();
  });

  it('returns null on embedded routes without opt-in (AB#4457)', () => {
    expect(buildInitialUrlWithRtId({
      currentUrl: '/dashboard?tf_type=year',
      loadedRtId: 'board-1',
      rtIdFromRoute: null,
      hasRtIdParam: false,
      syncUrlOptIn: false
    })).toBeNull();
  });
});
