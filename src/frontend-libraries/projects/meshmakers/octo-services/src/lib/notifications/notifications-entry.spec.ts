import * as primary from '../../public-api';
import * as status from './notification-status';
import * as schedule from './notification-schedule';
import * as placeholders from './notification-placeholders';
import * as preview from './notification-preview';
import * as subscriptions from './notification-subscription.service';
import * as candidates from './notification-recipient-candidates.service';

/*
 * AB#9650: the notification API has its own entry point '@meshmakers/octo-services/notifications'. During the
 * transition every symbol of lib/notifications must be reachable three ways: as a deprecated name on the primary entry
 * point, as an internal ɵ alias on the primary entry point, and under its own name on the new entry point (which
 * re-exports the ɵ aliases). This spec keeps the four lists in step when a symbol is added or removed.
 */

interface NodeFs {
  readFileSync(path: string, encoding: 'utf8'): string;
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
const DECLARATION = /^export (?:declare )?(?:abstract )?(?:const|function|class|interface|type|enum) ([A-Za-z_][A-Za-z0-9_]*)/gm;
const DEPRECATED = '/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */';

describe('notification entry point (AB#9650)', () => {
  const base = 'projects/meshmakers/octo-services';
  let declared: string[] = [];
  let transition = '';
  let publicApi = '';
  let entryPoint = '';

  beforeAll(async () => {
    const fs = await loadFs();
    const root = process.cwd();
    declared = FILES.flatMap(file =>
      [...fs.readFileSync(`${root}/${base}/src/lib/notifications/${file}.ts`, 'utf8').matchAll(DECLARATION)].map(match => match[1]));
    transition = fs.readFileSync(`${root}/${base}/src/lib/notifications/notifications-transition-exports.ts`, 'utf8');
    publicApi = fs.readFileSync(`${root}/${base}/src/public-api.ts`, 'utf8');
    entryPoint = fs.readFileSync(`${root}/${base}/notifications/src/public-api.ts`, 'utf8');
  });

  it('finds the notification symbols', () => {
    expect(declared).toContain('NotificationSubscriptionService');
    expect(declared).toContain('renderNotificationPreview');
    expect(declared).toContain('NOTIFICATION_NEXT_EXECUTIONS');
    expect(declared.length).toBeGreaterThan(40);
  });

  it('keeps every symbol on the primary entry point as a deprecated declaration', () => {
    const missing = declared.filter(name =>
      !new RegExp(`${escapeRegExp(DEPRECATED)}\\nexport (?:const|type) ${name}\\b`).test(transition));
    expect(missing).toEqual([]);
  });

  it('exports an internal ɵ alias of every symbol from the primary entry point', () => {
    const missing = declared.filter(name => !new RegExp(`\\b${name} as ɵ${name}(?![A-Za-z0-9_])`).test(publicApi));
    expect(missing).toEqual([]);
  });

  it('exports every symbol under its own name from @meshmakers/octo-services/notifications', () => {
    // No \b before ɵ: it is not a word character, so there is no word boundary in front of it.
    const missing = declared.filter(name => !new RegExp(`(?:^|\\s)ɵ${name} as ${name}\\b`, 'm').test(entryPoint));
    expect(missing).toEqual([]);
    expect(entryPoint).toContain("from '@meshmakers/octo-services';");
  });

  it('gives the same runtime value under the deprecated name, the ɵ alias and the original module', () => {
    const exported = primary as unknown as Record<string, unknown>;
    const values = MODULES.flatMap(module => Object.entries(module));
    expect(values.length).toBeGreaterThan(20);
    for (const [name, value] of values) {
      expect(exported[name], name).toBe(value);
      expect(exported[`ɵ${name}`], `ɵ${name}`).toBe(value);
    }
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
