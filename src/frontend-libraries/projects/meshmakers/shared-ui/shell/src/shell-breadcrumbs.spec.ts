import { BreadCrumbData } from '@meshmakers/shared-services';
import { ShellNavNode } from './shell-navigation.service';
import { crumbPath, isAreaCrumb, ShellBreadcrumbOptions, shellBreadcrumbs as rewrite } from './shell-breadcrumbs';

/** A host that migrated from a section-based drawer (the Refinery Studio's settings). */
const LEGACY: ShellBreadcrumbOptions = {
  legacySectionCrumbs: new Set(['communication', 'identity', 'repository', 'general']),
  legacySectionAreaNames: { communication: 'Integration', identity: 'Access' },
};
const shellBreadcrumbs = (items: BreadCrumbData[], area: ShellNavNode | null) => rewrite(items, area, LEGACY);

const crumb = (text: string, url = text.toLowerCase()): BreadCrumbData => ({ text, title: text, labelTemplate: text, url });
const area = (id: string, text: string): ShellNavNode => ({
  id, text, separator: false, selected: false, active: true, navigable: false, external: false, children: []
});

const INTEGRATION = area('area-integration', 'Integration');
const SETTINGS = area('area-settings', 'Settings');
const DATA = area('area-data', 'Data');

describe('shellBreadcrumbs', () => {
  const texts = (items: BreadCrumbData[]) => items.map(item => item.text);

  it('replaces a legacy section crumb with the rail area', () => {
    const result = shellBreadcrumbs([crumb('Communication'), crumb('Adapters', 'communication/adapters')], INTEGRATION);
    expect(texts(result)).toEqual(['Integration', 'Adapters']);
    expect(isAreaCrumb(result[0]) && result[0].areaId).toBe('area-integration');
    expect(result[1].url).toBe('communication/adapters');
  });

  it('maps Identity, Repository and General pages to the area of their route', () => {
    expect(texts(shellBreadcrumbs([crumb('Identity'), crumb('Data Permissions')], SETTINGS))).toEqual(['Settings', 'Data Permissions']);
    expect(texts(shellBreadcrumbs([crumb('Repository'), crumb('Libraries')], DATA))).toEqual(['Data', 'Libraries']);
    expect(texts(shellBreadcrumbs([crumb('Identity'), crumb('Users')], area('area-access', 'Access')))).toEqual(['Access', 'Users']);
  });

  it('does not repeat the area when the next crumb already names it', () => {
    expect(texts(shellBreadcrumbs([crumb('General'), crumb('Settings')], SETTINGS))).toEqual(['Settings']);
  });

  it('keeps a first crumb that already is the area and prefixes any other one', () => {
    expect(texts(shellBreadcrumbs([crumb('Settings'), crumb('Tenant')], SETTINGS))).toEqual(['Settings', 'Tenant']);
    expect(texts(shellBreadcrumbs([crumb('Data Explorer'), crumb('Queries')], DATA))).toEqual(['Data', 'Data Explorer', 'Queries']);
  });

  it('leaves non-legacy crumbs alone without an area and never mutates the input', () => {
    const plain = [crumb('Data Explorer'), crumb('Types')];
    expect(shellBreadcrumbs(plain, null)).toEqual(plain);
    const items = [crumb('Communication'), crumb('Adapters')];
    shellBreadcrumbs(items, null);
    shellBreadcrumbs(items, INTEGRATION);
    expect(texts(items)).toEqual(['Communication', 'Adapters']);
  });

  it('joins crumbs into a recent path', () => {
    expect(crumbPath([crumb('Integration'), crumb('Adapters')])).toBe('Integration › Adapters');
    expect(crumbPath([])).toBeUndefined();
  });

  it('drops crumbs without text instead of rendering an empty segment', () => {
    const result = shellBreadcrumbs([crumb('Communication'), crumb('Adapters'), { ...crumb('x'), text: '' }, crumb('Mesh Adapter')], INTEGRATION);
    expect(result.map((c) => c.text)).toEqual(['Integration', 'Adapters', 'Mesh Adapter']);
  });

  it('names the area of a legacy section crumb when the page has no active area (data flow editor)', () => {
    const result = shellBreadcrumbs([crumb('Communication'), crumb('Data Flows'), crumb('Editor')], null);
    expect(result.map((c) => c.text)).toEqual(['Integration', 'Data Flows', 'Editor']);
    expect(crumbPath(result.slice(0, -1))).toBe('Integration › Data Flows');
  });

  it('without options only prefixes the area and keeps every crumb', () => {
    expect(rewrite([crumb('Communication'), crumb('Adapters')], INTEGRATION).map(c => c.text)).toEqual(['Integration', 'Communication', 'Adapters']);
    expect(rewrite([crumb('Communication'), crumb('Adapters')], null).map(c => c.text)).toEqual(['Communication', 'Adapters']);
  });
});
