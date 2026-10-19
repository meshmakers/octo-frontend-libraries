import { TestBed } from '@angular/core/testing';
import { ConfirmationService, NotificationDisplayService } from '@meshmakers/shared-ui';
import { CommunicationService } from '@meshmakers/octo-services';
import { NotificationDeploymentService } from './notification-deployment.service';

describe('NotificationDeploymentService', () => {
  const subscription = { rtId: 'sub-1', name: 'Failed EDA processes' };
  let communication: { deployNotificationSubscription: ReturnType<typeof vi.fn>; undeployNotificationSubscription: ReturnType<typeof vi.fn> };
  let notifications: { showSuccess: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };
  let confirmed: boolean;

  function service(): NotificationDeploymentService {
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunicationService, useValue: communication },
        { provide: NotificationDisplayService, useValue: notifications },
        { provide: ConfirmationService, useValue: { showYesNoConfirmationDialog: () => Promise.resolve(confirmed) } }
      ]
    });
    return TestBed.inject(NotificationDeploymentService);
  }

  beforeEach(() => {
    communication = {
      deployNotificationSubscription: vi.fn().mockResolvedValue(undefined),
      undeployNotificationSubscription: vi.fn().mockResolvedValue(undefined)
    };
    notifications = { showSuccess: vi.fn(), showError: vi.fn() };
    confirmed = true;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('deploys through the communication controller of the given tenant', async () => {
    expect(await service().deploy('ecnotify', subscription)).toBe(true);

    expect(communication.deployNotificationSubscription).toHaveBeenCalledWith('ecnotify', 'sub-1');
    expect(notifications.showSuccess).toHaveBeenCalledWith('"Failed EDA processes" deployed', 3000);
  });

  it('undeploys nothing when the operator does not confirm', async () => {
    confirmed = false;

    expect(await service().undeploy('ecnotify', subscription)).toBe(false);

    expect(communication.undeployNotificationSubscription).not.toHaveBeenCalled();
  });

  it('reports a failed deploy and returns false', async () => {
    communication.deployNotificationSubscription.mockRejectedValue(new Error('engine missing'));

    expect(await service().deploy('ecnotify', subscription)).toBe(false);

    expect(notifications.showError).toHaveBeenCalledWith('Failed to deploy "Failed EDA processes"');
  });
});
