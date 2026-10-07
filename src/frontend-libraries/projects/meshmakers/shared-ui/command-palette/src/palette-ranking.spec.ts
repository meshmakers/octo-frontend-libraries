import { PaletteResult } from './command-palette.models';
import { parsePaletteQuery } from './palette-query';
import { highlightSegments, matchTier, MatchTier, rankResults, RankedGroup, scoreResult, stabilizeRanking } from './palette-ranking';

function result(id: string, label: string, extra: Partial<PaletteResult> = {}): PaletteResult {
  return { id, group: 'page', label, run: () => Promise.resolve(), ...extra };
}

const labelsOf = (groups: ReturnType<typeof rankResults>) => groups.map(group => [group.group, group.results.map(r => r.label)]);

describe('matchTier', () => {
  it('ranks prefix above word start above subsequence', () => {
    expect(matchTier('Adapters', 'ada')).toBe(MatchTier.Prefix);
    expect(matchTier('Data Flows', 'flo')).toBe(MatchTier.WordStart);
    expect(matchTier('System.Communication/Adapter', 'adap')).toBe(MatchTier.WordStart);
    expect(matchTier('edge-plc-07', 'plc')).toBe(MatchTier.WordStart);
    expect(matchTier('Data Permissions', 'dprm')).toBe(MatchTier.Fuzzy);
    expect(matchTier('Pools', 'xyz')).toBe(MatchTier.None);
  });

  it('is case-insensitive and empty-safe', () => {
    expect(matchTier('Adapters', 'ADA')).toBe(MatchTier.Prefix);
    expect(matchTier('', 'a')).toBe(MatchTier.None);
    expect(matchTier(undefined, 'a')).toBe(MatchTier.None);
    expect(matchTier('Adapters', '')).toBe(MatchTier.None);
  });
});

describe('scoreResult', () => {
  it('scores a label match above the same tier on a keyword', () => {
    const byLabel = scoreResult(result('a', 'Pipelines'), 'pip');
    const byKeyword = scoreResult(result('b', 'Data Flows', { keywords: ['pipelines'] }), 'pip');
    expect(byLabel).toBeGreaterThan(byKeyword);
    expect(byKeyword).toBeGreaterThan(0);
  });

  it('never lets frecency lift a result into a higher tier', () => {
    const wordStartNeverVisited = scoreResult(result('a', 'Data Flows'), 'flo', 0);
    const fuzzyMostVisited = scoreResult(result('b', 'Overflow'), 'flo', 1);
    expect(wordStartNeverVisited).toBeGreaterThan(fuzzyMostVisited);
  });

  it('orders within a tier by frecency', () => {
    expect(scoreResult(result('a', 'Adapters'), 'ad', 0.8)).toBeGreaterThan(scoreResult(result('b', 'Admin'), 'ad', 0.1));
  });

  it('puts an exact id match first and drops non-matches', () => {
    expect(scoreResult(result('a', 'whatever', { exactMatch: true }), 'zzz')).toBeGreaterThan(1000);
    expect(scoreResult(result('b', 'Pools'), 'zzz')).toBe(0);
    expect(scoreResult(result('c', 'Ask', { alwaysShow: true }), 'zzz')).toBe(1);
  });

  it('lets rankBoost (pinned boards) lead an empty query but never lift a tier', () => {
    expect(scoreResult(result('a', 'Finance', { rankBoost: 1 }), '', 0)).toBeGreaterThan(scoreResult(result('b', 'Plant'), '', 0.9));
    const fuzzyPinned = scoreResult(result('c', 'Overflow', { rankBoost: 1 }), 'flo', 1);
    expect(scoreResult(result('d', 'Data Flows'), 'flo', 0)).toBeGreaterThan(fuzzyPinned);
  });

  it('gives every row a positive score for an empty query', () => {
    expect(scoreResult(result('a', 'Pools'), '')).toBeGreaterThan(0);
  });
});

describe('rankResults', () => {
  const rows: PaletteResult[] = [
    result('p1', 'Adapters', { path: ['Integration'] }),
    result('p2', 'Data Flows'),
    result('a1', 'Switch to dark theme', { group: 'action' }),
    result('e1', 'edge-adapter', { group: 'entity' }),
    result('e2', 'adapter-east', { group: 'entity' }),
    result('ai', 'Ask the assistant', { group: 'ai', alwaysShow: true })
  ];

  it('lists pages and actions before entities for short queries', () => {
    const ranked = rankResults(rows, parsePaletteQuery('ada'));
    expect(labelsOf(ranked)).toEqual([
      ['page', ['Adapters']],
      ['entity', ['adapter-east', 'edge-adapter']],
      ['ai', ['Ask the assistant']]
    ]);
  });

  it('lists entities first for longer queries', () => {
    const ranked = rankResults(rows, parsePaletteQuery('adapter'));
    expect(ranked.map(group => group.group)).toEqual(['entity', 'page', 'ai']);
    // prefix beats word start inside the group
    expect(ranked[0].results.map(r => r.label)).toEqual(['adapter-east', 'edge-adapter']);
  });

  it('moves the group of an exact id match to the top', () => {
    const exact = result('e3', 'mesh-adapter', { group: 'entity', exactMatch: true });
    const ranked = rankResults([...rows, exact], parsePaletteQuery('65d5c447b420da3fb12381bc'));
    expect(ranked[0].group).toBe('entity');
    expect(ranked[0].results[0].id).toBe('e3');
  });

  it('keeps the assistant row last', () => {
    const ranked = rankResults(rows, parsePaletteQuery('theme'));
    expect(ranked[ranked.length - 1].group).toBe('ai');
  });

  it('breaks ties with frecency', () => {
    const ranked = rankResults(
      [result('x', 'Pools', { recentKey: '/t/pools' }), result('y', 'Pipelines', { recentKey: '/t/pipelines' })],
      parsePaletteQuery('p'),
      key => key === '/t/pools' ? 0.9 : 0
    );
    expect(ranked[0].results.map(r => r.label)).toEqual(['Pools', 'Pipelines']);
  });

  it('drops duplicate ids and limits rows per group', () => {
    const many = Array.from({ length: 20 }, (_, i) => result(`p${i}`, `Page ${i}`));
    expect(rankResults([...many, many[0]], parsePaletteQuery('page'))[0].results).toHaveLength(8);
    expect(rankResults(many, parsePaletteQuery(''))[0].results).toHaveLength(6);
    expect(rankResults(many.map(r => ({ ...r, group: 'action' as const })), parsePaletteQuery('>page'))[0].results).toHaveLength(20);
  });
});

describe('stabilizeRanking', () => {
  const r = (id: string, group: PaletteResult['group'] = 'page') => result(id, id, { group });
  const ids = (groups: RankedGroup[]) => groups.map(g => [g.group, g.results.map(x => x.id)]);

  it('uses the fresh ranking when nothing is shown yet', () => {
    const next: RankedGroup[] = [{ group: 'entity', results: [r('e1', 'entity')] }];
    expect(stabilizeRanking([], next)).toEqual(next);
  });

  it('appends a late group below the shown ones, assistant last', () => {
    const shown: RankedGroup[] = [{ group: 'page', results: [r('p1')] }, { group: 'ai', results: [r('ai', 'ai')] }];
    const fresh: RankedGroup[] = [
      { group: 'entity', results: [r('e1', 'entity')] },
      { group: 'page', results: [r('p1')] },
      { group: 'ai', results: [r('ai', 'ai')] }
    ];
    expect(ids(stabilizeRanking(shown, fresh))).toEqual([['page', ['p1']], ['entity', ['e1']], ['ai', ['ai']]]);
  });

  it('keeps shown rows in order and appends late rows inside a group', () => {
    const shown: RankedGroup[] = [{ group: 'entity', results: [r('b', 'entity'), r('c', 'entity')] }];
    const fresh: RankedGroup[] = [{ group: 'entity', results: [r('a', 'entity'), r('c', 'entity'), r('b', 'entity')] }];
    expect(ids(stabilizeRanking(shown, fresh))).toEqual([['entity', ['b', 'c', 'a']]]);
  });

  it('drops rows and groups that are gone', () => {
    const shown: RankedGroup[] = [{ group: 'page', results: [r('p1'), r('p2')] }, { group: 'action', results: [r('a1', 'action')] }];
    const fresh: RankedGroup[] = [{ group: 'page', results: [r('p2')] }];
    expect(ids(stabilizeRanking(shown, fresh))).toEqual([['page', ['p2']]]);
  });
});

describe('highlightSegments', () => {
  it('marks the first case-insensitive occurrence', () => {
    expect(highlightSegments('Edge Adapter', 'adap')).toEqual([
      { text: 'Edge ', match: false },
      { text: 'Adap', match: true },
      { text: 'ter', match: false }
    ]);
  });

  it('returns the plain label without a match', () => {
    expect(highlightSegments('Pools', 'x')).toEqual([{ text: 'Pools', match: false }]);
    expect(highlightSegments('Pools', '')).toEqual([{ text: 'Pools', match: false }]);
  });
});
