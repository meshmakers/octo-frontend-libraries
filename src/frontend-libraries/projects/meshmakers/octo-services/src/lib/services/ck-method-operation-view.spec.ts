import { CkMethodOperationItem } from './ck-method-operation.service';
import { CkMethodOperationTextRegistry, ckMethodOperationLabel, notAvailableOperationView, toOperationProgressView } from './ck-method-operation-view';
import { CkMethodOperationStateDto } from '../graphQL/globalTypes';

describe('toOperationProgressView (AB#8448)', () => {
  const DUMP = 'System.Bot/TenantRepository.Dump-1';
  const registry: CkMethodOperationTextRegistry = {
    [DUMP]: {
      methodLabel: 'Tenant backup',
      stage: code => (code === 'DUMPING_DATABASE' ? 'Dumping the database …' : null),
      error: (code, p) => (code === 'DUMP_FAILED' && p['reason'] === 'another-dump-running' ? 'Another backup is running.' : null)
    }
  };
  const op = (state: CkMethodOperationStateDto, extra: Partial<CkMethodOperationItem> = {}): CkMethodOperationItem => ({
    operationId: 'op-1', methodId: DUMP, invocationId: 'inv', state,
    acceptedAtUtc: '2026-11-14T06:29:12Z', startedAtUtc: '2026-11-14T06:29:13Z',
    progress: null, result: null, error: null, ...extra
  });

  it('maps a running operation without a percentage to an indeterminate view', () => {
    const view = toOperationProgressView(op(CkMethodOperationStateDto.AcceptedDto), registry);
    expect(view).toEqual(expect.objectContaining({ status: 'running', methodLabel: 'Tenant backup', percent: null }));
    expect(view.startedAt).toBe('2026-11-14T06:29:13Z');
  });

  it('maps the reported percentage and the stage text; an unknown stage shows its code', () => {
    const running = op(CkMethodOperationStateDto.RunningDto, { progress: { percent: 40, stageCode: 'DUMPING_DATABASE', parameters: [] } });
    expect(toOperationProgressView(running, registry)).toEqual(expect.objectContaining({ percent: 40, stageText: 'Dumping the database …' }));
    const unknownStage = op(CkMethodOperationStateDto.RunningDto, { progress: { percent: null, stageCode: 'NEW_STAGE', parameters: [] } });
    expect(toOperationProgressView(unknownStage, registry).stageText).toBe('NEW_STAGE');
  });

  it('maps a succeeded operation to 100 % with the expiry date and the download offer', () => {
    const succeeded = op(CkMethodOperationStateDto.SucceededDto, {
      progress: { percent: 80, stageCode: 'STORING_ARTIFACT', parameters: [] },
      completedAtUtc: '2026-11-14T06:30:00Z', expiresAtUtc: '2026-11-21T06:30:00Z'
    });
    const view = toOperationProgressView(succeeded, registry, { canDownload: true, canStartNew: true });
    expect(view).toEqual(expect.objectContaining({
      status: 'succeeded', percent: 100, expiresAt: '2026-11-21T06:30:00Z', canDownload: true, canStartNew: false, stageText: null
    }));
  });

  it('maps a lost handler to outcomeUnknown, not to a generic failure', () => {
    const lost = op(CkMethodOperationStateDto.FailedDto, {
      error: { code: 'METHOD_OUTCOME_UNKNOWN', parameters: [{ name: 'reason', value: 'handler-lost' }], details: [] }
    });
    const view = toOperationProgressView(lost, registry, { canStartNew: true });
    expect(view).toEqual(expect.objectContaining({ status: 'outcomeUnknown', canStartNew: true, errorCode: null }));
  });

  it('maps any other failure to failed with code and text', () => {
    const failed = op(CkMethodOperationStateDto.FailedDto, {
      error: { code: 'DUMP_FAILED', parameters: [{ name: 'reason', value: 'another-dump-running' }], details: [] }
    });
    expect(toOperationProgressView(failed, registry)).toEqual(expect.objectContaining({
      status: 'failed', errorCode: 'DUMP_FAILED', errorMessage: 'Another backup is running.', canDownload: false
    }));
  });

  it('falls back to the method id for a method without texts', () => {
    expect(ckMethodOperationLabel('Other/Type.Method-1', registry)).toBe('Other/Type.Method-1');
    expect(toOperationProgressView({ ...op(CkMethodOperationStateDto.RunningDto), methodId: 'Other/Type.Method-1' }, registry).methodLabel)
      .toBe('Other/Type.Method-1');
  });

  it('builds the not-available view', () => {
    expect(notAvailableOperationView('Tenant backup')).toEqual({ status: 'notAvailable', methodLabel: 'Tenant backup' });
  });
});
