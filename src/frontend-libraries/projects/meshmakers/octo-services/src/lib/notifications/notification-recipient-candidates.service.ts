import { inject, Injectable, InjectionToken } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthorizeService, Roles } from '@meshmakers/shared-auth';
import { IdentityService } from '../services/identity-service';
import { loadAdminPickerUsers, loadPickerUsers, PICKER_USERS_MAX_PAGES, PICKER_USERS_PAGE_SIZE } from '../services/picker-users';
import { GraphQL } from '../shared/graphQL';
import { NotificationsGetIdentityUsersDtoGQL } from '../graphQL/notificationsGetIdentityUsers';

export interface NotificationRecipientCandidate {
  id: string;
  name: string;
  email: string | null;
  label: string;
}

export interface NotificationRecipientCandidatesSource {
  load(): Promise<NotificationRecipientCandidate[]>;
}

@Injectable({ providedIn: 'root' })
export class NotificationRecipientCandidatesService implements NotificationRecipientCandidatesSource {
  private readonly identityService = inject(IdentityService);
  private readonly authorizeService = inject(AuthorizeService);

  async load(): Promise<NotificationRecipientCandidate[]> {
    if (!this.authorizeService.isInRole(Roles.UserManagement)) {
      return (await loadPickerUsers(this.identityService)).map(user => ({
        id: user.userId,
        name: user.displayName,
        email: null,
        label: user.displayName
      }));
    }

    return (await loadAdminPickerUsers(this.identityService)).map(user => ({
      id: user.userId,
      name: user.name,
      email: user.email || null,
      label: user.email ? `${user.email} (${user.name})` : user.name
    }));
  }
}

@Injectable({ providedIn: 'root' })
export class GraphQlNotificationRecipientCandidatesService implements NotificationRecipientCandidatesSource {
  private readonly getIdentityUsersGQL = inject(NotificationsGetIdentityUsersDtoGQL);

  async load(): Promise<NotificationRecipientCandidate[]> {
    const candidates: NotificationRecipientCandidate[] = [];
    let read = 0;
    for (let page = 0; page < PICKER_USERS_MAX_PAGES; page++) {
      const result = await firstValueFrom(this.getIdentityUsersGQL.fetch({
        variables: { first: PICKER_USERS_PAGE_SIZE, after: GraphQL.offsetToCursor(read) },
        fetchPolicy: 'network-only'
      }));
      const connection = result.data?.runtime?.systemIdentityUser;
      const items = connection?.items ?? [];
      read += items.length;
      candidates.push(...items.filter(user => user !== null).map(user => graphQlCandidate(user)));
      if (items.length < PICKER_USERS_PAGE_SIZE || read >= (connection?.totalCount ?? 0)) {
        break;
      }
    }
    return candidates;
  }
}

function graphQlCandidate(user: { rtId: string; userName?: string | null; firstName?: string | null; lastName?: string | null;
  email?: string | null }): NotificationRecipientCandidate {
  const fullName = [user.firstName, user.lastName].map(part => part?.trim()).filter(part => !!part).join(' ');
  const name = fullName || user.userName || user.rtId;
  const email = user.email || null;
  return { id: user.rtId, name, email, label: email ? `${email} (${name})` : name };
}

export const NOTIFICATION_RECIPIENT_CANDIDATES = new InjectionToken<NotificationRecipientCandidatesSource>(
  'NOTIFICATION_RECIPIENT_CANDIDATES',
  { providedIn: 'root', factory: () => inject(NotificationRecipientCandidatesService) }
);
