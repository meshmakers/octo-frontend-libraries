import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CronParserService } from '@meshmakers/shared-ui';
import { NotificationRecipientRefusedError, NotificationSubscriptionService } from './notification-subscription.service';
import { NOTIFICATION_RECIPIENT_CANDIDATES } from './notification-recipient-candidates.service';
import { CommunicationService } from '../services/communication.service';
import { NotificationsGetSubscriptionsDtoGQL } from '../graphQL/notificationsGetSubscriptions';
import { NotificationsGetSubscriptionDtoGQL } from '../graphQL/notificationsGetSubscription';
import { NotificationsGetRecipientsDtoGQL } from '../graphQL/notificationsGetRecipients';
import { NotificationsGetPreferenceDtoGQL } from '../graphQL/notificationsGetPreference';
import { NotificationsCreatePreferenceDtoGQL } from '../graphQL/notificationsCreatePreference';
import { NotificationsUpdatePreferenceDtoGQL } from '../graphQL/notificationsUpdatePreference';
import { NotificationsDeleteEntitiesDtoGQL } from '../graphQL/notificationsDeleteEntities';
import { NotificationsGetTemplateSubscriptionsDtoGQL } from '../graphQL/notificationsGetTemplateSubscriptions';
import { NotificationsGetQuerySampleDtoGQL } from '../graphQL/notificationsGetQuerySample';
import { DeleteStrategiesDto, FieldFilterOperatorsDto } from '../graphQL/globalTypes';

describe('NotificationSubscriptionService', () => {
  const fetch = (data: unknown) => vi.fn().mockReturnValue(of({ data }));
  const mutate = (data: unknown = {}) => vi.fn().mockReturnValue(of({ data }));
  const everyMinute = (_cron: string, count: number) =>
    Array.from({ length: count }, (_, index) => new Date(Date.UTC(2026, 9, 15) + index * 60_000));
  const users = [{ id: 'user-b', name: 'Bea', email: 'bea@example.com', label: 'bea@example.com (Bea)' }];
  let gql: Record<string, { fetch?: ReturnType<typeof vi.fn>; mutate?: ReturnType<typeof vi.fn> }>;
  let communication: { syncNotificationSchedule: ReturnType<typeof vi.fn> };
  let nextExecutions: (cron: string, count: number) => Date[];
  let loadCandidates: Mock<() => Promise<typeof users>>;

  function service(): NotificationSubscriptionService {
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsGetSubscriptionsDtoGQL, useValue: gql['subscriptions'] ?? {} },
        { provide: NotificationsGetSubscriptionDtoGQL, useValue: gql['subscription'] ?? {} },
        { provide: NotificationsGetRecipientsDtoGQL, useValue: gql['recipients'] ?? {} },
        { provide: NotificationsGetPreferenceDtoGQL, useValue: gql['preference'] ?? {} },
        { provide: NotificationsCreatePreferenceDtoGQL, useValue: gql['createPreference'] ?? {} },
        { provide: NotificationsUpdatePreferenceDtoGQL, useValue: gql['updatePreference'] ?? {} },
        { provide: NotificationsDeleteEntitiesDtoGQL, useValue: gql['delete'] ?? {} },
        { provide: NotificationsGetTemplateSubscriptionsDtoGQL, useValue: gql['templateSubscriptions'] ?? {} },
        { provide: NotificationsGetQuerySampleDtoGQL, useValue: gql['querySample'] ?? {} },
        { provide: CommunicationService, useValue: communication },
        { provide: CronParserService, useValue: { getNextExecutions: (cron: string, count: number) => nextExecutions(cron, count) } },
        { provide: NOTIFICATION_RECIPIENT_CANDIDATES, useValue: { load: () => loadCandidates() } }
      ]
    });
    return TestBed.inject(NotificationSubscriptionService);
  }

  beforeEach(() => {
    gql = {};
    communication = { syncNotificationSchedule: vi.fn().mockResolvedValue(undefined) };
    nextExecutions = everyMinute;
    loadCandidates = vi.fn().mockResolvedValue(users);
  });

  afterEach(() => TestBed.resetTestingModule());

  function recipients(state: Record<string, unknown> | null, subjectId = 'user-b', enabled = true) {
    return {
      runtime: {
        systemNotificationNotificationSubscription: {
          items: [{
            rtId: 's1',
            enabled,
            preferences: {
              totalCount: 1,
              items: [{
                rtId: 'p1',
                ckTypeId: 'System.Notification/NotificationPreference',
                subjectId,
                cronExpression: '0 * * * * *',
                timeZone: 'Europe/Vienna',
                deliveryState: { items: state ? [{ rtId: 'd1', ckTypeId: 'System.Notification/NotificationDeliveryState', ...state }] : [] }
              }]
            }
          }]
        }
      }
    };
  }

  const subscription = { rtId: 's1', ckTypeId: 'System.Notification/NotificationSubscription' };

  it('reads a delivery state recorded for another user as not run, so the recipient shows no last mail', async () => {
    gql['recipients'] = { fetch: fetch(recipients({ subjectId: 'user-a', lastRunAt: 'x', lastSentAt: 'y' })) };

    const page = await service().getRecipients('s1', { skip: 0, take: 10 });

    expect(page.items[0].lastSentAt).toBeNull();
    expect(page.items[0].status.health).toBe('NOT_RUN');
    expect(page.items[0].deliveryState).toEqual({ rtId: 'd1', ckTypeId: 'System.Notification/NotificationDeliveryState' });
  });

  it('labels a recipient with its user and reads its own delivery state', async () => {
    gql['recipients'] = { fetch: fetch(recipients({ subjectId: 'user-b', lastRunAt: 'x', lastSentAt: 'y' })) };

    const page = await service().getRecipients('s1', { skip: 0, take: 10 });

    expect(page.items[0]).toEqual(expect.objectContaining({ userLabel: 'bea@example.com (Bea)', lastSentAt: 'y' }));
    expect(page.items[0].status).toEqual({ active: true, health: 'OK', problem: null, detail: null });
  });

  it('reports a recipient whose user no longer exists', async () => {
    gql['recipients'] = { fetch: fetch(recipients(null, 'gone')) };

    const page = await service().getRecipients('s1', { skip: 0, take: 10 });

    expect(page.items[0].status.problem).toBe('USER_DELETED');
  });

  describe('users of the recipients', () => {
    function cachingService(): NotificationSubscriptionService {
      gql['recipients'] = { fetch: fetch(recipients(null)) };
      gql['preference'] = { fetch: fetch({ runtime: { systemNotificationNotificationPreference: { items: [
        recipients(null).runtime.systemNotificationNotificationSubscription.items[0].preferences.items[0]] } } }) };
      return service();
    }

    afterEach(() => vi.useRealTimers());

    it('loads the users of a tenant once for pages, searches and the edit form', async () => {
      const svc = cachingService();

      await svc.getRecipients('s1', { skip: 0, take: 10, tenantId: 't1' });
      await svc.getRecipients('s1', { skip: 10, take: 10, searchText: 'bea', tenantId: 't1' });
      const recipient = await svc.getRecipient('p1', true, 't1');

      expect(loadCandidates).toHaveBeenCalledTimes(1);
      expect(recipient?.user).toEqual(users[0]);
    });

    it('keeps the users of each tenant apart', async () => {
      const svc = cachingService();

      await svc.getRecipients('s1', { skip: 0, take: 10, tenantId: 't1' });
      await svc.getRecipients('s1', { skip: 0, take: 10, tenantId: 't2' });

      expect(loadCandidates).toHaveBeenCalledTimes(2);
    });

    it('loads them every time when the caller names no tenant', async () => {
      const svc = cachingService();

      await svc.getRecipients('s1', { skip: 0, take: 10 });
      await svc.getRecipients('s1', { skip: 0, take: 10 });

      expect(loadCandidates).toHaveBeenCalledTimes(2);
    });

    it('does not keep a failed load', async () => {
      const svc = cachingService();
      loadCandidates.mockRejectedValueOnce(new Error('identity down'));

      const failed = await svc.getRecipients('s1', { skip: 0, take: 10, tenantId: 't1' });
      await svc.getRecipients('s1', { skip: 0, take: 10, tenantId: 't1' });

      expect(failed.items[0].user).toBeNull();
      expect(loadCandidates).toHaveBeenCalledTimes(2);
    });

    it('loads them again after a minute, so new users show up', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const svc = cachingService();

      await svc.getRecipients('s1', { skip: 0, take: 10, tenantId: 't1' });
      vi.setSystemTime(Date.now() + 61_000);
      await svc.getRecipients('s1', { skip: 0, take: 10, tenantId: 't1' });

      expect(loadCandidates).toHaveBeenCalledTimes(2);
    });
  });

  it('searches recipients by the label of their user', async () => {
    gql['recipients'] = { fetch: fetch(recipients(null)) };
    const svc = service();

    await svc.getRecipients('s1', { skip: 0, take: 10, searchText: 'BEA@' });
    const none = await svc.getRecipients('s1', { skip: 0, take: 10, searchText: 'nobody' });

    expect(gql['recipients'].fetch!.mock.calls[0][0].variables.fieldFilter)
      .toEqual([{ attributePath: 'subjectId', operator: FieldFilterOperatorsDto.InDto, comparisonValue: ['user-b'] }]);
    expect(gql['recipients'].fetch).toHaveBeenCalledTimes(1);
    expect(none.items).toEqual([]);
  });

  it('adds a recipient that first gets the current rows, then syncs its schedule', async () => {
    gql['recipients'] = { fetch: fetch({ runtime: { systemNotificationNotificationSubscription: { items: [{ preferences: { items: [] } }] } } }) };
    const create = mutate({ runtime: { systemNotificationNotificationPreferences: { create: [{ rtId: 'p9' }] } } });
    gql['createPreference'] = { mutate: create };

    const result = await service().addRecipient('t1', subscription, { subjectId: 'user-b', cronExpression: '0 0 7 * * *', timeZone: 'UTC' });

    expect(result).toEqual({ rtId: 'p9', scheduleSyncError: null });
    expect(create.mock.calls[0][0].variables.entities[0]).toEqual(expect.objectContaining({ subjectId: 'user-b', skipExistingRows: false }));
    expect(communication.syncNotificationSchedule).toHaveBeenCalledWith('t1', 'p9');
  });

  it('refuses a user who already is a recipient, and a schedule the server would not run', async () => {
    gql['recipients'] = { fetch: fetch(recipients(null)) };
    gql['createPreference'] = { mutate: mutate() };
    const svc = service();

    await expect(svc.addRecipient('t1', subscription, { subjectId: 'user-b', cronExpression: '0 0 7 * * *', timeZone: 'UTC' }))
      .rejects.toEqual(new NotificationRecipientRefusedError('DUPLICATE', 'p1'));
    nextExecutions = () => [];
    await expect(svc.addRecipient('t1', subscription, { subjectId: 'user-c', cronExpression: '0 0 0 31 2 *', timeZone: 'UTC' }))
      .rejects.toHaveProperty('reason', 'INVALID');
    expect(gql['createPreference'].mutate).not.toHaveBeenCalled();
  });

  it('changes only the schedule and time zone of a recipient, and reports a failed sync instead of throwing', async () => {
    const update = mutate();
    gql['updatePreference'] = { mutate: update };
    const failure = new Error('controller down');
    communication.syncNotificationSchedule.mockRejectedValue(failure);

    const result = await service().updateRecipient('t1', 'p1', { cronExpression: '0 0 7 * * *', timeZone: 'UTC' });

    expect(update.mock.calls[0][0].variables.entities[0].item).toEqual({ cronExpression: '0 0 7 * * *', timeZone: 'UTC' });
    expect(result).toEqual({ rtId: 'p1', scheduleSyncError: failure });
  });

  it('deletes recipients, erases their delivery states and syncs their schedules', async () => {
    const remove = mutate();
    gql['delete'] = { mutate: remove };

    const result = await service().deleteRecipients('t1', [{ rtId: 'p1', ckTypeId: 'P', deliveryState: { rtId: 'd1', ckTypeId: 'D' } }]);

    expect(result).toEqual({ deliveryStateError: null, scheduleSyncError: null });
    expect(remove.mock.calls[0][0].variables).toEqual({ rtEntityIds: [{ rtId: 'p1', ckTypeId: 'P' }] });
    expect(remove.mock.calls[1][0].variables).toEqual({ rtEntityIds: [{ rtId: 'd1', ckTypeId: 'D' }], options: DeleteStrategiesDto.EraseDto });
    expect(communication.syncNotificationSchedule).toHaveBeenCalledWith('t1', 'p1');
  });

  it('reports delivery states that could not be erased, and fails when the recipients cannot be deleted', async () => {
    const failure = new Error('erase failed');
    gql['delete'] = { mutate: vi.fn().mockReturnValueOnce(of({ data: {} })).mockReturnValueOnce(throwError(() => failure)) };
    const svc = service();
    const recipient = { rtId: 'p1', ckTypeId: 'P', deliveryState: { rtId: 'd1', ckTypeId: 'D' } };

    await expect(svc.deleteRecipients('t1', [recipient])).resolves.toEqual({ deliveryStateError: failure, scheduleSyncError: null });

    gql['delete'].mutate!.mockReturnValueOnce(throwError(() => new Error('delete failed')));
    await expect(svc.deleteRecipients('t1', [recipient])).rejects.toThrow(/^delete failed$/);
  });

  it('lists the subscriptions using a template with the columns of their query', async () => {
    gql['templateSubscriptions'] = {
      fetch: fetch({
        runtime: {
          systemNotificationNotificationTemplate: {
            items: [{
              rtId: 't1',
              subscriptions: {
                items: [
                  { rtId: 's1', ckTypeId: 'System.Notification/NotificationSubscription', name: 'Failed EDA', query: { items: [{ rtId: 'q1', columns: ['name', null, 'info'] }] } },
                  { rtId: 's2', ckTypeId: 'System.Notification/NotificationSubscription', name: 'No query', query: { items: [] } },
                  null
                ]
              }
            }]
          }
        }
      })
    };

    const subscriptions = await service().getTemplateSubscriptions('t1');

    expect(subscriptions).toEqual([
      { rtId: 's1', ckTypeId: 'System.Notification/NotificationSubscription', name: 'Failed EDA', queryRtId: 'q1', queryColumns: ['name', 'info'] },
      { rtId: 's2', ckTypeId: 'System.Notification/NotificationSubscription', name: 'No query', queryRtId: null, queryColumns: null }
    ]);
  });
});
