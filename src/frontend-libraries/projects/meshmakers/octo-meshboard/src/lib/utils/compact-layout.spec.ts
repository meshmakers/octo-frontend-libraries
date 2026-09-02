import { compactTierForWidth, columnsForTier, placeWidgetsForTier } from './compact-layout';
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

    it('clamps colSpan to the tier column count and preserves rowSpan', () => {
      const phone = placeWidgetsForTier([widget('a', 1, 1, 4, 2)], 'phone', 6);
      expect(phone[0].colSpan).toBe(1);
      expect(phone[0].rowSpan).toBe(2);

      const tablet = placeWidgetsForTier([widget('a', 1, 1, 4, 2)], 'tablet', 6);
      expect(tablet[0].colSpan).toBe(3);
    });

    it('does not mutate the input widget configs', () => {
      const original = widget('a', 5, 1, 6, 1);
      placeWidgetsForTier([original], 'phone', 6);
      expect(original.col).toBe(5);
      expect(original.colSpan).toBe(6);
    });
  });
});
