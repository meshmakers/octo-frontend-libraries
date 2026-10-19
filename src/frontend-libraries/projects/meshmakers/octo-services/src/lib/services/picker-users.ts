import { HttpErrorResponse } from '@angular/common/http';
import { IdentityService } from './identity-service';
import { UserDirectoryEntryDto } from '../shared/userDirectoryEntryDto';
import { UserDto } from '../shared/userDto';

export const PICKER_USERS_PAGE_SIZE = 500;

export const PICKER_USERS_MAX_PAGES = 20;

export interface LoadPickerUsersOptions {
  fallbackToGetPagedOnForbidden?: boolean;
}

export async function loadPickerUsers(
  identityService: IdentityService,
  options: LoadPickerUsersOptions = {}
): Promise<UserDirectoryEntryDto[]> {
  try {
    return await loadDirectoryUsers(identityService);
  } catch (error) {
    if (options.fallbackToGetPagedOnForbidden && error instanceof HttpErrorResponse && error.status === 403) {
      const users = await loadAdminPickerUsers(identityService);
      return users.map(user => ({ userId: user.userId, displayName: userDisplayName(user) }));
    }
    throw error;
  }
}

async function loadDirectoryUsers(identityService: IdentityService): Promise<UserDirectoryEntryDto[]> {
  const users: UserDirectoryEntryDto[] = [];
  for (let page = 0; page < PICKER_USERS_MAX_PAGES; page++) {
    const result = await identityService.getUserDirectoryWithFallback(users.length, PICKER_USERS_PAGE_SIZE);
    const list = result?.list ?? [];
    users.push(...list);
    if (list.length < PICKER_USERS_PAGE_SIZE || users.length >= (result?.totalCount ?? 0)) {
      break;
    }
  }
  return users;
}

export async function loadAdminPickerUsers(identityService: IdentityService): Promise<UserDto[]> {
  const users: UserDto[] = [];
  for (let page = 0; page < PICKER_USERS_MAX_PAGES; page++) {
    const result = await identityService.getUsers(users.length, PICKER_USERS_PAGE_SIZE);
    const list = result?.list ?? [];
    users.push(...list);
    if (list.length < PICKER_USERS_PAGE_SIZE || users.length >= (result?.totalCount ?? 0)) {
      break;
    }
  }
  return users;
}

export function userDisplayName(user: Pick<UserDto, 'firstName' | 'lastName' | 'name'>): string {
  const fullName = personName(user);
  return fullName.length > 0 ? fullName : (user.name ?? '');
}

export function userPickerText(user: Pick<UserDto, 'firstName' | 'lastName' | 'name'>): string {
  const fullName = personName(user);
  const name = user.name ?? '';
  return fullName.length > 0 ? `${fullName} (${name})` : name;
}

function personName(user: Pick<UserDto, 'firstName' | 'lastName'>): string {
  return [user.firstName, user.lastName]
    .filter(n => !!n && n.trim().length > 0)
    .map(n => n.trim())
    .join(' ');
}
