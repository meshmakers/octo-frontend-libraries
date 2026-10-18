import { CkModelLibraryStatusItemDto, CkUpgradeBlockerDto } from './ck-model-catalog.dto';
import {
  ckBlockersOf, ckFirstBlockerReason, isCkBlocked, isCkUpgradeBlockedGraphQlError, parseCkUpgradeBlockedError,
  parseCkUpgradeBlockedGraphQlError
} from './ck-upgrade-blockers';

const blocker = (over: Partial<CkUpgradeBlockerDto> = {}): CkUpgradeBlockerDto => ({
  dependent: 'EnergyCommunity.Registration-2.8.0',
  update: 'Basic-2.5.0',
  kind: 'ExactPin',
  subject: 'Basic-2.4.0',
  code: 'CK_UPGRADE_EXACT_PIN',
  message: 'EnergyCommunity.Registration 2.8.0 would break: exact pin Basic-2.4.0: Basic-2.5.0 replaces it',
  ...over
});

describe('ck-upgrade-blockers (AB#6872)', () => {
  describe('older asset repository without the members', () => {
    it('is not blocked and has no blockers', () => {
      // The old DTO shape: none of the guard members is sent.
      const oldItem: CkModelLibraryStatusItemDto = {
        name: 'Basic', installedVersion: '2.4.0', dependencies: [], catalogVersion: '2.5.0', hasUpdate: true,
        needsAction: true, isServiceManaged: false, isCompatible: true, unresolvedDependencies: [],
        hasCatalogInconsistency: false
      };
      expect(isCkBlocked(oldItem)).toBe(false);
      expect(ckBlockersOf(oldItem)).toEqual([]);
      expect(ckFirstBlockerReason(oldItem)).toBeNull();
    });

    it('tolerates null and undefined sources and null blockers', () => {
      expect(isCkBlocked(null)).toBe(false);
      expect(isCkBlocked(undefined)).toBe(false);
      expect(ckBlockersOf({ blockers: null })).toEqual([]);
    });
  });

  describe('blocked sources', () => {
    it('is blocked by the flag alone, with a generic reason', () => {
      expect(isCkBlocked({ isBlocked: true })).toBe(true);
      expect(ckFirstBlockerReason({ isBlocked: true })).toBe('The update would break an installed model.');
    });

    it('is blocked by a blocker alone', () => {
      expect(isCkBlocked({ blockers: [blocker()] })).toBe(true);
    });

    it('uses the first blocker message and appends the resolve hint', () => {
      const reason = ckFirstBlockerReason({
        isBlocked: true,
        blockers: [blocker({ resolveHint: 'update EnergyCommunity.Registration to 2.10.0 first' }), blocker({ message: 'second' })]
      });
      expect(reason).toBe(
        'EnergyCommunity.Registration 2.8.0 would break: exact pin Basic-2.4.0: Basic-2.5.0 replaces it (update EnergyCommunity.Registration to 2.10.0 first)');
    });

    it('falls back to dependent, kind and subject when the message is empty', () => {
      expect(ckFirstBlockerReason({ blockers: [blocker({ message: '' })] }))
        .toBe('EnergyCommunity.Registration-2.8.0 would break (ExactPin: Basic-2.4.0)');
    });
  });

  describe('parseCkUpgradeBlockedError', () => {
    const http409 = (body: unknown) => ({ name: 'HttpErrorResponse', status: 409, error: body });

    it('reads the problem details of a CK_UPGRADE_BLOCKED refusal', () => {
      const problem = parseCkUpgradeBlockedError(http409({
        type: 'https://schemas.meshmakers.cloud/errors/ck-upgrade-blocked',
        status: 409,
        detail: 'Importing Basic-2.5.0 would break 1 installed model(s)',
        code: 'CK_UPGRADE_BLOCKED',
        updateSet: ['Basic-2.5.0'],
        blockers: [blocker()]
      }));
      expect(problem?.code).toBe('CK_UPGRADE_BLOCKED');
      expect(problem?.updateSet).toEqual(['Basic-2.5.0']);
      expect(problem?.blockers?.[0].dependent).toBe('EnergyCommunity.Registration-2.8.0');
    });

    it('answers an empty blockers list when the body carries none', () => {
      expect(parseCkUpgradeBlockedError(http409({ code: 'CK_UPGRADE_BLOCKED' }))?.blockers).toEqual([]);
    });

    it('ignores every other error', () => {
      expect(parseCkUpgradeBlockedError(http409({ message: 'conflict' }))).toBeNull();
      expect(parseCkUpgradeBlockedError({ status: 400, error: { code: 'CK_UPGRADE_BLOCKED' } })).toBeNull();
      expect(parseCkUpgradeBlockedError(http409('plain text'))).toBeNull();
      expect(parseCkUpgradeBlockedError(new Error('boom'))).toBeNull();
      expect(parseCkUpgradeBlockedError(null)).toBeNull();
    });
  });
});

describe('parseCkUpgradeBlockedGraphQlError (AB#6903)', () => {
  const refusal = (extensions: Record<string, unknown>, message = 'Blueprint update refused') => ({ message, extensions });
  const data = { updateSet: ['Basic-2.5.0'], blockers: [blocker()] };

  it('reads the blockers and update set of a CombinedGraphQLErrors-like error', () => {
    const problem = parseCkUpgradeBlockedGraphQlError({ errors: [refusal({ code: 'CK_UPGRADE_BLOCKED', data })] });
    expect(problem?.code).toBe('CK_UPGRADE_BLOCKED');
    expect(problem?.detail).toBe('Blueprint update refused');
    expect(problem?.updateSet).toEqual(['Basic-2.5.0']);
    expect(problem?.blockers).toEqual([blocker()]);
  });

  it('accepts graphQLErrors, a raw array and a single error', () => {
    const entry = refusal({ code: 'CK_UPGRADE_BLOCKED', data });
    expect(parseCkUpgradeBlockedGraphQlError({ graphQLErrors: [entry] })?.blockers?.length).toBe(1);
    expect(parseCkUpgradeBlockedGraphQlError([entry])?.blockers?.length).toBe(1);
    expect(parseCkUpgradeBlockedGraphQlError(entry)?.blockers?.length).toBe(1);
  });

  it('finds the refusal among other errors and reads members placed directly under extensions', () => {
    const problem = parseCkUpgradeBlockedGraphQlError({
      errors: [refusal({ code: 'OPERATION_FAILED' }), refusal({ code: 'CK_UPGRADE_BLOCKED', ...data })]
    });
    expect(problem?.blockers).toEqual([blocker()]);
    expect(isCkUpgradeBlockedGraphQlError([refusal({ code: 'CK_UPGRADE_BLOCKED' })])).toBe(true);
  });

  it('yields an empty blocker list when the refusal carries no data', () => {
    const problem = parseCkUpgradeBlockedGraphQlError([refusal({ code: 'CK_UPGRADE_BLOCKED' })]);
    expect(problem?.blockers).toEqual([]);
    expect(problem?.updateSet).toBeUndefined();
  });

  it('returns null for unrelated errors and unusable input', () => {
    expect(parseCkUpgradeBlockedGraphQlError([refusal({ code: 'OPERATION_FAILED', data })])).toBeNull();
    expect(parseCkUpgradeBlockedGraphQlError({ errors: [{ message: 'x' }] })).toBeNull();
    expect(parseCkUpgradeBlockedGraphQlError(new Error('network'))).toBeNull();
    expect(parseCkUpgradeBlockedGraphQlError({ status: 409, error: { code: 'CK_UPGRADE_BLOCKED' } })).toBeNull();
    expect(parseCkUpgradeBlockedGraphQlError(null)).toBeNull();
    expect(parseCkUpgradeBlockedGraphQlError('CK_UPGRADE_BLOCKED')).toBeNull();
    expect(isCkUpgradeBlockedGraphQlError(undefined)).toBe(false);
  });
});
