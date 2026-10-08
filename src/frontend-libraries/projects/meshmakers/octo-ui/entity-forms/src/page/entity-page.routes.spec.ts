import { UnsavedChangesGuard } from '@meshmakers/shared-ui';
import { entityFormRoutes } from './entity-page.routes';

describe('entityFormRoutes', () => {
  it("builds '', 'new' and ':rtId' with the unsaved-changes guard", () => {
    const routes = entityFormRoutes({ formKey: 'sftp-configuration' });
    expect(routes.map((r) => r.path)).toEqual(['', 'new', ':rtId']);
    for (const r of routes) {
      expect(r.canDeactivate).toEqual([UnsavedChangesGuard]);
      expect(typeof r.loadComponent).toBe('function');
      expect(r.data?.['formKey']).toBe('sftp-configuration');
    }
    expect(routes[1].data?.['rtId']).toBe('new');
    expect(routes[0].data?.['rtId']).toBeUndefined();
  });

  it('adds breadcrumbs with the entityFormTitle / entityName placeholders when a URL is given', () => {
    const routes = entityFormRoutes({ ckTypeId: 'A/B', breadcrumbUrl: 'communication/sftp', canWrite: false });
    expect(routes[0].data?.['breadcrumb']).toEqual([{ label: '{{entityFormTitle}}', url: 'communication/sftp' }]);
    expect(routes[1].data?.['breadcrumb']).toEqual([
      { label: '{{entityFormTitle}}', url: 'communication/sftp' },
      { label: 'New', url: 'communication/sftp/new' },
    ]);
    expect(routes[2].data?.['breadcrumb']).toEqual([
      { label: '{{entityFormTitle}}', url: 'communication/sftp' },
      { label: '{{entityName}}', url: 'communication/sftp/:rtId' },
    ]);
    expect(routes[2].data?.['canWrite']).toBe(false);
    expect(routes[2].data?.['ckTypeId']).toBe('A/B');
  });

  it('adds no breadcrumbs without a URL', () => {
    const routes = entityFormRoutes();
    expect(routes.every((r) => r.data?.['breadcrumb'] === undefined)).toBe(true);
  });

  it('carries the beforeSave hook as route data entityFormBeforeSave on all three routes (AB#5623)', () => {
    const hook = () => undefined;
    const routes = entityFormRoutes({ ckTypeId: 'A/B', beforeSave: hook });
    expect(routes.every((r) => r.data?.['entityFormBeforeSave'] === hook)).toBe(true);
    expect(entityFormRoutes().every((r) => !('entityFormBeforeSave' in (r.data ?? {})))).toBe(true);
  });

  it('carries rowLabelField as route data entityListRowLabelField (AB#5623)', () => {
    expect(entityFormRoutes({ rowLabelField: 'displayName' }).every((r) => r.data?.['entityListRowLabelField'] === 'displayName')).toBe(true);
    expect(entityFormRoutes().every((r) => !('entityListRowLabelField' in (r.data ?? {})))).toBe(true);
  });

  it('carries booleanDisplay as route data entityListBooleanDisplay (AB#5623)', () => {
    expect(entityFormRoutes({ booleanDisplay: 'icon' }).every((r) => r.data?.['entityListBooleanDisplay'] === 'icon')).toBe(true);
    expect(entityFormRoutes().every((r) => !('entityListBooleanDisplay' in (r.data ?? {})))).toBe(true);
  });

  it('carries the rowClass callback as route data entityListRowClass (AB#5623)', () => {
    const rowClass = () => 'x';
    expect(entityFormRoutes({ rowClass }).every((r) => r.data?.['entityListRowClass'] === rowClass)).toBe(true);
    expect(entityFormRoutes().every((r) => !('entityListRowClass' in (r.data ?? {})))).toBe(true);
  });

  it('carries the edit mode as route data entityPageEditMode (AB#5623)', () => {
    expect(entityFormRoutes({ editMode: 'dialog' }).every((r) => r.data?.['entityPageEditMode'] === 'dialog')).toBe(true);
    expect(entityFormRoutes().every((r) => !('entityPageEditMode' in (r.data ?? {})))).toBe(true);
  });

  it('loadComponent resolves to EntityPageComponent', async () => {
    const ctor = await entityFormRoutes()[0].loadComponent!();
    const { EntityPageComponent } = await import('./entity-page.component');
    expect(ctor).toBe(EntityPageComponent);
  });
});
