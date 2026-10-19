import { NOTIFICATION_COUNT_PLACEHOLDER } from './notification-placeholders';

const PLACEHOLDER = /\$\{([^{}]*)\}/g;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MARKDOWN_CONTROL = /&(?:amp|lt|gt|quot|#39);|[\\`*_[\]()!#|~^${}+]/g;

export type NotificationQueryRow = Readonly<Record<string, unknown>>;

export interface NotificationQuerySample {
  rows: NotificationQueryRow[];
  totalCount: number;
}

export interface NotificationPreviewOptions {
  columns: readonly string[];
  rows: readonly NotificationQueryRow[];
  totalCount: number;
  markup: boolean;
  standIn: (column: string) => string;
}

export interface NotificationPreview {
  subject: string;
  body: string;
}

export function renderNotificationPreview(subjectTemplate: string | null | undefined,
  bodyTemplate: string | null | undefined, options: NotificationPreviewOptions): NotificationPreview {
  const count = String(options.rows.length > 0 ? options.totalCount : 1);
  const columnOf = new Map(options.columns.map(column => [column.toLowerCase(), column]));
  const subject = fill(subjectTemplate, name => name === NOTIFICATION_COUNT_PLACEHOLDER ? count : undefined);

  const block = (valueOf: (column: string) => string): string => fill(bodyTemplate, name => {
    if (name === NOTIFICATION_COUNT_PLACEHOLDER) return count;
    const column = columnOf.get(name);
    return column === undefined ? undefined : valueOf(column);
  });

  const body = options.rows.length > 0
    ? options.rows.map(row => block(column => encode(formatCell(cellOf(row, column)), options.markup))).join('\n\n')
    : block(column => encode(options.standIn(column), options.markup));
  return { subject, body };
}

export function formatNotificationCell(value: unknown): string {
  return formatCell(value);
}

function fill(template: string | null | undefined, valueOf: (name: string) => string | undefined): string {
  return (template ?? '').replace(PLACEHOLDER, (token, inner: string) => valueOf(inner.trim().toLowerCase()) ?? token);
}

function cellOf(row: NotificationQueryRow, column: string): unknown {
  const key = Object.keys(row).find(candidate => candidate.toLowerCase() === column.toLowerCase());
  return key === undefined ? null : row[key];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value === 'string' && ISO_DATE_TIME.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : formatDateTime(date);
  }
  return String(value);
}

function formatDateTime(date: Date): string {
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function encode(text: string, markup: boolean): string {
  if (!markup) return text;
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escaped.replace(MARKDOWN_CONTROL, match => match.length > 1 ? match : `&#${match.charCodeAt(0)};`);
}
