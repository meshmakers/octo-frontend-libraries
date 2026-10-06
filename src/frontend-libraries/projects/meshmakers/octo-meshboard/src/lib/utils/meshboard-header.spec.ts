import { isMeshBoardHeaderMode, resolveMeshBoardHeaderMode } from './meshboard-header';

describe('meshboard-header', () => {
  it('recognises the three modes only', () => {
    expect(isMeshBoardHeaderMode('full')).toBe(true);
    expect(isMeshBoardHeaderMode('compact')).toBe(true);
    expect(isMeshBoardHeaderMode('none')).toBe(true);
    expect(isMeshBoardHeaderMode('hidden')).toBe(false);
    expect(isMeshBoardHeaderMode(undefined)).toBe(false);
    expect(isMeshBoardHeaderMode(true)).toBe(false);
  });

  it('defaults to full', () => {
    expect(resolveMeshBoardHeaderMode(undefined, undefined)).toBe('full');
  });

  it('uses the route data when no input is bound', () => {
    expect(resolveMeshBoardHeaderMode(undefined, 'compact')).toBe('compact');
  });

  it('lets the bound input win over the route data', () => {
    expect(resolveMeshBoardHeaderMode('none', 'compact')).toBe('none');
    expect(resolveMeshBoardHeaderMode('full', 'compact')).toBe('full');
  });

  it('ignores unknown values', () => {
    expect(resolveMeshBoardHeaderMode('bogus', 'compact')).toBe('compact');
    expect(resolveMeshBoardHeaderMode('bogus', 'bogus')).toBe('full');
  });
});
