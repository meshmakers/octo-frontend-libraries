import type { MockedObject } from 'vitest';
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
import {
  EntityListDataSourceDirective,
  entityListAttributeNames,
  toEntityListRow,
} from './entity-list-data-source.directive';
import { EntityListComponent, toEntityListColumn } from './entity-list.component';

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
    ckTypeDialog = {
      openCkTypeSelector: vi.fn(),
    } as unknown as MockedObject<CkTypeSelectorDialogService>;

    await TestBed.configureTestingModule({
      imports: [EntityListComponent],
      providers: [
        { provide: ConfirmationService, useValue: confirmation },
        { provide: NotificationDisplayService, useValue: notifications },
        { provide: EntityFormDataService, useValue: dataService },
        { provide: CkTypeSelectorDialogService, useValue: ckTypeDialog },
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

  it('does not delete when the confirmation is declined', async () => {
    setInputs(makeModel());
    confirmation.showYesNoConfirmationDialog.mockResolvedValue(false);
    const del = component.contextMenuItems().find((i) => i.id === 'delete')!;
    await del.onClick!({ commandItem: del, data: { rtId: 'r1', ckTypeId: 'A/B' } });
    expect(dataService.delete).not.toHaveBeenCalled();
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
