import { UserDto } from './userDto';

export interface RegisterUserDto extends UserDto {
  password: string;
}
