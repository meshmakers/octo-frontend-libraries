import {ExternalLoginDto} from './externalLoginDto';

export interface UserDto {
  firstName: string;
  lastName: string;
  userId: string;
  email: string;
  name: string;
  externalLogins?: ExternalLoginDto[];
}
