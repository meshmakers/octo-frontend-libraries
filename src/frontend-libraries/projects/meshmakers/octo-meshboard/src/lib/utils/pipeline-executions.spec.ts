import { buildHourlyHistogram, countPipelineExecutions, HISTOGRAM_HOURS, HOUR_MS, pipelineExecutionInputs } from './pipeline-executions';

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

  it('seeds the current hour from the live counts only when its bucket is empty', () => {
    const seeded = buildHourlyHistogram([], 2, 1);
    expect(seeded[23].ok).toBe(2);
    expect(seeded[23].fail).toBe(1);

    const nowHour = new Date(currentHourStart).toISOString();
    const notSeeded = buildHourlyHistogram([{ hourStartAt: nowHour, successCount: 7, failureCount: 0 }], 2, 1);
    expect(notSeeded[23].ok).toBe(7);
    expect(notSeeded[23].fail).toBe(0);
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
