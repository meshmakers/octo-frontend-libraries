import { compactTierForWidth, columnsForTier, placeWidgetsForTier, collapseEmptyRows, scaleColSpan, rowSpanForContent, MAX_CONTENT_ROWS, TILE_CHROME_HEIGHT } from './compact-layout';
import { AnyWidgetConfig } from '../models/meshboard.models';

describe('compact-layout', () => {
  const widget = (id: string, col: number, row: number, colSpan = 1, rowSpan = 1): AnyWidgetConfig => ({
    id,
    type: 'kpi',
    title: id,
    col,
    row,
    colSpan,
    rowSpan,
    dataSource: { type: 'static' }
  } as AnyWidgetConfig);

  describe('compactTierForWidth', () => {
    it('returns none before the first measurement', () => {
      expect(compactTierForWidth(null)).toBe('none');
    });

    it('maps widths to tiers at the breakpoints', () => {
      expect(compactTierForWidth(390)).toBe('phone');
      expect(compactTierForWidth(699)).toBe('phone');
      expect(compactTierForWidth(700)).toBe('tablet');
      expect(compactTierForWidth(1099)).toBe('tablet');
      expect(compactTierForWidth(1100)).toBe('none');
      expect(compactTierForWidth(2560)).toBe('none');
    });
  });

  describe('columnsForTier', () => {
    it('keeps the configured columns in the native tier', () => {
      expect(columnsForTier('none', 6)).toBe(6);
    });

    it('collapses to a single column on phones', () => {
      expect(columnsForTier('phone', 6)).toBe(1);
    });

    it('clamps to at most 3 columns on tablets, keeping smaller configs', () => {
      expect(columnsForTier('tablet', 6)).toBe(3);
      expect(columnsForTier('tablet', 2)).toBe(2);
    });
  });

  describe('placeWidgetsForTier', () => {
    it('passes the persisted anchors through untouched in the native tier', () => {
      const placements = placeWidgetsForTier([widget('a', 3, 2, 2, 1)], 'none', 6);
      expect(placements[0]).toEqual(expect.objectContaining({ col: 3, row: 2, colSpan: 2, rowSpan: 1 }));
    });

    it('drops anchors and sorts by reading order in compact tiers', () => {
      const placements = placeWidgetsForTier([widget('bottom', 1, 2), widget('right', 4, 1), widget('left', 1, 1)], 'phone', 6);
      expect(placements.map(p => p.widget.id)).toEqual(['left', 'right', 'bottom']);
      expect(placements.every(p => p.col === undefined && p.row === undefined)).toBe(true);
    });

    it('scales colSpan to the tier column count and preserves rowSpan', () => {
      const phone = placeWidgetsForTier([widget('a', 1, 1, 4, 2)], 'phone', 6);
      expect(phone[0].colSpan).toBe(1);
      expect(phone[0].rowSpan).toBe(2);

      const tablet = placeWidgetsForTier([widget('a', 1, 1, 4, 2)], 'tablet', 6);
      expect(tablet[0].colSpan).toBe(2);
    });

    it('keeps three span-2 KPI tiles of a 6-column board side by side on tablets (AB#5558)', () => {
      const tiles = placeWidgetsForTier([widget('a', 1, 2, 2), widget('b', 3, 2, 2), widget('c', 5, 2, 2), widget('wide', 1, 1, 6)], 'tablet', 6);
      expect(tiles.map(p => [p.widget.id, p.colSpan])).toEqual([['wide', 3], ['a', 1], ['b', 1], ['c', 1]]);
    });

    it('keeps two halves of a 6-column row side by side on tablets (AB#5558: CK models | Recently opened)', () => {
      const tiles = placeWidgetsForTier([widget('pie', 1, 4, 3, 2), widget('recents', 4, 4, 3, 2), widget('wide', 1, 1, 6, 2)], 'tablet', 6);
      expect(tiles.map(t => [t.widget.id, t.colSpan])).toEqual([['wide', 3], ['pie', 2], ['recents', 1]]);
      // A 5 + 1 row: 3 + 1 would wrap, so it shares as 2 + 1.
      const uneven = placeWidgetsForTier([widget('big', 1, 1, 5), widget('small', 6, 1, 1)], 'tablet', 6);
      expect(uneven.map(t => t.colSpan)).toEqual([2, 1]);
      // Rows that already fit and the phone tier are untouched.
      expect(placeWidgetsForTier([widget('a', 1, 1, 4), widget('b', 5, 1, 2)], 'tablet', 6).map(t => t.colSpan)).toEqual([2, 1]);
      expect(placeWidgetsForTier([widget('pie', 1, 4, 3), widget('recents', 4, 4, 3)], 'phone', 6).map(t => t.colSpan)).toEqual([1, 1]);
    });

    it('scales spans proportionally, at least 1 and at most the tier columns', () => {
      expect(scaleColSpan(1, 6, 3)).toBe(1);
      expect(scaleColSpan(3, 6, 3)).toBe(2);
      expect(scaleColSpan(5, 6, 3)).toBe(3);
      expect(scaleColSpan(6, 6, 3)).toBe(3);
      expect(scaleColSpan(4, 4, 3)).toBe(3);
      expect(scaleColSpan(2, 2, 2)).toBe(2);
      expect(scaleColSpan(3, 6, 1)).toBe(1);
    });

    it('grows content-sized tiles on the phone tier only (AB#5558)', () => {
      const widgets = [widget('attention', 1, 1, 6, 2), widget('kpi', 1, 3, 2, 1)];
      const sizing = { heights: new Map([['attention', 820]]), rowHeight: 200, gap: 16 };
      const phone = placeWidgetsForTier(widgets, 'phone', 6, sizing);
      expect(phone.find(p => p.widget.id === 'attention')!.rowSpan).toBe(5);
      expect(phone.find(p => p.widget.id === 'kpi')!.rowSpan).toBe(1);
      expect(placeWidgetsForTier(widgets, 'tablet', 6, sizing).find(p => p.widget.id === 'attention')!.rowSpan).toBe(2);
      expect(placeWidgetsForTier(widgets, 'none', 6, sizing).find(p => p.widget.id === 'attention')!.rowSpan).toBe(2);
      expect(widgets[0].rowSpan).toBe(2);
    });

    it('does not mutate the input widget configs', () => {
      const original = widget('a', 5, 1, 6, 1);
      placeWidgetsForTier([original], 'phone', 6);
      expect(original.col).toBe(5);
      expect(original.colSpan).toBe(6);
    });
  });
});

describe('collapseEmptyRows (AB#5558)', () => {
  it('moves widgets up over rows nobody occupies and keeps unchanged widgets', () => {
    const pie = { id: 'pie', row: 3, rowSpan: 2 };
    const top = { id: 'top', row: 1, rowSpan: 1 };
    expect(collapseEmptyRows([pie])).toEqual([{ id: 'pie', row: 1, rowSpan: 2 }]);
    const result = collapseEmptyRows([top, pie]);
    expect(result[0]).toBe(top);
    expect(result[1]).toEqual({ id: 'pie', row: 2, rowSpan: 2 });
    const tall = { id: 'tall', row: 1, rowSpan: 3 };
    expect(collapseEmptyRows([tall, { id: 'b', row: 3, rowSpan: 1 }])[1].row).toBe(3);
  });
});

describe('rowSpanForContent (AB#5558)', () => {
  it('fits content plus tile chrome into rows of rowHeight and gap', () => {
    // 2 rows = 416 px: 352 px of content plus chrome fit, one more px needs a third row.
    expect(rowSpanForContent(416 - TILE_CHROME_HEIGHT, 200, 16, 1)).toBe(2);
    expect(rowSpanForContent(417 - TILE_CHROME_HEIGHT, 200, 16, 1)).toBe(3);
  });

  it('never shrinks below the configured rows and caps the growth', () => {
    expect(rowSpanForContent(50, 200, 16, 2)).toBe(2);
    expect(rowSpanForContent(100_000, 200, 16, 2)).toBe(MAX_CONTENT_ROWS);
    expect(rowSpanForContent(0, 200, 16, 2)).toBe(2);
    expect(rowSpanForContent(500, 0, 16, 2)).toBe(2);
  });
});
