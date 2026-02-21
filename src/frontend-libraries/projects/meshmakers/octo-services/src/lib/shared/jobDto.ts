export interface JobDto {
  id: string;
  createdAt: Date | null;
  stateChangedAt: Date | null;
  status: string | null;
  reason: string | null;
  errorMessage: string | null;
}
