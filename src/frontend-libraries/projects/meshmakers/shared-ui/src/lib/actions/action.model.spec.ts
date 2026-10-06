import {
  MM_ACTION_ICONS,
  MmAction,
  actionAccessibleName,
  actionTooltip,
  isActionDisabled,
  splitRowActions,
} from './action.model';

const a = (id: string, extra: Partial<MmAction> = {}): MmAction => ({id, label: id, ...extra});

describe('action.model', () => {
  it('treats only a non-blank reason as disabled', () => {
    expect(isActionDisabled(a('x'))).toBe(false);
    expect(isActionDisabled(a('x', {disabledReason: null}))).toBe(false);
    expect(isActionDisabled(a('x', {disabledReason: '  '}))).toBe(false);
    expect(isActionDisabled(a('x', {disabledReason: 'No role'}))).toBe(true);
  });

  it('builds the accessible name from label and target', () => {
    expect(actionAccessibleName(a('x', {label: 'Delete dump'}), 'Encrypt run 2026-10-06')).toBe('Delete dump Encrypt run 2026-10-06');
    expect(actionAccessibleName(a('x', {label: 'Refresh'}))).toBe('Refresh');
  });

  it('adds the disabled reason to the tooltip', () => {
    expect(actionTooltip(a('x', {label: 'Delete'}))).toBe('Delete');
    expect(actionTooltip(a('x', {label: 'Delete', disabledReason: 'Requires SecretManagement'}))).toBe('Delete — Requires SecretManagement');
  });

  describe('splitRowActions', () => {
    it('keeps up to three actions inline', () => {
      const split = splitRowActions([a('1'), a('2'), a('3')]);
      expect(split.inline.map((x) => x.id)).toEqual(['1', '2', '3']);
      expect(split.menu).toEqual([]);
    });

    it('turns the third slot into the overflow menu when more than three are visible', () => {
      const split = splitRowActions([a('1'), a('2'), a('3'), a('4')]);
      expect(split.inline.map((x) => x.id)).toEqual(['1', '2']);
      expect(split.menu.map((x) => x.id)).toEqual(['3', '4']);
    });

    it('ignores hidden actions', () => {
      const split = splitRowActions([a('1'), a('2', {visible: false}), a('3'), a('4')]);
      expect(split.inline.map((x) => x.id)).toEqual(['1', '3', '4']);
      expect(split.menu).toEqual([]);
    });

    it('always puts overflow actions into the menu', () => {
      const split = splitRowActions([a('1'), a('del', {overflow: true})]);
      expect(split.inline.map((x) => x.id)).toEqual(['1']);
      expect(split.menu.map((x) => x.id)).toEqual(['del']);
    });

    it('honours a custom slot count', () => {
      const split = splitRowActions([a('1'), a('2')], 1);
      expect(split.inline).toEqual([]);
      expect(split.menu.map((x) => x.id)).toEqual(['1', '2']);
    });
  });

  it('maps every canonical verb to an icon', () => {
    expect(MM_ACTION_ICONS.edit.name).toBe('pencil');
    expect(MM_ACTION_ICONS.delete.name).toBe('trash');
    expect(MM_ACTION_ICONS.refresh.name).toBe('arrow-rotate-cw');
    expect(new Set(Object.values(MM_ACTION_ICONS).map((i) => i.name)).size).toBe(Object.keys(MM_ACTION_ICONS).length);
  });
});
