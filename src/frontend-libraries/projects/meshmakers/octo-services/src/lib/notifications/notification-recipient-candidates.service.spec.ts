import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthorizeService, Roles } from '@meshmakers/shared-auth';
import { IdentityService } from '../services/identity-service';
import { of } from 'rxjs';
import { NotificationsGetIdentityUsersDtoGQL } from '../graphQL/notificationsGetIdentityUsers';
import {
  GraphQlNotificationRecipientCandidatesService,
  NOTIFICATION_RECIPIENT_CANDIDATES,
  NotificationRecipientCandidatesService
} from './notification-recipient-candidates.service';

describe('NotificationRecipientCandidatesService', () => {
  const serverPageMaximum = 500;
  const users = Array.from({ length: 600 }, (_, index) => ({
    userId: `user-${index}`,
    name: `account${index}`,
    email: `person${index}@example.com`,
    firstName: '',
    lastName: ''
  }));

  function page<T>(list: T[], skip: number, take: number) {
    return { list: list.slice(skip, skip + Math.min(take, serverPageMaximum)), totalCount: list.length };
  }

  function service(identity: Partial<Record<'getUsers' | 'getUserDirectoryWithFallback', unknown>>,
    roles: string[] = [Roles.UserManagement]) {
    TestBed.configureTestingModule({
      providers: [
        { provide: IdentityService, useValue: identity },
        { provide: AuthorizeService, useValue: { isInRole: (role: string) => roles.includes(role) } }
      ]
    });
    return TestBed.inject(NotificationRecipientCandidatesService);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads every user of a tenant larger than one server page, with their e-mail', async () => {
    const options = await service({
      getUsers: vi.fn((skip: number, take: number) => Promise.resolve(page(users, skip, take)))
    }).load();

    expect(options).toHaveLength(600);
    expect(options[599]).toEqual({
      id: 'user-599',
      name: 'account599',
      email: 'person599@example.com',
      label: 'person599@example.com (account599)'
    });
  });

  it('reads the user directory for a caller without UserManagement, never the admin list', async () => {
    const directory = users.map(user => ({ userId: user.userId, displayName: `Person ${user.userId}` }));
    const getUsers = vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 }));
    const options = await service({
      getUsers,
      getUserDirectoryWithFallback: vi.fn((skip: number, take: number) => Promise.resolve(page(directory, skip, take)))
    }, [Roles.CommunicationManagement]).load();

    expect(getUsers).not.toHaveBeenCalled();
    expect(options).toHaveLength(600);
    expect(options[0]).toEqual({ id: 'user-0', name: 'Person user-0', email: null, label: 'Person user-0' });
  });

  it('passes a failure of the admin list on', async () => {
    const failing = service({ getUsers: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 500 })) });

    await expect(failing.load()).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});

describe('GraphQlNotificationRecipientCandidatesService', () => {
  afterEach(() => TestBed.resetTestingModule());

  function service(fetch: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [{ provide: NotificationsGetIdentityUsersDtoGQL, useValue: { fetch } }]
    });
    return TestBed.inject(GraphQlNotificationRecipientCandidatesService);
  }

  const user = (index: number, extra: Record<string, unknown> = {}) => ({
    rtId: `user-${index}`, userName: `account${index}`, firstName: null, lastName: null, email: null, ...extra
  });

  it('reads the tenant users page by page, labelled with e-mail and full name', async () => {
    const all = Array.from({ length: 600 }, (_, index) => user(index, { firstName: 'Erika', lastName: `Muster${index}`, email: `erika${index}@example.com` }));
    const fetch = vi.fn(({ variables }: { variables: { first: number; after: string | null } }) => {
      const skip = variables.after ? 500 : 0;
      return of({ data: { runtime: { systemIdentityUser: { totalCount: all.length, items: all.slice(skip, skip + variables.first) } } } });
    });

    const candidates = await service(fetch).load();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(candidates).toHaveLength(600);
    expect(candidates[599]).toEqual({ id: 'user-599', name: 'Erika Muster599', email: 'erika599@example.com', label: 'erika599@example.com (Erika Muster599)' });
  });

  it('falls back to the account name, then the rtId, when a user has no name and no e-mail', async () => {
    const fetch = vi.fn().mockReturnValue(of({ data: { runtime: { systemIdentityUser: { totalCount: 2, items: [user(1), { ...user(2), userName: null }] } } } }));

    const candidates = await service(fetch).load();

    expect(candidates.map(candidate => candidate.label)).toEqual(['account1', 'user-2']);
  });
});

describe('NOTIFICATION_RECIPIENT_CANDIDATES', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('defaults to the identity service source', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: IdentityService, useValue: {} },
        { provide: AuthorizeService, useValue: { isInRole: () => false } }
      ]
    });

    expect(TestBed.inject(NOTIFICATION_RECIPIENT_CANDIDATES)).toBe(TestBed.inject(NotificationRecipientCandidatesService));
  });
});
