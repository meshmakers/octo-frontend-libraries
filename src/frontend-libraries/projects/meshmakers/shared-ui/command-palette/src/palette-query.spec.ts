import { isRtId, parsePaletteQuery } from './palette-query';

describe('parsePaletteQuery', () => {
  it('returns an unscoped query for plain text', () => {
    expect(parsePaletteQuery('  edge plc ')).toEqual({ raw: '  edge plc ', prefix: null, scope: null, text: 'edge plc' });
  });

  it.each([
    ['>theme', '>', 'action', 'theme'],
    ['@ edge', '@', 'entity', 'edge'],
    ['#plant', '#', 'board', 'plant'],
    ['/meshtest', '/', 'tenant', 'meshtest'],
    ['? why offline', '?', 'ai', 'why offline']
  ])('maps %s to its group', (raw, prefix, scope, text) => {
    expect(parsePaletteQuery(raw)).toEqual({ raw, prefix, scope, text });
  });

  it('scopes with an empty text when only the prefix is typed', () => {
    expect(parsePaletteQuery('#')).toMatchObject({ scope: 'board', text: '' });
  });

  it('only treats the first character as prefix', () => {
    expect(parsePaletteQuery('edge > plc')).toMatchObject({ scope: null, text: 'edge > plc' });
  });

  it('handles an empty input', () => {
    expect(parsePaletteQuery('')).toEqual({ raw: '', prefix: null, scope: null, text: '' });
  });
});

describe('isRtId', () => {
  it('accepts 24 hex characters in any case', () => {
    expect(isRtId('65d5c447b420da3fb12381bc')).toBe(true);
    expect(isRtId('65D5C447B420DA3FB12381BC')).toBe(true);
  });

  it('rejects other strings', () => {
    expect(isRtId('65d5c447b420da3fb12381b')).toBe(false);
    expect(isRtId('65d5c447b420da3fb12381bz')).toBe(false);
    expect(isRtId('adapter')).toBe(false);
  });
});
