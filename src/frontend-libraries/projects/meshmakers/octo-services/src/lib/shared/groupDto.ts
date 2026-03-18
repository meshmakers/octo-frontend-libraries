export interface GroupDto {
  id?: string;
  groupName: string;
  groupDescription?: string;
  roleIds: string[];
  memberUserIds: string[];
  memberExternalUserIds: string[];
  memberGroupIds: string[];
}

export interface CreateGroupDto {
  groupName: string;
  groupDescription?: string;
  roleIds?: string[];
}

export interface UpdateGroupDto {
  groupName: string;
  groupDescription?: string;
}
