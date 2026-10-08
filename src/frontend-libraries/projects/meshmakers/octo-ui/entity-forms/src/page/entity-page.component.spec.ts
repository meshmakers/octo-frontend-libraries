import type { MockedObject } from 'vitest';
import { Component, NO_ERRORS_SCHEMA, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { ConfirmationService, NotificationDisplayService } from '@meshmakers/shared-ui';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { of } from 'rxjs';
import { EntityFormGetListDtoGQL } from '../graphQL/getEntityFormList';
import { EntityFormChangeSet, EntityFormValueState, ResolvedEntityForm } from '../models/entity-form.models';
import { EntityFormDataService } from '../services/entity-form-data.service';
import { EntityFormService } from '../services/entity-form.service';
import { EntityPageComponent } from './entity-page.component';
import { EntityPageActionsDirective } from './entity-page-actions.directive';
import { ENTITY_FORM_BEFORE_SAVE, EntityFormSaveVeto } from '../core/before-save';
import { NgTemplateOutlet } from '@angular/common';

/** Host projecting page actions into the page (AB#5623). */
@Component({
  standalone: true,
  imports: [EntityPageComponent, EntityPageActionsDirective],
  template: `<mm-entity-page actionBarPosition="bottom">
    <ng-template mmEntityPageActions let-ctx>
      <button class="host-action" type="button">{{ ctx.view }}|{{ ctx.mode }}|{{ ctx.rtId }}</button>
    </ng-template>
  </mm-entity-page>`,
})
class PageHostComponent {}

/** Stand-in for `<mm-entity-form>` exposing the public methods the page calls. */
@Component({ selector: 'mm-entity-form', standalone: true, template: '' })
class StubEntityFormComponent {
  readonly model = input<unknown>();
  readonly mode = input<unknown>();
  readonly state = input<unknown>();
  readonly readOnly = input<unknown>();
  readonly messages = input<unknown>();
  readonly records = input<unknown>();
  readonly labelResolver = input<unknown>();
  readonly initialValues = input<unknown>();
  patched: unknown[] = [];
  dirty = false;
  valid = true;
  readonly saveBlockedReason = signal<string | null>(null);
  changeSet: EntityFormChangeSet = { attributes: [{ attributeName: 'host', value: 'h' }], associations: [], isEmpty: false };
  isDirty(): boolean { return this.dirty; }
  isValid(): boolean { return this.valid; }
  markAllAsTouched(): void { /* noop */ }
  getChangeSet(): EntityFormChangeSet { return this.changeSet; }
  patchValues(values: Record<string, unknown>): string[] { this.patched.push(values); return Object.keys(values); }
}

/** Stand-in for `<mm-entity-list>` (inputs as bound by the page, `refresh` spied). */
@Component({ selector: 'mm-entity-list', standalone: true, template: '' })
class StubEntityListComponent {
  readonly model = input<unknown>();
  readonly canWrite = input<unknown>();
  readonly messages = input<unknown>();
  readonly showTypeColumn = input<unknown>();
  readonly defaultSort = input<unknown>();
  readonly labelResolver = input<unknown>();
  readonly toolbarActions = input<unknown>();
  readonly rowActions = input<unknown>();
  readonly rowMenuActions = input<unknown>();
  readonly rowClass = input<unknown>();
  readonly createRequested = output<unknown>();
  readonly openRequested = output<unknown>();
  readonly refresh = vi.fn();
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
  let confirmation: { showYesNoConfirmationDialog: ReturnType<typeof vi.fn>; showDangerConfirm: ReturnType<typeof vi.fn> };

  let hostFixture: ComponentFixture<PageHostComponent> | null = null;

  async function create(data: Record<string, unknown>, params: Record<string, string> = {}, query: Record<string, string> = {}, withHost = false, extraProviders: unknown[] = []): Promise<void> {
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
        { provide: ConfirmationService, useValue: confirmation },
        ...(extraProviders as never[]),
      ],
    })
      .overrideComponent(EntityPageComponent, {
        set: { imports: [StubEntityFormComponent, StubEntityListComponent, NgTemplateOutlet], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    if (withHost) {
      hostFixture = TestBed.createComponent(PageHostComponent);
      fixture = hostFixture as unknown as ComponentFixture<EntityPageComponent>;
      component = hostFixture.debugElement.query((d) => d.componentInstance instanceof EntityPageComponent).componentInstance as EntityPageComponent;
    } else {
      hostFixture = null;
      fixture = TestBed.createComponent(EntityPageComponent);
      component = fixture.componentInstance;
    }
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
    confirmation = { showYesNoConfirmationDialog: vi.fn().mockResolvedValue(true), showDangerConfirm: vi.fn().mockResolvedValue(true) };
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
    expect(confirmation.showDangerConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/^Delete .+\?$/),
      targetName: expect.any(String),
      confirmText: 'Delete entity',
    }));
    expect(confirmation.showYesNoConfirmationDialog).not.toHaveBeenCalled();
    expect(events).toEqual([{ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration' }]);
    expect(router.navigate).toHaveBeenCalledWith(['..'], expect.anything());
  });

  it('keeps the entity when the danger confirmation is cancelled (AB#5579)', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    confirmation.showDangerConfirm.mockResolvedValue(false);
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
    await (component as unknown as { onDelete(): Promise<void> }).onDelete();
    expect(dataService.delete).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('names every icon-only action on the edit page (AB#5581 guard)', async () => {
    formService.resolve.mockResolvedValue(makeModel());
    dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
    await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
    expectIconButtonsAccessible(fixture);
  });

  it('shows an error when no form resolves for the key', async () => {
    formService.resolveByFormKey.mockResolvedValue(null);
    await create({ formKey: 'unknown' });
    expect(api.view()).toBe('error');
  });

  describe('host extensions (AB#5623)', () => {
    function el(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    it('keeps Save / Cancel in the header by default', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new' });
      expect(el().querySelector('header [data-entity-page-save]')).toBeTruthy();
      expect(el().querySelector('[data-entity-page-footer]')).toBeNull();
    });

    it('moves Save / Cancel into a bottom bar (route data) and renders host page actions there', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
      await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' }, {}, true);
      const footer = el().querySelector('[data-entity-page-footer]');
      expect(footer?.querySelector('[data-entity-page-save]')).toBeTruthy();
      expect(footer?.querySelector('[data-entity-page-back]')).toBeTruthy();
      expect(el().querySelector('header [data-entity-page-save]')).toBeNull();
      expect(footer?.querySelector('.host-action')?.textContent).toBe('form|edit|r1');
    });

    it('renders host page actions in the list header', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, {}, {}, true);
      expect(el().querySelector('[data-entity-page-host-actions] .host-action')?.textContent).toBe('list||');
    });

    it('reads the bottom position from route data', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new', entityPageActionBarPosition: 'bottom' });
      expect(el().querySelector('[data-entity-page-footer] [data-entity-page-save]')).toBeTruthy();
    });

    it('passes the create prefill (route data or function input) to the form, not to edit forms', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new', entityFormInitialValues: { host: 'h' } });
      expect(stubForm().initialValues()).toEqual({ host: 'h' });

      TestBed.resetTestingModule();
      dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
      await create({ ckTypeId: 'System.Communication/SftpConfiguration', entityFormInitialValues: { host: 'h' } }, { rtId: 'r1' });
      expect(stubForm().initialValues()).toBeNull();
    });

    it('calls an initialValues function with the concrete type', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      const fn = vi.fn().mockReturnValue({ port: 22 });
      await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new', entityFormInitialValues: fn });
      expect(fn).toHaveBeenCalledWith({ ckTypeId: 'System.Communication/SftpConfiguration' });
      expect(stubForm().initialValues()).toEqual({ port: 22 });
    });

    it('patchFormValues delegates to the open form, and does nothing on the list', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      await create({ ckTypeId: 'System.Communication/SftpConfiguration' });
      expect(component.patchFormValues({ host: 'x' })).toEqual([]);

      TestBed.resetTestingModule();
      dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
      await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
      expect(component.patchFormValues({ host: 'x' })).toEqual(['host']);
      expect(stubForm().patched).toEqual([{ host: 'x' }]);
    });

    it('translates the list title and the breadcrumb with the label resolver', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      await create({ ckTypeId: 'System.Communication/SftpConfiguration' });
      fixture.componentRef.setInput('labelResolver', (r: { kind: string }) => (r.kind === 'formTitle' ? 'SFTP-Konfigurationen' : null));
      fixture.detectChanges();
      expect(api.listTitle()).toBe('SFTP-Konfigurationen');
    });

    it('updates the breadcrumb labels when the label resolver language changes', async () => {
      const lang = signal('en');
      formService.resolve.mockResolvedValue(makeModel());
      dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
      await create({ ckTypeId: 'System.Communication/SftpConfiguration' }, { rtId: 'r1' });
      fixture.componentRef.setInput('labelResolver', (r: { kind: string }) =>
        lang() === 'de' && r.kind === 'formTitle' ? 'SFTP-Konfigurationen' : null);
      fixture.detectChanges();
      expect(breadCrumbs.updateBreadcrumbLabels).toHaveBeenLastCalledWith({ entityFormTitle: 'SFTP configurations', entityName: 'Main SFTP' });
      lang.set('de');
      fixture.detectChanges();
      expect(breadCrumbs.updateBreadcrumbLabels).toHaveBeenLastCalledWith({ entityFormTitle: 'SFTP-Konfigurationen', entityName: 'Main SFTP' });
    });

    it('uses the create title as breadcrumb entity name on the create form', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      await create({ ckTypeId: 'System.Communication/SftpConfiguration', rtId: 'new', messages: { createTitle: 'Neu' } });
      expect(breadCrumbs.updateBreadcrumbLabels).toHaveBeenLastCalledWith({ entityFormTitle: 'SFTP configurations', entityName: 'Neu' });
    });

    describe('beforeSave', () => {
      const CK = 'System.Communication/SftpConfiguration';
      const notifications = () => TestBed.inject(NotificationDisplayService) as unknown as Record<string, ReturnType<typeof vi.fn>>;

      async function openEdit(data: Record<string, unknown> = {}, extraProviders: unknown[] = []): Promise<void> {
        formService.resolve.mockResolvedValue(makeModel());
        dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: CK, state: STATE });
        dataService.update.mockResolvedValue(undefined as never);
        await create({ ckTypeId: CK, ...data }, { rtId: 'r1' }, {}, false, extraProviders);
      }

      it('saves the change set returned by an async hook (input) and passes the context', async () => {
        await openEdit();
        const hook = vi.fn(async (cs: EntityFormChangeSet) => ({
          ...cs, attributes: cs.attributes.map((a) => ({ ...a, value: String(a.value).toUpperCase() })),
        }));
        fixture.componentRef.setInput('beforeSave', hook);
        expect(await component.saveChanges()).toBe(true);
        expect(hook).toHaveBeenCalledWith(stubForm().changeSet, expect.objectContaining({ mode: 'edit', ckTypeId: CK, rtId: 'r1' }));
        expect(dataService.update).toHaveBeenCalledWith('r1', CK, expect.objectContaining({ attributes: [{ attributeName: 'host', value: 'H' }] }));
      });

      it('runs on create with the singleton well-known name already in the change set', async () => {
        formService.resolveByFormKey.mockResolvedValue(makeModel({ singleton: { wellKnownName: 'MainSftp' } }));
        dataService.load.mockResolvedValue(null);
        dataService.create.mockResolvedValue('new-rt');
        const hook = vi.fn();
        await create({ formKey: 'sftp-configuration', entityFormBeforeSave: hook });
        dataService.load.mockResolvedValue({ rtId: 'new-rt', ckTypeId: CK, state: STATE });
        expect(await component.saveChanges()).toBe(true);
        expect(hook).toHaveBeenCalledWith(expect.objectContaining({ rtWellKnownName: 'MainSftp' }), expect.objectContaining({ mode: 'create' }));
        expect(hook.mock.calls[0][1]).not.toHaveProperty('rtId');
        expect(dataService.create).toHaveBeenCalled();
      });

      it('vetoes with the hook message as a warning and saves nothing', async () => {
        await openEdit({ entityFormBeforeSave: () => { throw new EntityFormSaveVeto('IBAN ungültig'); } });
        expect(await component.saveChanges()).toBe(false);
        expect(dataService.update).not.toHaveBeenCalled();
        expect(notifications()['showWarning']).toHaveBeenCalledWith('IBAN ungültig');
      });

      it('vetoes silently (null) with the saveVetoed message', async () => {
        await openEdit({ messages: { saveVetoed: 'Nicht gespeichert.' } }, [{ provide: ENTITY_FORM_BEFORE_SAVE, useValue: () => null }]);
        expect(await component.saveChanges()).toBe(false);
        expect(dataService.update).not.toHaveBeenCalled();
        expect(notifications()['showWarning']).toHaveBeenCalledWith('Nicht gespeichert.');
      });

      it('reports a failing hook as a save error and saves nothing', async () => {
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await openEdit({}, [{ provide: ENTITY_FORM_BEFORE_SAVE, useValue: () => Promise.reject(new Error('lookup failed')) }]);
        expect(await component.saveChanges()).toBe(false);
        expect(dataService.update).not.toHaveBeenCalled();
        expect(notifications()['showError']).toHaveBeenCalledWith('The changes could not be saved.', 'lookup failed');
        expect(errorLog.mock.calls.flat().map(String).join(' ')).not.toContain('"host"');
        errorLog.mockRestore();
      });

      it('prefers the input over route data over the token', async () => {
        const token = vi.fn();
        const data = vi.fn();
        await openEdit({ entityFormBeforeSave: data }, [{ provide: ENTITY_FORM_BEFORE_SAVE, useValue: token }]);
        await component.saveChanges();
        expect(data).toHaveBeenCalledTimes(1);
        expect(token).not.toHaveBeenCalled();
        const bound = vi.fn();
        fixture.componentRef.setInput('beforeSave', bound);
        await component.saveChanges();
        expect(bound).toHaveBeenCalledTimes(1);
        expect(data).toHaveBeenCalledTimes(1);
      });

      it('skips the hook when an edit has no changes', async () => {
        const hook = vi.fn();
        await openEdit({ entityFormBeforeSave: hook });
        stubForm().changeSet = { attributes: [], associations: [], isEmpty: true };
        expect(await component.saveChanges()).toBe(true);
        expect(hook).not.toHaveBeenCalled();
      });

      it('treats a hook that empties an edit change set as "no changes"', async () => {
        await openEdit({ entityFormBeforeSave: (cs: EntityFormChangeSet) => ({ ...cs, attributes: [] }) });
        expect(await component.saveChanges()).toBe(true);
        expect(dataService.update).not.toHaveBeenCalled();
        expect(notifications()['showInfo']).toHaveBeenCalled();
      });
    });

    describe('listRowClass', () => {
      const listStub = (): StubEntityListComponent =>
        fixture.debugElement.query((d) => d.componentInstance instanceof StubEntityListComponent).componentInstance as StubEntityListComponent;

      it('passes no row class by default, the input, or route data entityListRowClass', async () => {
        formService.resolve.mockResolvedValue(makeModel());
        const fromData = () => 'from-data';
        await create({ ckTypeId: 'System.Communication/SftpConfiguration', entityListRowClass: fromData });
        expect(listStub().rowClass()).toBe(fromData);
        const fromInput = () => 'from-input';
        fixture.componentRef.setInput('listRowClass', fromInput);
        fixture.detectChanges();
        expect(listStub().rowClass()).toBe(fromInput);
      });

      it('is undefined without input and route data', async () => {
        formService.resolve.mockResolvedValue(makeModel());
        await create({ ckTypeId: 'System.Communication/SftpConfiguration' });
        expect(listStub().rowClass()).toBeUndefined();
      });
    });

    describe('dialog mode (editMode dialog)', () => {
      const CK = 'System.Communication/SftpConfiguration';
      const notifications = () => TestBed.inject(NotificationDisplayService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
      const dialog = (): HTMLElement | null => el().querySelector('[data-entity-page-dialog]');
      const listStub = (): StubEntityListComponent =>
        fixture.debugElement.query((d) => d.componentInstance instanceof StubEntityListComponent).componentInstance as StubEntityListComponent;
      interface DialogApi {
        onOpenRequested(e: { rtId: string; ckTypeId: string }): Promise<void>;
        onCreateRequested(e: { ckTypeId: string }): Promise<void>;
        onDialogCancel(): Promise<void>;
        onDelete(): Promise<void>;
        dialogOpen: () => boolean;
      }
      const dlg = () => component as unknown as DialogApi;

      async function openList(data: Record<string, unknown> = {}, withHost = false): Promise<void> {
        formService.resolve.mockResolvedValue(makeModel());
        dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: CK, state: STATE });
        dataService.update.mockResolvedValue(undefined as never);
        dataService.create.mockResolvedValue('r9');
        dataService.delete.mockResolvedValue(true);
        await create({ ckTypeId: CK, entityPageEditMode: 'dialog', ...data }, {}, {}, withHost);
      }

      async function openRow(): Promise<void> {
        await dlg().onOpenRequested({ rtId: 'r1', ckTypeId: CK });
        await settle();
      }

      it('navigates to the edit route by default (page mode unchanged)', async () => {
        formService.resolve.mockResolvedValue(makeModel());
        await create({ ckTypeId: CK });
        await dlg().onOpenRequested({ rtId: 'r1', ckTypeId: CK });
        expect(router.navigate).toHaveBeenCalledWith(['r1'], expect.anything());
        expect(dialog()).toBeNull();
      });

      it('opens the edit form in a dialog over the list without navigating', async () => {
        const resolver = () => null;
        await openList();
        fixture.componentRef.setInput('labelResolver', resolver);
        const navigations: unknown[] = [];
        component.navigate.subscribe((e) => navigations.push(e));
        await openRow();
        expect(router.navigate).not.toHaveBeenCalled();
        expect(navigations).toEqual([]);
        expect(api.view()).toBe('list');
        expect(el().querySelector('mm-entity-list')).toBeTruthy();
        expect(dialog()).toBeTruthy();
        expect(fixture.debugElement.query((d) => d.name === 'kendo-dialog').properties['title']).toBe('Edit Main SFTP');
        expect(api.mode()).toBe('edit');
        // Secret presence and the label resolver reach the form unchanged.
        expect(stubForm().state()).toEqual(STATE);
        expect(stubForm().labelResolver()).toBe(resolver);
        expect(dialog()?.querySelector('[data-entity-page-save]')).toBeTruthy();
      });

      it('puts Cancel left of the primary Save in the dialog action bar', async () => {
        await openList();
        await openRow();
        const buttons = Array.from(dialog()!.querySelectorAll('kendo-dialog-actions button'));
        const cancel = buttons.findIndex((b) => b.hasAttribute('data-entity-page-dialog-cancel'));
        const save = buttons.findIndex((b) => b.hasAttribute('data-entity-page-save'));
        expect(cancel).toBeGreaterThanOrEqual(0);
        expect(save).toBe(buttons.length - 1);
        expect(cancel).toBeLessThan(save);
      });

      it('reads the edit mode from the input and ignores it for singletons', async () => {
        formService.resolve.mockResolvedValue(makeModel());
        await create({ ckTypeId: CK });
        fixture.componentRef.setInput('editMode', 'dialog');
        expect((component as unknown as { effectiveEditMode: () => string }).effectiveEditMode()).toBe('dialog');
        (component as unknown as { baseModel: { set(v: unknown): void } }).baseModel.set(makeModel({ singleton: { wellKnownName: 'X' } }));
        expect((component as unknown as { effectiveEditMode: () => string }).effectiveEditMode()).toBe('page');
      });

      it('creates in the dialog with the prefill, then closes, reloads the list and emits saved', async () => {
        await openList({ entityFormInitialValues: { host: 'prefilled' } });
        await dlg().onCreateRequested({ ckTypeId: CK });
        await settle();
        expect(dialog()).toBeTruthy();
        expect(api.mode()).toBe('create');
        expect(stubForm().initialValues()).toEqual({ host: 'prefilled' });
        const events: unknown[] = [];
        component.saved.subscribe((e) => events.push(e));
        expect(await component.saveChanges()).toBe(true);
        await settle();
        expect(dataService.create).toHaveBeenCalled();
        expect(events).toEqual([{ kind: 'create', rtId: 'r9', ckTypeId: CK }]);
        expect(router.navigate).not.toHaveBeenCalled();
        expect(dialog()).toBeNull();
        expect(listStub().refresh).toHaveBeenCalled();
      });

      it('runs beforeSave in the dialog; a veto keeps the dialog open', async () => {
        await openList({ entityFormBeforeSave: () => null });
        await openRow();
        expect(await component.saveChanges()).toBe(false);
        await settle();
        expect(notifications()['showWarning']).toHaveBeenCalled();
        expect(dataService.update).not.toHaveBeenCalled();
        expect(dialog()).toBeTruthy();
      });

      it('updates, closes and reloads the list (no form reload)', async () => {
        await openList();
        await openRow();
        expect(await component.saveChanges()).toBe(true);
        await settle();
        expect(dataService.update).toHaveBeenCalledWith('r1', CK, expect.objectContaining({ attributes: [{ attributeName: 'host', value: 'h' }] }));
        expect(dataService.load).toHaveBeenCalledTimes(1);
        expect(dialog()).toBeNull();
        expect(listStub().refresh).toHaveBeenCalled();
      });

      it('closes on Cancel without asking when nothing changed', async () => {
        await openList();
        await openRow();
        await dlg().onDialogCancel();
        await settle();
        expect(confirmation.showYesNoConfirmationDialog).not.toHaveBeenCalled();
        expect(dialog()).toBeNull();
        expect(listStub().refresh).not.toHaveBeenCalled();
      });

      it('asks before discarding unsaved changes (Cancel / close / Escape) and keeps editing on No', async () => {
        await openList();
        await openRow();
        stubForm().dirty = true;
        expect(component.hasUnsavedChanges()).toBe(true);
        confirmation.showYesNoConfirmationDialog.mockResolvedValueOnce(false);
        await dlg().onDialogCancel();
        await settle();
        expect(confirmation.showYesNoConfirmationDialog).toHaveBeenCalledWith(
          'Unsaved changes', expect.any(String), undefined, expect.objectContaining({ yes: expect.any(String), no: expect.any(String) }));
        expect(dialog()).toBeTruthy();

        confirmation.showYesNoConfirmationDialog.mockResolvedValueOnce(true);
        await dlg().onDialogCancel();
        await settle();
        expect(dialog()).toBeNull();
        expect(dataService.update).not.toHaveBeenCalled();
        expect(component.hasUnsavedChanges()).toBe(false);
      });

      it('deletes from the dialog: emits deleted, closes and reloads without navigating', async () => {
        await openList();
        await openRow();
        const events: unknown[] = [];
        component.deleted.subscribe((e) => events.push(e));
        await dlg().onDelete();
        await settle();
        expect(events).toEqual([{ rtId: 'r1', ckTypeId: CK }]);
        expect(router.navigate).not.toHaveBeenCalled();
        expect(dialog()).toBeNull();
        expect(listStub().refresh).toHaveBeenCalled();
      });

      it('reports a missing entity as a notification and keeps the list', async () => {
        await openList();
        dataService.load.mockResolvedValue(null);
        await openRow();
        expect(notifications()['showError']).toHaveBeenCalledWith(expect.any(String));
        expect(api.view()).toBe('list');
        expect(dialog()).toBeNull();
      });

      it('gives the focus back to the element that opened the dialog', async () => {
        await openList();
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();
        try {
          await openRow();
          await dlg().onDialogCancel();
          await new Promise((resolve) => setTimeout(resolve));
          expect(document.activeElement).toBe(trigger);
        } finally {
          trigger.remove();
        }
      });

      it('renders host page actions in the dialog with the form context', async () => {
        await openList({}, true);
        await openRow();
        expect(dialog()?.querySelector('.host-action')?.textContent).toBe('form|edit|r1');
        // The list header keeps the list context.
        expect(el().querySelector('[data-entity-page-host-actions] .host-action')?.textContent).toBe('list||');
      });

      it('patchFormValues reaches the form in the dialog', async () => {
        await openList();
        await openRow();
        expect(component.patchFormValues({ host: 'x' })).toEqual(['host']);
      });
    });

    it('passes the translatable Copy ID texts to the ID button', async () => {
      formService.resolve.mockResolvedValue(makeModel());
      dataService.load.mockResolvedValue({ rtId: 'r1', ckTypeId: 'System.Communication/SftpConfiguration', state: STATE });
      await create({ ckTypeId: 'System.Communication/SftpConfiguration', messages: { copyId: 'ID kopieren', copyIdTooltip: 'Kopieren' } }, { rtId: 'r1' });
      const idInfo = fixture.debugElement.query((d) => d.name === 'mm-entity-id-info');
      expect(idInfo.properties['buttonText']).toBe('ID kopieren');
      expect(idInfo.properties['tooltip']).toBe('Kopieren');
    });
  });
});
