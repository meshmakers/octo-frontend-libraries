export type MessageLevel = 'error' | 'warning' | 'info' | 'success';

export interface NotificationMessage {
  level: MessageLevel;
  message: string;
  details?: string;
  timestamp: Date;
}
