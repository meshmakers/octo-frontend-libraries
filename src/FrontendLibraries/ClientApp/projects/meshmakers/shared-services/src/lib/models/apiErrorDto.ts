import { FailedDetailsDto } from "./failedDetailsDto";

export interface ApiErrorDto {
  statusCode: number;
  statusDescription: string;
  message: string;
  details?: FailedDetailsDto[];
}
