import type { MockedObject } from 'vitest';
import { Component, NO_ERRORS_SCHEMA, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { ConfirmationService, NotificationDisplayService } from '@meshmakers/shared-ui';
import { of } from 'rxjs';
import { EntityFormGetListDtoGQL } from '../graphQL/getEntityFormList';
import { EntityFormChangeSet, EntityFormValueState, ResolvedEntityForm } from '../models/entity-form.models';
import { EntityFormDataService } from '../services/entity-form-data.service';
import { EntityFormService } from '../services/entity-form.service';
import { EntityPageComponent } from './entity-page.component';

/** Stand-in for `<mm-entity-form>` exposing the public methods the page calls. */
@Component({ selector: 'mm-entity-form', standalone: true, template: '' })
class StubEntityFormComponent {
  readonly model = input<unknown>();
  readonly mode = input<unknown>();
  readonly state = input<unknown>();
  readonly readOnly = input<unknown>();
  readonly messages = input<unknown>();
  readonly records = input<unknown>();
  dirty = false;
  valid = true;
  readonly saveBlockedReason = signal<string | null>(null);
  changeSet: EntityFormChangeSet = { attributes: [{ attributeName: 'host', value: 'h' }], associations: [], isEmpty: false };
  isDirty(): boolean { return this.dirty; }
  isValid(): boolean { return this.valid; }
  markAllAsTouched(): void { /* noop */ }
  getChangeSet(): EntityFormChangeSet { return this.changeSet; }
}

function makeModel(overrides: Partial<ResolvedEntityForm> = {}): ResolvedEntityForm {
  return {
    source: 'seeded',
    rtCkTypeId: 'System.Communication/SftpConfiguration',
    formTargetCkTypeId: 'System.Communication/SftpConfiguration',
    isAbstract: false,
    includeDerivedTypes: false,
    title: 'SFTP configurations',
    capabilities: {
      canCreate: true, canEdit: true, canDelete: true, canDuplicate: false, canExport: false, createRequiresSubtype: false,
    },
    sections: [],
    listColumns: [],
    readAttributeNames: ['host'],
    secretFields: ['password'],
    warnings: [],
    ...overrides,
  };
}

const STATE: EntityFormValueState = {
  values: { name: 'Main SFTP', host: 'sftp.example.com' },
  secretPresence: { password: true },
  associations: {},
  rtWellKnownName: null,
};

/** Protected-member view used by the spec. */
interface Testable {
  title: () => string;
  listTitle: () => string;
  showTypeColumn: () => boolean;
  view: () => string;
  mode: () => string;
  state: () => EntityFormValueState | undefined;
  entityRtId: () => string | null;
  formModel: () => ResolvedEntityForm | null;
  singletonWellKnownName: () => string | null;
}

describe('EntityPageComponent', () => {
  let fixture: ComponentFixture<EntityPageComponent>;
  let component: EntityPageComponent;
  let api: Testable;
  let formService: MockedObject<EntityFormService>;
  let dataService: MockedObject<EntityFormDataService>;
  let router: MockedObject<Router>;
  let breadCrumbs: MockedObject<BreadCrumbService>;
  let listGql: { fetch: ReturnType<typeof vi.fn> };

  async function create(data: Record<string, unknown>, params: Record<string, string> = {}, query: Record<string, string> = {}): Promise<void> {
    const route = {
      paramMap: of(convertToParamMap(params)),
      queryParamMap: of(convertToParamMap(query)),
      data: of(data),
      snapshot: { data, params, parent: null },
    };
    await TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: router },
        { provide: EntityFormService, useValue: formService },
        { provide: EntityFormDataService, useValue: dataService },
        { provide: EntityFormGetListDtoGQL, useValue: listGql },
        { provide: BreadCrumbService, useValue: breadCrumbs },
        { provide: NotificationDisplayService, useValue: { showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() } },
        { provide: ConfirmationService, useValue: { showYesNoConfirmationDialog: vi.fn().mockResolvedValue(true) } },
      ],
    })
      .overrideComponent(EntityPageComponent, {
        set: { imports: [StubEntityFormComponent], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EntityPageComponent);
    component = fixture.componentInstance;
    api = component as unknown as Testable;
    fixture.detectChanges();
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await fixture.whenStable();
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  function stubForm(): StubEntityFormComponent {
    const el = fixture.debugElement.query((d) => d.componentInstance instanceof StubEntityFormComponent);
    return el.componentInstance as StubEntityFormComponent;
  }

  beforeEach(() => {
    formService = {
      resolve: vi.fn(),
      resolveByFormKey: vi.fn(),
      getCkType: vi.fn().mockResolvedValue(null),
      getRecordsFor: vi.fn().mockResolvedValue({}),
    } as unknown as MockedObject<EntityFormService>;
    dataService = {
      load: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as MockedObject<EntityFormDataService>;
    router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as MockedObject<Router>;
    breadCrumbs = { updateBreadcrumbLabels: vi.fn().mockResolvedValue(undefined) } as unknown as MockedObject<BreadCrumbService>;
    listGql = { fetch: vi.fn().mockReturnValue(of({ data: { runtime: { runtimeEntities: { items: [] } } } })) };
  });

  it('shows the list when there is no rtId and sets the form title breadcrumb', async () => {
    formService.resolveByFormKey.mockResolvedValue(makeModel());
    await create({ formKey: 'sftp-configuration' });
    expect(formService.resolveByFormKey).toHaveBeenCalledWith('sftp-configuration');
    expect(api.view()).toBe('list');
    expect(breadCrumbs.updateBreadcrumbLabels).toHaveBeenCalledWith(expect.objectContaining({ entityFormTitle: 'SFTP configurations' }));
  });

  it('takes the form key from an inherited :formKey route param (settings mount, AB#5523)', async () => {
    formService.resolveByFormKey.mockResolvedValue(makeModel());
    await create({}, { category: 'connections', formKey: 'sftp-configuration' });
    expect(formService.resolveByFormKey).toHaveBeenCalledWith('sftp-configuration');
    expect(api.view()).toBe('list');
  });

  it('prefers route data over the :formKey param', async () => {
    formService.resolveByFormKey.mockResolvedValue(makeModel());
    await create({ formKey: 'grafana-configuration' }, { formKey: 'sftp-configuration' });
    expect(formService.resolveByFormKey).toHaveBeenCalledWith('grafana-configuration');
  });

  it("opens the create form for the 'new' route", async () => {
    formService.resolve.mockResolvedValue(makeModel());
    await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new' });
    expect(api.view()).toBe('form');
    expect(api.mode()).toBe('create');
    expect(dataService.load).not.toHaveBeenCalled();
  });

  it("resolves the concrete subtype from ?type= on the 'new' route", async () => {
    const abstract = makeModel({
      rtCkTypeId: 'System/Configuration', isAbstract: true,
      capabilities: { ...makeModel().capabilities, createRequiresSubtype: true },
    });
    formService.resolve.mockImplementation(async (id: string) => (id === 'System/Configuration' ? abstract : makeModel()));
    await create({ ckTypeId: 'System/Configuration', rtId: 'new' }, {}, { type: 'System.Communication/SftpConfiguration' });
    expect(api.mode()).toBe('create');
    expect(api.formModel()?.rtCkTypeId).toBe('System.Communication/SftpConfiguration');
  });

  it('loads the entity for an rtId and switches to edit mode', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
    expect(dataService.load).toHaveBeenCalledWith(expect.anything(), { rtId: 'r1' });
    expect(api.mode()).toBe('edit');
    expect(api.state()).toEqual(STATE);
    expect(breadCrumbs.updateBreadcrumbLabels).toHaveBeenCalledWith(expect.objectContaining({ entityName: 'Main SFTP' }));
  });

  it('opens a read-only view without write permission', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    await create({ ckTypeId: 'System.Communication/SftpConfiguration', canWrite: false }, { rtId: 'r1' });
    expect(api.mode()).toBe('view');
    stubForm().dirty = true;
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('reports unsaved changes from the form', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
    expect(component.hasUnsavedChanges()).toBe(false);
    stubForm().dirty = true;
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('has no unsaved changes while the list is shown', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' });
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('loads a singleton by its well-known name instead of showing the list', async () => {
    formService.resolveByFormKey.mockResolvedValue(makeModel({ singleton: { wellKnownName: 'MainSftp' } }));
    dataService.load.mockResolvedValue({ rtId: 's1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    await create({ formKey: 'sftp-configuration' });
    expect(dataService.load).toHaveBeenCalledWith(expect.anything(), { wellKnownName: 'MainSftp' });
    expect(api.view()).toBe('form');
    expect(api.mode()).toBe('edit');
    expect(api.entityRtId()).toBe('s1');
  });

  it('titles a singleton with its form name, not "Edit <entity>" (Tenant mode)', async () => {
    formService.resolveByFormKey.mockResolvedValue(makeModel({ title: 'Tenant mode', singleton: { wellKnownName: 'TenantMode' } }));
    dataService.load.mockResolvedValue({ rtId: 's1', ckTypeId: 'System/TenantMode', state: STATE });
    await create({ formKey: 'tenant-mode' });
    expect(api.title()).toBe('Tenant mode');
  });

  it('uses the host title override and type column flag of the route', async () => {
    formService.resolve.mockResolvedValue(makeModel({ title: 'Configuration' }));
    await create({ ckTypeId: 'System/Configuration', entityListTitle: 'All configurations', entityListTypeColumn: true });
    expect(api.listTitle()).toBe('All configurations');
    expect(api.showTypeColumn()).toBe(true);
    expect(breadCrumbs.updateBreadcrumbLabels).toHaveBeenCalledWith({ entityFormTitle: 'All configurations' });
  });

  it('opens create with the well-known name when the singleton does not exist yet', async () => {
    formService.resolveByFormKey.mockResolvedValue(makeModel({ singleton: { wellKnownName: 'MainSftp' } }));
    dataService.load.mockResolvedValue(null);
    dataService.create.mockResolvedValue('new-rt');
    await create({ formKey: 'sftp-configuration' });
    expect(api.mode()).toBe('create');
    expect(api.singletonWellKnownName()).toBe('MainSftp');
    expect(api.state()?.rtWellKnownName).toBe('MainSftp');

    dataService.load.mockResolvedValue({ rtId: 'new-rt', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    const ok = await component.saveChanges();
    expect(ok).toBe(true);
    expect(dataService.create).toHaveBeenCalledWith(
      expect.anything(), 'System.Communication/SftpConfiguration', expect.objectContaining({ rtWellKnownName: 'MainSftp' }),
    );
    expect(router.navigate).not.toHaveBeenCalled();
    expect(api.mode()).toBe('edit');
  });

  it('uses the first entity of the type for a singleton without a well-known name', async () => {
    formService.resolveByFormKey.mockResolvedValue(makeModel({ singleton: {} }));
    listGql.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { items: [{ rtId: 'first' }] } } } }));
    dataService.load.mockResolvedValue({ rtId: 'first', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    await create({ formKey: 'sftp-configuration' });
    expect(listGql.fetch).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ first: 1, attributeNames: [] }),
    }));
    expect(dataService.load).toHaveBeenCalledWith(expect.anything(), { rtId: 'first' });
  });

  it('creates and navigates to the edit route relative to the create route', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.create.mockResolvedValue('r9');
    await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new' });
    const ok = await component.saveChanges();
    expect(ok).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['..', 'r9'], expect.objectContaining({ replaceUrl: true }));
  });

  it('does not save an invalid form', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new' });
    stubForm().valid = false;
    expect(await component.saveChanges()).toBe(false);
    expect(dataService.create).not.toHaveBeenCalled();
  });

  it('disables Save with the reason while the form blocks saving (required secret without key ring, Q17)', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new' });
    const save = () => fixture.nativeElement.querySelector('[data-entity-page-save]') as HTMLButtonElement;
    expect(save().disabled).toBe(false);
    stubForm().saveBlockedReason.set('Cannot create: Password must be set');
    fixture.detectChanges();
    expect(save().disabled).toBe(true);
    expect(save().getAttribute('title')).toContain('Password');
  });

  it('updates only through the change set and reloads the values', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    dataService.update.mockResolvedValue(undefined as never);
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
    expect(await component.saveChanges()).toBe(true);
    expect(dataService.update).toHaveBeenCalledWith('r1', 'System.Communication/SftpConfiguration', stubForm().changeSet);
    expect(dataService.load).toHaveBeenCalledTimes(2);
  });

  it('emits saved after a create and after an update, but not for "no changes"', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.create.mockResolvedValue('r9');
    await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new' });
    const events: unknown[] = [];
    component.saved.subscribe((e) => events.push(e));
    await component.saveChanges();
    expect(events).toEqual([{ kind: 'create', rtId: 'r9', ckTypeId: 'System.Communication/SftpConfiguration' }]);
  });

  it('emits saved with kind update and skips an empty change set', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    dataService.update.mockResolvedValue(undefined as never);
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
    const events: unknown[] = [];
    component.saved.subscribe((e) => events.push(e));
    await component.saveChanges();
    expect(events).toEqual([{ kind: 'update', rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration' }]);
    stubForm().changeSet = { attributes: [], associations: [], isEmpty: true };
    await component.saveChanges();
    expect(events.length).toBe(1);
  });

  it('emits deleted before navigating back to the list', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    dataService.delete.mockResolvedValue(true);
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
    const events: unknown[] = [];
    component.deleted.subscribe((e) => events.push(e));
    await (component as unknown as { onDelete(): Promise<void> }).onDelete();
    expect(events).toEqual([{ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration' }]);
    expect(router.navigate).toHaveBeenCalledWith(['..'], expect.anything());
  });

  it('shows an error when no form resolves for the key', async () => {
    formService.resolveByFormKey.mockResolvedValue(null);
    await create({ formKey: 'unknown' });
    expect(api.view()).toBe('error');
  });
});
