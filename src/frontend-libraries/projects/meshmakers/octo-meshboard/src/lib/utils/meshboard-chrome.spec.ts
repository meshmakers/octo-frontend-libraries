import { isMeshBoardChrome, resolveMeshBoardChrome } from './meshboard-chrome';

describe('meshboard-chrome', () => {
  it('recognises the two chromes only', () => {
    expect(isMeshBoardChrome('framed')).toBe(true);
    expect(isMeshBoardChrome('plain')).toBe(true);
    expect(isMeshBoardChrome('none')).toBe(false);
    expect(isMeshBoardChrome(undefined)).toBe(false);
    expect(isMeshBoardChrome(false)).toBe(false);
  });

  it('defaults to framed', () => {
    expect(resolveMeshBoardChrome(undefined, undefined)).toBe('framed');
  });

  it('uses the route data when no input is bound', () => {
    expect(resolveMeshBoardChrome(undefined, 'plain')).toBe('plain');
  });

  it('lets the bound input win over the route data', () => {
    expect(resolveMeshBoardChrome('framed', 'plain')).toBe('framed');
  });

  it('ignores unknown values', () => {
    expect(resolveMeshBoardChrome('bogus', 'plain')).toBe('plain');
    expect(resolveMeshBoardChrome('bogus', 'bogus')).toBe('framed');
  });
});
