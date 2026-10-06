import { buildHourlyHistogram, countPipelineExecutions, HISTOGRAM_HOURS, HOUR_MS, latestStatisticsUpdate, pipelineExecutionInputs } from './pipeline-executions';

describe('buildHourlyHistogram', () => {
  const currentHourStart = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;

  it('returns 24 contiguous hourly slots ending at the current hour, zero when empty', () => {
    const slots = buildHourlyHistogram([]);
    expect(slots.length).toBe(HISTOGRAM_HOURS);
    expect(slots[23].hourStart).toBe(currentHourStart);
    expect(slots[0].hourStart).toBe(currentHourStart - 23 * HOUR_MS);
    expect(slots.every(s => s.ok === 0 && s.fail === 0)).toBe(true);
  });

  it('maps a bucket into the correct slot and gap-fills the rest', () => {
    const threeHoursAgo = new Date(currentHourStart - 3 * HOUR_MS).toISOString();
    const slots = buildHourlyHistogram([{ hourStartAt: threeHoursAgo, successCount: 4, failureCount: 1 }]);
    expect(slots[20].ok).toBe(4);
    expect(slots[20].fail).toBe(1);
    expect(slots[19].ok).toBe(0);
    expect(slots[21].ok).toBe(0);
  });

  it('sums buckets that fall in the same hour', () => {
    const twoHoursAgo = new Date(currentHourStart - 2 * HOUR_MS).toISOString();
    const slots = buildHourlyHistogram([
      { hourStartAt: twoHoursAgo, successCount: 3, failureCount: 0 },
      { hourStartAt: twoHoursAgo, successCount: 2, failureCount: 5 }
    ]);
    expect(slots[21].ok).toBe(5);
    expect(slots[21].fail).toBe(5);
  });

  it('ignores buckets outside the 24h window', () => {
    const old = new Date(currentHourStart - 48 * HOUR_MS).toISOString();
    const slots = buildHourlyHistogram([{ hourStartAt: old, successCount: 9, failureCount: 9 }]);
    expect(slots.every(s => s.ok === 0 && s.fail === 0)).toBe(true);
  });

  it('adds nothing to the current bar: the buckets already hold every execution (AB#5583)', () => {
    // Legacy seed arguments are ignored — seeding the rolling last hour double-counted.
    const seeded = buildHourlyHistogram([], 2, 1);
    expect(seeded[23]).toMatchObject({ ok: 0, fail: 0 });

    const nowHour = new Date(currentHourStart).toISOString();
    const prevHour = new Date(currentHourStart - HOUR_MS).toISOString();
    const slots = buildHourlyHistogram([
      { hourStartAt: nowHour, successCount: 7, failureCount: 0 },
      { hourStartAt: prevHour, successCount: 1, failureCount: 3 }
    ], 9, 9);
    expect(slots[23]).toMatchObject({ ok: 7, fail: 0 });
    expect(slots[22]).toMatchObject({ ok: 1, fail: 3 });
    // The 24 bars sum to the bucket totals, i.e. last24Hours* of the backend.
    expect(slots.reduce((sum, slot) => sum + slot.ok + slot.fail, 0)).toBe(11);
  });

  it('ends the bars with the hour of the statistics\' last update when the browser is already in the next hour', () => {
    const now = Date.parse('2026-10-06T11:02:00Z');
    const anchor = '2026-10-06T10:58:00Z';
    const buckets = [
      { hourStartAt: '2026-10-06T10:00:00Z', successCount: 5, failureCount: 1 },
      { hourStartAt: '2026-10-05T11:00:00Z', successCount: 2, failureCount: 0 }
    ];
    const anchored = buildHourlyHistogram(buckets, { anchor, now });
    expect(anchored[23]).toMatchObject({ hourStart: Date.parse('2026-10-06T10:00:00Z'), ok: 5, fail: 1 });
    expect(anchored[0]).toMatchObject({ hourStart: Date.parse('2026-10-05T11:00:00Z'), ok: 2 });

    // Browser clock: the current (empty) hour last, the oldest bucket drops out of the window.
    const browser = buildHourlyHistogram(buckets, { now });
    expect(browser[23]).toMatchObject({ hourStart: Date.parse('2026-10-06T11:00:00Z'), ok: 0 });
    expect(browser.reduce((sum, slot) => sum + slot.ok, 0)).toBe(5);
  });

  it('ignores a stale, future or invalid anchor (more than an hour from now)', () => {
    const now = Date.parse('2026-10-06T11:02:00Z');
    const end = (anchor: string | null) => buildHourlyHistogram([], { anchor, now })[23].hourStart;
    expect(end('2026-10-06T08:00:00Z')).toBe(Date.parse('2026-10-06T11:00:00Z'));
    expect(end('2026-10-06T13:00:00Z')).toBe(Date.parse('2026-10-06T11:00:00Z'));
    expect(end('not a date')).toBe(Date.parse('2026-10-06T11:00:00Z'));
    expect(end(null)).toBe(Date.parse('2026-10-06T11:00:00Z'));
    // Browser clock slightly behind the server: the server's hour wins.
    expect(end('2026-10-06T12:00:30Z')).toBe(Date.parse('2026-10-06T12:00:00Z'));
  });

  it('picks the newest lastUpdatedAt of several statistics as the anchor', () => {
    expect(latestStatisticsUpdate([
      { lastUpdatedAt: '2026-10-06T10:01:00Z' }, null, { lastUpdatedAt: null }, { lastUpdatedAt: new Date('2026-10-06T10:05:00Z') }, { lastUpdatedAt: 'x' }
    ])?.toISOString()).toBe('2026-10-06T10:05:00.000Z');
    expect(latestStatisticsUpdate([])).toBeNull();
  });

  it('tolerates null buckets and null input', () => {
    expect(buildHourlyHistogram(null).length).toBe(HISTOGRAM_HOURS);
    expect(buildHourlyHistogram([null]).length).toBe(HISTOGRAM_HOURS);
  });
});



describe('countPipelineExecutions', () => {
  const now = Date.parse('2026-10-06T10:00:00Z');
  const stats = (extra: Record<string, unknown> = {}) => ({
    lastHourSuccessCount: 1, lastHourFailureCount: 0, last24HoursSuccessCount: 10, last24HoursFailureCount: 2, ...extra
  });

  it('sums the folded statistics over pipelines', () => {
    const counts = countPipelineExecutions([{ statistics: stats() }, { statistics: stats() }], now);
    expect(counts).toMatchObject({ success24h: 20, failure24h: 4, success1h: 2, failure1h: 0, hasData: true });
  });

  it('counts a latest execution newer than the statistics, not an older one', () => {
    const newer = countPipelineExecutions([{
      statistics: stats({ lastExecutionAt: new Date(now - 3 * 3600_000) }),
      latestExecution: { startedAt: new Date(now - 60_000), status: 'FAILED' }
    }], now);
    expect(newer).toMatchObject({ failure24h: 3, failure1h: 1 });
    expect(newer.latestExecution?.getTime()).toBe(now - 60_000);

    const older = countPipelineExecutions([{
      statistics: stats({ lastExecutionAt: new Date(now) }),
      latestExecution: { startedAt: new Date(now - 60_000), status: 'FAILED' }
    }], now);
    expect(older.failure24h).toBe(2);
  });

  it('does not add a latest execution the statistics already contain (started before lastUpdatedAt, AB#5583)', () => {
    const covered = countPipelineExecutions([{
      statistics: stats({ lastExecutionAt: new Date(now - 3 * 3600_000), lastUpdatedAt: new Date(now - 30_000) }),
      latestExecution: { startedAt: new Date(now - 60_000), status: 'FAILED' }
    }], now);
    expect(covered).toMatchObject({ failure24h: 2, failure1h: 0 });
    expect(covered.latestExecution?.getTime()).toBe(now - 60_000);

    const after = countPipelineExecutions([{
      statistics: stats({ lastExecutionAt: new Date(now - 3 * 3600_000), lastUpdatedAt: new Date(now - 120_000) }),
      latestExecution: { startedAt: new Date(now - 60_000), status: 'COMPLETED' }
    }], now);
    expect(after).toMatchObject({ success24h: 11, success1h: 2 });
  });

  it('has no data without statistics or executions', () => {
    expect(countPipelineExecutions([{}], now).hasData).toBe(false);
  });

  it('reads the inputs from data-flow child pipelines', () => {
    const inputs = pipelineExecutionInputs([
      { statisticsForPipeline: { items: [stats()] }, executedPipeline: { items: [{ startedAt: 'x', status: 'COMPLETED' }] } },
      null,
      { statisticsForPipeline: { items: [] } }
    ]);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].latestExecution?.status).toBe('COMPLETED');
    expect(inputs[1]).toEqual({ statistics: null, latestExecution: null });
  });
});
