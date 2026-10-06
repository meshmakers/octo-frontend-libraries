import type { Mock, MockedObject } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { CkTypeSelectorDialogService } from '@meshmakers/octo-ui';
import { CommandItem } from '@meshmakers/shared-services';
import {
  ConfirmationService,
  FetchDataOptions,
  ListViewComponent,
  NotificationDisplayService,
} from '@meshmakers/shared-ui';
import { of } from 'rxjs';
import { EntityFormGetListDtoGQL } from '../graphQL/getEntityFormList';
import { ResolvedEntityForm } from '../models/entity-form.models';
import { EntityFormDataService } from '../services/entity-form-data.service';
import { EntityFormService } from '../services/entity-form.service';
import { form } from '../core/testing/factories';
import {
  EntityListDataSourceDirective,
  entityListAttributeNames,
  toEntityListRow,
} from './entity-list-data-source.directive';
import { EntityListComponent, toEntityListColumn } from './entity-list.component';
import { ENTITY_FORM_ACTION_CONFIRMATION } from '../core/action-confirmation';

function makeModel(overrides: Partial<ResolvedEntityForm> = {}): ResolvedEntityForm {
  return {
    source: 'seeded',
    rtCkTypeId: 'System.Communication/SftpConfiguration',
    formTargetCkTypeId: 'System.Communication/SftpConfiguration',
    isAbstract: false,
    includeDerivedTypes: false,
    title: 'SFTP configurations',
    capabilities: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canDuplicate: false,
      canExport: false,
      createRequiresSubtype: false,
    },
    sections: [],
    listColumns: [
      { field: 'rtWellKnownName', label: 'Well-known name', display: 'mono', kind: 'system' },
      { field: 'host', label: 'Host', display: 'text', kind: 'attribute' },
      { field: 'port', label: 'Port', display: 'text', kind: 'attribute' },
      { field: 'rtChangedDateTime', label: 'Changed', display: 'date', kind: 'system' },
    ],
    readAttributeNames: ['host', 'port', 'userName'],
    secretFields: ['password'],
    warnings: [],
    ...overrides,
  };
}

/** Protected-member view used by the spec. */
interface Testable {
  onRowClicked(rows: unknown[]): void;
}

describe('EntityListComponent', () => {
  let fixture: ComponentFixture<EntityListComponent>;
  let component: EntityListComponent;
  let confirmation: MockedObject<ConfirmationService>;
  let notifications: MockedObject<NotificationDisplayService>;
  let dataService: MockedObject<EntityFormDataService>;
  let ckTypeDialog: MockedObject<CkTypeSelectorDialogService>;
  let actionHook: Mock<(r: unknown) => Promise<boolean>>;
  let formService: { getForms: Mock<() => Promise<unknown[]>> };

  beforeEach(async () => {
    confirmation = {
      showYesNoConfirmationDialog: vi.fn().mockResolvedValue(true),
    } as unknown as MockedObject<ConfirmationService>;
    notifications = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    } as unknown as MockedObject<NotificationDisplayService>;
    dataService = {
      delete: vi.fn().mockResolvedValue(true),
    } as unknown as MockedObject<EntityFormDataService>;
    actionHook = vi.fn<(r: unknown) => Promise<boolean>>().mockResolvedValue(true);
    formService = { getForms: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]) };
    ckTypeDialog = {
      openCkTypeSelector: vi.fn(),
    } as unknown as MockedObject<CkTypeSelectorDialogService>;

    await TestBed.configureTestingModule({
      imports: [EntityListComponent],
      providers: [
        { provide: ConfirmationService, useValue: confirmation },
        { provide: NotificationDisplayService, useValue: notifications },
        { provide: EntityFormDataService, useValue: dataService },
        { provide: EntityFormService, useValue: formService },
        { provide: CkTypeSelectorDialogService, useValue: ckTypeDialog },
        { provide: ENTITY_FORM_ACTION_CONFIRMATION, useValue: (r: unknown) => actionHook(r) },
      ],
    })
      // mm-list-view is not under test here: render the host element only.
      .overrideComponent(EntityListComponent, {
        set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA], template: '<mm-list-view></mm-list-view>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EntityListComponent);
    component = fixture.componentInstance;
  });

  function setInputs(model: ResolvedEntityForm, canWrite = true): void {
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.detectChanges();
  }

  const ids = (items: CommandItem[]) => items.map((i) => i.id);

  it('appends a Type column with the short type name when asked', () => {
    setInputs(makeModel());
    const cols = () => (component as unknown as { columns: () => { field: string; displayName?: string; formatter?: (v: unknown, i: unknown) => string }[] }).columns();
    expect(cols().some((c) => c.field === 'ckTypeId')).toBe(false);
    fixture.componentRef.setInput('showTypeColumn', true);
    const type = cols().find((c) => c.field === 'ckTypeId')!;
    expect(type.displayName).toBe('Type');
    expect(type.formatter!('System.Communication/SftpConfiguration', {})).toBe('SFTP configuration');
  });

  it('labels the Type column with form titles, else a humanized type name (AB#5524)', async () => {
    formService.getForms.mockResolvedValue([
      form('System.Communication/HelmRepository', { name: 'Helm repository' }),
    ]);
    setInputs(makeModel());
    fixture.componentRef.setInput('showTypeColumn', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const type = (component as unknown as { columns: () => { field: string; formatter?: (v: unknown, i: unknown) => string }[] })
      .columns().find((c) => c.field === 'ckTypeId')!;
    expect(type.formatter!('System.Communication/HelmRepository', {})).toBe('Helm repository');
    expect(type.formatter!('System.Communication/EMailReceiverConfiguration', {})).toBe('E-mail receiver configuration');
    expect(formService.getForms).toHaveBeenCalledTimes(1);
  });

  it('offers the Copy ID submenu with RtId, CkTypeId, RtCkTypeId and RtEntityId', () => {
    setInputs(makeModel());
    const copy = component.contextMenuItems()[0];
    expect(copy.id).toBe('copyId');
    expect(ids(copy.children ?? [])).toEqual(['copyRtId', 'copyCkTypeId', 'copyRtCkTypeId', 'copyRtEntityId']);
  });

  it('copies the RtEntityId as ckTypeId@rtId', async () => {
    setInputs(makeModel());
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const item = component.copyIdMenuItem().children!.find((c) => c.id === 'copyRtEntityId')!;
    await item.onClick!({ commandItem: item, data: { rtId: 'abc123', ckTypeId: 'System.Communication/SftpConfiguration' } });
    expect(writeText).toHaveBeenCalledWith('System.Communication/SftpConfiguration@abc123');
  });

  it('shows Delete after a separator when canWrite and canDelete', () => {
    setInputs(makeModel());
    expect(ids(component.contextMenuItems())).toEqual(['copyId', 'separator1', 'delete']);
  });

  it('hides Delete without canWrite', () => {
    setInputs(makeModel(), false);
    expect(ids(component.contextMenuItems())).toEqual(['copyId']);
  });

  it('hides Delete when the form disallows delete', () => {
    const model = makeModel();
    setInputs({ ...model, capabilities: { ...model.capabilities, canDelete: false } });
    expect(ids(component.contextMenuItems())).toEqual(['copyId']);
  });

  it('hides New without canWrite or canCreate', () => {
    setInputs(makeModel(), false);
    expect(component.toolbarItems()).toEqual([]);
    const model = makeModel();
    setInputs({ ...model, capabilities: { ...model.capabilities, canCreate: false } }, true);
    expect(component.toolbarItems()).toEqual([]);
  });

  it('emits createRequested with the type itself for a concrete type', async () => {
    setInputs(makeModel());
    const emitted: string[] = [];
    component.createRequested.subscribe((e) => emitted.push(e.ckTypeId));
    await component.requestCreate();
    expect(ckTypeDialog.openCkTypeSelector).not.toHaveBeenCalled();
    expect(emitted).toEqual(['System.Communication/SftpConfiguration']);
  });

  it('opens the subtype dialog for an abstract type and emits the picked concrete type', async () => {
    const model = makeModel({
      rtCkTypeId: 'System/Configuration',
      isAbstract: true,
      capabilities: { ...makeModel().capabilities, createRequiresSubtype: true },
    });
    setInputs(model);
    ckTypeDialog.openCkTypeSelector.mockResolvedValue({
      confirmed: true,
      selectedCkType: { rtCkTypeId: 'System.Communication/SftpConfiguration', fullName: 'x', isAbstract: false },
    } as never);
    const emitted: string[] = [];
    component.createRequested.subscribe((e) => emitted.push(e.ckTypeId));

    await component.requestCreate();

    expect(ckTypeDialog.openCkTypeSelector).toHaveBeenCalledWith(
      expect.objectContaining({ derivedFromRtCkTypeId: 'System/Configuration', allowAbstract: false }),
    );
    expect(emitted).toEqual(['System.Communication/SftpConfiguration']);
  });

  it('emits nothing when the subtype dialog is cancelled', async () => {
    setInputs(makeModel({ isAbstract: true, capabilities: { ...makeModel().capabilities, createRequiresSubtype: true } }));
    ckTypeDialog.openCkTypeSelector.mockResolvedValue({ confirmed: false, selectedCkType: null });
    const emitted: unknown[] = [];
    component.createRequested.subscribe((e) => emitted.push(e));
    await component.requestCreate();
    expect(emitted).toEqual([]);
  });

  it('emits openRequested on row click', () => {
    setInputs(makeModel());
    const emitted: unknown[] = [];
    component.openRequested.subscribe((e) => emitted.push(e));
    (component as unknown as Testable).onRowClicked([{ rtId: 'r1', ckTypeId: 'A/B' }]);
    expect(emitted).toContainEqual({ rtId: 'r1', ckTypeId: 'A/B' });
  });

  it('deletes after confirmation and emits deleted', async () => {
    setInputs(makeModel());
    const deleted: unknown[] = [];
    component.deleted.subscribe((e) => deleted.push(e));
    const del = component.contextMenuItems().find((i) => i.id === 'delete')!;
    await del.onClick!({ commandItem: del, data: { rtId: 'r1', ckTypeId: 'A/B', rtWellKnownName: 'one' } });
    expect(confirmation.showYesNoConfirmationDialog).toHaveBeenCalled();
    expect(dataService.delete).toHaveBeenCalledWith([{ rtId: 'r1', ckTypeId: 'A/B' }]);
    expect(deleted).toContainEqual([{ rtId: 'r1', ckTypeId: 'A/B' }]);
  });

  it('asks the host action confirmation (production check) before the yes/no dialog (AB#5524)', async () => {
    const hook = actionHook.mockResolvedValue(false);
    setInputs(makeModel());
    const del = component.contextMenuItems().find((i) => i.id === 'delete')!;
    await del.onClick!({ commandItem: del, data: [{ rtId: 'r1', ckTypeId: 'A/B' }, { rtId: 'r2', ckTypeId: 'A/B' }] });
    expect(hook).toHaveBeenCalledWith({ action: 'delete', ckTypeId: 'A/B', count: 2, description: 'delete 2 entities' });
    expect(confirmation.showYesNoConfirmationDialog).not.toHaveBeenCalled();
    expect(dataService.delete).not.toHaveBeenCalled();

    hook.mockResolvedValue(true);
    await del.onClick!({ commandItem: del, data: { rtId: 'r1', ckTypeId: 'A/B' } });
    expect(confirmation.showYesNoConfirmationDialog).toHaveBeenCalled();
    expect(dataService.delete).toHaveBeenCalledWith([{ rtId: 'r1', ckTypeId: 'A/B' }]);
  });

  it('does not delete when the confirmation is declined', async () => {
    setInputs(makeModel());
    confirmation.showYesNoConfirmationDialog.mockResolvedValue(false);
    const del = component.contextMenuItems().find((i) => i.id === 'delete')!;
    await del.onClick!({ commandItem: del, data: { rtId: 'r1', ckTypeId: 'A/B' } });
    expect(dataService.delete).not.toHaveBeenCalled();
  });

  it('uses the yes/no messages for boolean columns of the list', () => {
    setInputs(makeModel({
      listColumns: [{ field: 'enabled', label: 'Enabled', display: 'text', kind: 'attribute', valueType: 'BOOLEAN' }],
    }));
    fixture.componentRef.setInput('messages', { toggleOn: 'Ja', toggleOff: 'Nein' });
    const column = (component as unknown as { columns: () => { field: string; formatter?: (v: unknown, i: unknown) => string }[] })
      .columns().find((c) => c.field === 'enabled')!;
    expect(column.formatter!(true, {})).toBe('Ja');
  });
});

describe('entity list helpers', () => {
  it('maps display modes onto list-view data types', () => {
    expect(toEntityListColumn({ field: 'a', label: 'A', display: 'chip', kind: 'attribute' }).dataType).toBe('badge');
    expect(toEntityListColumn({ field: 'a', label: 'A', display: 'date', kind: 'system' }).dataType).toBe('iso8601');
    expect(toEntityListColumn({ field: 'a', label: 'A', display: 'text', kind: 'attribute' }).dataType).toBe('text');
    const mono = toEntityListColumn({ field: 'a', label: 'A', display: 'mono', kind: 'attribute' });
    expect(mono.dataType).toBe('component');
    expect(mono.cellInputs!({ a: 'x' })).toEqual({ value: 'x' });
  });

  it('formats enum, boolean and date cells by CK value type (AB#5547)', () => {
    const enumOptions = [{ key: 0, name: 'Release' }, { key: 1, name: 'Dev' }];
    const chip = toEntityListColumn({ field: 'channel', label: 'Channel', display: 'chip', kind: 'attribute', valueType: 'ENUM', enumOptions });
    expect(chip.dataType).toBe('badge');
    expect(chip.badgeMapping!['0'].label).toBe('Release');
    expect(chip.badgeMapping!['1'].label).toBe('Dev');
    expect(chip.badgeMapping!['Dev'].label).toBe('Dev');

    const text = toEntityListColumn({ field: 'channel', label: 'Channel', display: 'text', kind: 'attribute', valueType: 'ENUM', enumOptions });
    expect(text.formatter!(1, {})).toBe('Dev');
    expect(text.formatter!(7, {})).toBe('7');
    expect(text.formatter!(null, {})).toBe('');

    const flag = toEntityListColumn({ field: 'enabled', label: 'Enabled', display: 'text', kind: 'attribute', valueType: 'BOOLEAN' }, { yes: 'Ja', no: 'Nein' });
    expect(flag.formatter!(true, {})).toBe('Ja');
    expect(flag.formatter!(false, {})).toBe('Nein');
    const flagChip = toEntityListColumn({ field: 'enabled', label: 'Enabled', display: 'chip', kind: 'attribute', valueType: 'BOOLEAN' });
    expect(flagChip.badgeMapping!['true'].label).toBe('Yes');
    expect(flagChip.badgeMapping!['false'].label).toBe('No');

    const mono = toEntityListColumn({ field: 'channel', label: 'Channel', display: 'mono', kind: 'attribute', valueType: 'ENUM', enumOptions });
    expect(mono.cellInputs!({ channel: 0 })).toEqual({ value: 'Release' });

    const date = toEntityListColumn({ field: 'validUntil', label: 'Valid until', display: 'date', kind: 'attribute', valueType: 'DATE_TIME' });
    expect(date.dataType).toBe('iso8601');

    // Strings keep the plain text column without a formatter.
    expect(toEntityListColumn({ field: 'url', label: 'URL', display: 'text', kind: 'attribute', valueType: 'STRING' }).formatter).toBeUndefined();
  });

  it('reads only non-secret attribute columns', () => {
    const model = makeModel({
      listColumns: [
        { field: 'rtWellKnownName', label: 'W', display: 'text', kind: 'system' },
        { field: 'host', label: 'Host', display: 'text', kind: 'attribute' },
        { field: 'password', label: 'Password', display: 'text', kind: 'attribute' },
      ],
    });
    expect(entityListAttributeNames(model)).toEqual(['host']);
  });

  it('flattens attributes onto the row without overwriting system properties', () => {
    const row = toEntityListRow(
      {
        rtId: 'r1',
        ckTypeId: 'A/B',
        rtWellKnownName: 'w',
        rtDisplayName: 'd',
        rtChangedDateTime: '2026-01-01T00:00:00Z',
        attributes: { items: [{ attributeName: 'host', value: 'h' }, { attributeName: 'rtId', value: 'evil' }] },
      } as never,
      'A/B',
    );
    expect(row.rtId).toBe('r1');
    expect(row['host']).toBe('h');
    expect(row.rtChangedDateTime).toBe('2026-01-01T00:00:00Z');
  });
});

describe('EntityListDataSourceDirective', () => {
  let directive: EntityListDataSourceDirective;
  let gql: { fetch: ReturnType<typeof vi.fn> };
  const options: FetchDataOptions = { state: { skip: 0, take: 20 }, textSearch: null };

  beforeEach(() => {
    gql = {
      fetch: vi.fn().mockReturnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              totalCount: 1,
              items: [{ rtId: 'r1', ckTypeId: 'A/B', attributes: { items: [{ attributeName: 'host', value: 'h' }] } }],
            },
          },
        },
      })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ListViewComponent, useValue: {} },
        { provide: EntityFormGetListDtoGQL, useValue: gql },
      ],
    });
    directive = TestBed.runInInjectionContext(() => new EntityListDataSourceDirective());
  });

  it('adds the ckTypeId EQUALS filter for the exact type and always sends attributeNames', () => {
    directive.setModel(makeModel());
    const vars = directive.buildVariables(options)!;
    expect(vars['attributeNames']).toEqual(['host', 'port']);
    expect(vars['fieldFilters']).toContainEqual({
      attributePath: 'ckTypeId',
      operator: FieldFilterOperatorsDto.EqualsDto,
      comparisonValue: 'System.Communication/SftpConfiguration',
    });
  });

  it('omits the type filter for abstract types and includeDerivedTypes forms', () => {
    directive.setModel(makeModel({ isAbstract: true }));
    expect(directive.buildVariables(options)!['fieldFilters']).toBeNull();
    directive.setModel(makeModel({ includeDerivedTypes: true }));
    expect(directive.buildVariables(options)!['fieldFilters']).toBeNull();
  });

  it('never queries a secret even if the model lists it as a column', () => {
    directive.setModel(makeModel({
      listColumns: [{ field: 'password', label: 'P', display: 'text', kind: 'attribute' }],
    }));
    expect(directive.buildVariables(options)!['attributeNames']).toEqual([]);
  });

  it('returns flattened rows', async () => {
    directive.setModel(makeModel());
    const result = await new Promise<{ data: unknown[]; totalCount: number } | null>((resolve) =>
      directive.fetchData(options).subscribe((r) => resolve(r as never)));
    expect(result?.totalCount).toBe(1);
    expect(result?.data[0]).toEqual(expect.objectContaining({ rtId: 'r1', host: 'h' }));
    expect(gql.fetch).toHaveBeenCalled();
  });
});
