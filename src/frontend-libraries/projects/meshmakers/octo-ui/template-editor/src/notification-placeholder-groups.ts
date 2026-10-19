import { MmTranslate } from '@meshmakers/shared-ui';
import {
  formatNotificationCell,
  NOTIFICATION_COUNT_PLACEHOLDER,
  notificationColumnPath,
  NotificationQuerySample
} from '@meshmakers/octo-services';
import { TemplatePlaceholder, TemplatePlaceholderGroup } from './template-placeholders';
import { TEMPLATE_EDITOR_KEY } from './template-editor.messages';

export interface NotificationPlaceholderGroupOptions {
  id?: string;
  label?: string;
  typeLabel?: (typeName: string) => string | undefined;
  exampleOf?: (column: string) => string | undefined;
}

export function notificationPlaceholderGroup(columns: readonly string[], sample: NotificationQuerySample | null,
  t: MmTranslate, options: NotificationPlaceholderGroupOptions = {}): TemplatePlaceholderGroup {
  const firstRow = sample?.rows[0];
  const typeLabel = (typeName: string): string => options.typeLabel?.(typeName) ?? humanize(typeName);
  const sampleOf = (column: string): string | undefined => {
    if (!firstRow) return options.exampleOf?.(column);
    const key = Object.keys(firstRow).find(candidate => candidate.toLowerCase() === column.toLowerCase());
    const text = key === undefined ? '' : formatNotificationCell(firstRow[key]);
    return text || undefined;
  };

  const placeholders: TemplatePlaceholder[] = [{
    token: '${' + NOTIFICATION_COUNT_PLACEHOLDER + '}',
    label: t(`${TEMPLATE_EDITOR_KEY}.count`),
    sample: firstRow ? String(sample?.totalCount ?? 0) : '1',
    note: t(`${TEMPLATE_EDITOR_KEY}.countNote`)
  }];

  for (const column of columns) {
    const path = notificationColumnPath(column);
    const attribute = path.attribute.split('.').map(humanize).join(' › ');
    const target = path.trail[path.trail.length - 1];
    placeholders.push({
      token: '${' + column + '}',
      label: target ? `${typeLabel(target)} · ${attribute}` : attribute,
      sample: sampleOf(column),
      note: path.trail.length > 1 ? path.trail.map(typeLabel).join(' › ') : undefined
    });
  }

  return {
    id: options.id ?? 'query-row',
    label: options.label ?? t(`${TEMPLATE_EDITOR_KEY}.queryRow`),
    placeholders
  };
}

function humanize(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
