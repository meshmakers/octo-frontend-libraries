import * as primary from '../../public-api';
import * as status from './notification-status';
import * as schedule from './notification-schedule';
import * as placeholders from './notification-placeholders';
import * as preview from './notification-preview';
import * as subscriptions from './notification-subscription.service';
import * as candidates from './notification-recipient-candidates.service';

/*
 * AB#9650 / AB#9654: the notification API is public only through '@meshmakers/octo-services/notifications'. The code
 * still lives in the primary entry point, which exports every symbol of lib/notifications as an internal ɵ alias only;
 * the new entry point re-exports those aliases under their own names. The deprecated plain names on the primary entry
 * point were removed in AB#9654. This spec keeps the lists in step when a symbol is added or removed, and fails when a
 * plain notification name comes back on the primary entry point.
 */

interface NodeFs {
  readFileSync(path: string, encoding: 'utf8'): string;
  existsSync(path: string): boolean;
}
declare const process: { cwd(): string };

async function loadFs(): Promise<NodeFs> {
  const moduleName = 'node:fs';
  return (await import(/* @vite-ignore */ moduleName)) as NodeFs;
}

const FILES = [
  'notification-status',
  'notification-schedule',
  'notification-placeholders',
  'notification-preview',
  'notification-subscription.service',
  'notification-recipient-candidates.service'
];
const MODULES: Record<string, unknown>[] = [status, schedule, placeholders, preview, subscriptions, candidates];
const DECLARATION = /^export (?:declare )?(?:abstract )?(const|function|class|interface|type|enum) ([A-Za-z_][A-Za-z0-9_]*)/gm;

describe('notification entry point (AB#9650, AB#9654)', () => {
  const base = 'projects/meshmakers/octo-services';
  let declared: string[] = [];
  let publicApi = '';
  let entryPoint = '';
  let transitionFileExists = true;

  beforeAll(async () => {
    const fs = await loadFs();
    const root = process.cwd();
    const declarations = FILES.flatMap(file =>
      [...fs.readFileSync(`${root}/${base}/src/lib/notifications/${file}.ts`, 'utf8').matchAll(DECLARATION)]);
    declared = declarations.map(match => match[2]);
    publicApi = fs.readFileSync(`${root}/${base}/src/public-api.ts`, 'utf8');
    entryPoint = fs.readFileSync(`${root}/${base}/notifications/src/public-api.ts`, 'utf8');
    transitionFileExists = fs.existsSync(`${root}/${base}/src/lib/notifications/notifications-transition-exports.ts`);
  });

  it('finds the notification symbols', () => {
    expect(declared).toContain('NotificationSubscriptionService');
    expect(declared).toContain('renderNotificationPreview');
    expect(declared).toContain('NOTIFICATION_NEXT_EXECUTIONS');
    expect(declared.length).toBeGreaterThan(40);
  });

  it('has no transition exports any more (AB#9654)', () => {
    expect(transitionFileExists).toBe(false);
    expect(publicApi).not.toContain('notifications-transition-exports');
  });

  it('exports an internal ɵ alias of every symbol from the primary entry point', () => {
    const missing = declared.filter(name => !new RegExp(`\\b${name} as ɵ${name}(?![A-Za-z0-9_])`).test(publicApi));
    expect(missing).toEqual([]);
  });

  it('does not export a notification module of lib/notifications under its plain names', () => {
    // Only the ɵ alias blocks may name lib/notifications; an `export *` of one of its files would publish the plain names.
    expect(publicApi).not.toMatch(/export \* from '\.\/lib\/notifications\//);
  });

  it('exports every symbol under its own name from @meshmakers/octo-services/notifications', () => {
    // No \b before ɵ: it is not a word character, so there is no word boundary in front of it.
    const missing = declared.filter(name => !new RegExp(`(?:^|\\s)ɵ${name} as ${name}\\b`, 'm').test(entryPoint));
    expect(missing).toEqual([]);
    expect(entryPoint).toContain("from '@meshmakers/octo-services';");
  });

  it('gives the ɵ alias the runtime value of the original module and no plain name on the primary entry point', () => {
    const exported = primary as unknown as Record<string, unknown>;
    const values = MODULES.flatMap(module => Object.entries(module));
    expect(values.length).toBeGreaterThan(20);
    for (const [name, value] of values) {
      expect(exported[`ɵ${name}`], `ɵ${name}`).toBe(value);
      expect(name in exported, `plain ${name} on the primary entry point`).toBe(false);
    }
  });
});
