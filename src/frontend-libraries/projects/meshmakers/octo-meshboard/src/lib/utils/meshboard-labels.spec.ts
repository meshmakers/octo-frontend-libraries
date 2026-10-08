import { resolveMeshBoardLabel, MeshBoardLabelRequest } from './meshboard-labels';

describe('resolveMeshBoardLabel (AB#5622)', () => {
  const request: MeshBoardLabelRequest = { kind: 'chartCategory', attribute: 'paymentState', value: 'PAID', defaultText: 'Paid' };

  it('returns the default text without a resolver', () => {
    expect(resolveMeshBoardLabel(null, request)).toBe('Paid');
  });

  it('returns the resolver text and passes the request through', () => {
    const resolver = vi.fn().mockReturnValue('Bezahlt');
    expect(resolveMeshBoardLabel(resolver, request)).toBe('Bezahlt');
    expect(resolver).toHaveBeenCalledWith(request);
  });

  it('keeps the default for null, undefined and empty answers', () => {
    expect(resolveMeshBoardLabel(() => null, request)).toBe('Paid');
    expect(resolveMeshBoardLabel(() => undefined, request)).toBe('Paid');
    expect(resolveMeshBoardLabel(() => '', request)).toBe('Paid');
  });

  it('falls back to the default when the resolver throws and warns only once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resolver = () => { throw new Error('boom'); };
    expect(resolveMeshBoardLabel(resolver, request)).toBe('Paid');
    expect(resolveMeshBoardLabel(resolver, request)).toBe('Paid');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
