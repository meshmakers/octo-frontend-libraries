import { SVGIcon, exclamationCircleIcon, xCircleIcon, infoCircleIcon } from '@progress/kendo-svg-icons';

export interface AlertItem {
  rtId: string;
  message: string;
  level: string;
  state: string;
  source: string;
  timestamp?: string;
}

export function getAlertSeverityColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 'var(--mm-alert-critical, #dc2626)';
    case 'ERROR': return 'var(--mm-alert-error, #ef4444)';
    case 'WARNING': return 'var(--mm-alert-warning, #f59e0b)';
    case 'INFORMATION': return 'var(--mm-alert-info, #3b82f6)';
    case 'DEBUG': return 'var(--mm-alert-debug, #6b7280)';
    default: return 'var(--mm-alert-debug, #6b7280)';
  }
}

export function getAlertSeverityIcon(level: string): SVGIcon {
  switch (level?.toUpperCase()) {
    case 'CRITICAL':
    case 'ERROR':
      return xCircleIcon;
    case 'WARNING':
      return exclamationCircleIcon;
    default:
      return infoCircleIcon;
  }
}

export function getAlertSeverityOrder(level: string): number {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 4;
    case 'ERROR': return 3;
    case 'WARNING': return 2;
    case 'INFORMATION': return 1;
    case 'DEBUG': return 0;
    default: return -1;
  }
}

export const DEFAULT_ALERT_CK_TYPE = 'System.Notification/StatefulEvent';
