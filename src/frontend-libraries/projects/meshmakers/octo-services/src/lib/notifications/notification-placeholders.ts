const PLACEHOLDER = /\$\{([^{}]*)\}/g;

export const NOTIFICATION_COUNT_PLACEHOLDER = 'count';

export function unknownNotificationPlaceholders(subjectTemplate: string | null | undefined,
  bodyTemplate: string | null | undefined, columns: readonly string[]): string[] {
  const known = new Set(columns.map(column => column.toLowerCase()));
  const unknown: string[] = [];
  const collect = (text: string | null | undefined, isKnown: (name: string) => boolean): void => {
    for (const match of (text ?? '').matchAll(PLACEHOLDER)) {
      const token = match[1];
      const name = token.trim().toLowerCase();
      if (!isKnown(name) && !unknown.some(seen => seen.toLowerCase() === token.toLowerCase())) {
        unknown.push(token);
      }
    }
  };
  collect(subjectTemplate, name => name === NOTIFICATION_COUNT_PLACEHOLDER);
  collect(bodyTemplate, name => name === NOTIFICATION_COUNT_PLACEHOLDER || known.has(name));
  return unknown;
}

export function placeholderList(names: readonly string[]): string {
  return names.map(name => '${' + name + '}').join(', ');
}

export interface NotificationColumnPath {
  column: string;
  trail: string[];
  attribute: string;
}

export function notificationColumnPath(column: string): NotificationColumnPath {
  const hops = column.split('->');
  const attribute = hops.pop() ?? column;
  return { column, trail: hops.map(hop => hop.slice(hop.indexOf('.') + 1)), attribute };
}
