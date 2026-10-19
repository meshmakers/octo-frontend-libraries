import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NotificationSubscriptionService } from './notification-subscription.service';
import { NotificationsGetSubscriptionsDtoGQL } from '../graphQL/notificationsGetSubscriptions';
import { NotificationsGetSubscriptionDtoGQL } from '../graphQL/notificationsGetSubscription';
import { NotificationsGetRecipientsDtoGQL } from '../graphQL/notificationsGetRecipients';
import { NotificationsGetPreferenceDtoGQL } from '../graphQL/notificationsGetPreference';
import { NotificationsCreateSubscriptionDtoGQL } from '../graphQL/notificationsCreateSubscription';
import { NotificationsUpdateSubscriptionDtoGQL } from '../graphQL/notificationsUpdateSubscription';
import { NotificationsCreatePreferenceDtoGQL } from '../graphQL/notificationsCreatePreference';
import { NotificationsUpdatePreferenceDtoGQL } from '../graphQL/notificationsUpdatePreference';
import { NotificationsDeleteEntitiesDtoGQL } from '../graphQL/notificationsDeleteEntities';
import { NotificationsGetQueriesDtoGQL } from '../graphQL/notificationsGetQueries';
import { NotificationsGetEmailTemplatesDtoGQL } from '../graphQL/notificationsGetEmailTemplates';
import { NotificationsGetPlaceholderSourcesDtoGQL } from '../graphQL/notificationsGetPlaceholderSources';
import { NotificationsGetTemplateSubscriptionsDtoGQL } from '../graphQL/notificationsGetTemplateSubscriptions';
import { NotificationsGetQuerySampleDtoGQL } from '../graphQL/notificationsGetQuerySample';
import { AssociationModOptionsDto, DeleteStrategiesDto } from '../graphQL/globalTypes';

describe('NotificationSubscriptionService', () => {
  const fetch = (data: unknown) => vi.fn().mockReturnValue(of({ data }));
  const mutate = () => vi.fn().mockReturnValue(of({ data: {} }));
  let gql: Record<string, { fetch?: ReturnType<typeof vi.fn>; mutate?: ReturnType<typeof vi.fn> }>;

  function service(): NotificationSubscriptionService {
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsGetSubscriptionsDtoGQL, useValue: gql['subscriptions'] ?? {} },
        { provide: NotificationsGetSubscriptionDtoGQL, useValue: gql['subscription'] ?? {} },
        { provide: NotificationsGetRecipientsDtoGQL, useValue: gql['recipients'] ?? {} },
        { provide: NotificationsGetPreferenceDtoGQL, useValue: gql['preference'] ?? {} },
        { provide: NotificationsCreateSubscriptionDtoGQL, useValue: gql['createSubscription'] ?? {} },
        { provide: NotificationsUpdateSubscriptionDtoGQL, useValue: gql['updateSubscription'] ?? {} },
        { provide: NotificationsCreatePreferenceDtoGQL, useValue: gql['createPreference'] ?? {} },
        { provide: NotificationsUpdatePreferenceDtoGQL, useValue: gql['updatePreference'] ?? {} },
        { provide: NotificationsDeleteEntitiesDtoGQL, useValue: gql['delete'] ?? {} },
        { provide: NotificationsGetQueriesDtoGQL, useValue: gql['queries'] ?? {} },
        { provide: NotificationsGetEmailTemplatesDtoGQL, useValue: gql['templates'] ?? {} },
        { provide: NotificationsGetPlaceholderSourcesDtoGQL, useValue: gql['placeholders'] ?? {} },
        { provide: NotificationsGetTemplateSubscriptionsDtoGQL, useValue: gql['templateSubscriptions'] ?? {} },
        { provide: NotificationsGetQuerySampleDtoGQL, useValue: gql['querySample'] ?? {} }
      ]
    });
    return TestBed.inject(NotificationSubscriptionService);
  }

  beforeEach(() => {
    gql = {};
  });

  afterEach(() => TestBed.resetTestingModule());

  function recipients(state: Record<string, unknown> | null, enabled = true) {
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
                subjectId: 'user-b',
                cronExpression: '0 * * * * *',
                skipExistingRows: true,
                timeZone: 'Europe/Vienna',
                deliveryState: { items: state ? [{ rtId: 'd1', ckTypeId: 'System.Notification/NotificationDeliveryState', ...state }] : [] }
              }]
            }
          }]
        }
      }
    };
  }

  it('reads a delivery state recorded for another user as not run, so a new user shows no last mail', async () => {
    gql['recipients'] = { fetch: fetch(recipients({ subjectId: 'user-a', lastRunAt: 'x', lastSentAt: 'y', lastError: null })) };

    const page = await service().getRecipients('s1', { skip: 0, take: 10 });

    expect(page.subscriptionDeployed).toBe(true);
    expect(page.items[0].deliveryState).toEqual(expect.objectContaining({ lastRunAt: null, lastSentAt: null }));
  });

  it('keeps the delivery state of the same user', async () => {
    gql['recipients'] = { fetch: fetch(recipients({ subjectId: 'user-b', lastRunAt: 'x', lastSentAt: 'y' })) };

    const page = await service().getRecipients('s1', { skip: 0, take: 10 });

    expect(page.items[0].deliveryState).toEqual(expect.objectContaining({ lastRunAt: 'x', lastSentAt: 'y' }));
  });

  it('creates a subscription undeployed, with its query and template', async () => {
    const create = mutate();
    gql['createSubscription'] = { mutate: create };
    const query = { rtId: 'q1', ckTypeId: 'System/SimpleRtQuery', name: 'Failed' };

    await service().createSubscription({ name: 'n', description: '', query, template: null });

    const entity = create.mock.calls[0][0].variables.entities[0];
    expect(entity.enabled).toBe(false);
    expect(entity.description).toBeNull();
    expect(entity.query).toEqual([{ modOption: AssociationModOptionsDto.CreateDto, target: { rtId: 'q1', ckTypeId: 'System/SimpleRtQuery' } }]);
    expect(entity.template).toBeUndefined();
  });

  it('replaces only the association that changed', async () => {
    const update = mutate();
    gql['updateSubscription'] = { mutate: update };
    const oldQuery = { rtId: 'q1', ckTypeId: 'System/SimpleRtQuery', name: 'A' };
    const newQuery = { rtId: 'q2', ckTypeId: 'System/SimpleRtQuery', name: 'B' };
    const template = { rtId: 't1', ckTypeId: 'System.Notification/NotificationTemplate', name: 'T' };

    await service().updateSubscription('s1', { name: 'n', description: null, query: newQuery, template },
      { query: oldQuery, template });

    const item = update.mock.calls[0][0].variables.entities[0].item;
    expect(item.query).toEqual([
      { modOption: AssociationModOptionsDto.DeleteDto, target: { rtId: 'q1', ckTypeId: 'System/SimpleRtQuery' } },
      { modOption: AssociationModOptionsDto.CreateDto, target: { rtId: 'q2', ckTypeId: 'System/SimpleRtQuery' } }
    ]);
    expect(item.template).toBeUndefined();
  });

  it('writes the user of a recipient only when it is given', async () => {
    const update = mutate();
    gql['updatePreference'] = { mutate: update };

    const svc = service();
    await svc.updateRecipient('p1', { cronExpression: 'c', skipExistingRows: false, timeZone: 'UTC' });
    await svc.updateRecipient('p1', { subjectId: 'u2', cronExpression: 'c', skipExistingRows: false, timeZone: 'UTC' });

    expect(update.mock.calls[0][0].variables.entities[0].item).not.toHaveProperty('subjectId');
    expect(update.mock.calls[1][0].variables.entities[0].item.subjectId).toBe('u2');
  });

  it('archives first and erases the delivery states afterwards', async () => {
    const remove = mutate();
    gql['delete'] = { mutate: remove };

    const result = await service().deleteWithDeliveryStates([{ rtId: 'p1', ckTypeId: 'P' }], [{ rtId: 'd1', ckTypeId: 'D' }]);

    expect(result.deliveryStatesErased).toBe(true);
    expect(remove.mock.calls[0][0].variables).toEqual({ rtEntityIds: [{ rtId: 'p1', ckTypeId: 'P' }] });
    expect(remove.mock.calls[1][0].variables).toEqual({ rtEntityIds: [{ rtId: 'd1', ckTypeId: 'D' }], options: DeleteStrategiesDto.EraseDto });
  });

  it('reports delivery states that could not be erased, and fails when the archive fails', async () => {
    const failure = new Error('erase failed');
    gql['delete'] = { mutate: vi.fn().mockReturnValueOnce(of({ data: {} })).mockReturnValueOnce(throwError(() => failure)) };
    const svc = service();

    await expect(svc.deleteWithDeliveryStates([{ rtId: 'p1', ckTypeId: 'P' }], [{ rtId: 'd1', ckTypeId: 'D' }]))
      .resolves.toEqual({ deliveryStatesErased: false, error: failure });

    gql['delete'].mutate!.mockReturnValueOnce(throwError(() => new Error('archive failed')));
    await expect(svc.deleteWithDeliveryStates([{ rtId: 'p1', ckTypeId: 'P' }], [])).rejects.toThrow(/^archive failed$/);
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
