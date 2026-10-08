import type { Mock, MockedObject } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA, Directive, forwardRef, inject } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldFilterOperatorsDto, SortOrdersDto } from '@meshmakers/octo-services';
import { CkTypeSelectorDialogService } from '@meshmakers/octo-ui';
import { CommandItem, CommandSettingsService } from '@meshmakers/shared-services';
import {
  ConfirmationService,
  DataSourceBase,
  FetchDataOptions,
  FetchResult,
  FetchResultBase,
  ListViewComponent,
  MM_ACTION_ICONS,
  NotificationDisplayService,
} from '@meshmakers/shared-ui';
import { Observable, of } from 'rxjs';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
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
import { ENTITY_LIST_ROW_CLASS, EntityListComponent, toEntityListColumn } from './entity-list.component';
import { ENTITY_FORM_ACTION_CONFIRMATION } from '../core/action-confirmation';
import { ENTITY_FORM_UNSET_PLACEHOLDER_VALUES, entityFormUnsetPlaceholderLookup } from '../core/unset-placeholders';

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
      showDangerConfirm: vi.fn().mockResolvedValue(true),
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
    expect(del.danger).toBe(true);
    await del.onClick!({ commandItem: del, data: { rtId: 'r1', ckTypeId: 'A/B', rtWellKnownName: 'one' } });
    expect(confirmation.showDangerConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete one?',
      targetName: 'one',
      confirmText: 'Delete entity',
    }));
    expect(confirmation.showYesNoConfirmationDialog).not.toHaveBeenCalled();
    expect(dataService.delete).toHaveBeenCalledWith([{ rtId: 'r1', ckTypeId: 'A/B' }]);
    expect(deleted).toContainEqual([{ rtId: 'r1', ckTypeId: 'A/B' }]);
  });

  it('asks the host action confirmation (production check) before the danger dialog (AB#5524)', async () => {
    const hook = actionHook.mockResolvedValue(false);
    setInputs(makeModel());
    const del = component.contextMenuItems().find((i) => i.id === 'delete')!;
    await del.onClick!({ commandItem: del, data: [{ rtId: 'r1', ckTypeId: 'A/B' }, { rtId: 'r2', ckTypeId: 'A/B' }] });
    expect(hook).toHaveBeenCalledWith({ action: 'delete', ckTypeId: 'A/B', count: 2, description: 'delete 2 entities' });
    expect(confirmation.showDangerConfirm).not.toHaveBeenCalled();
    expect(dataService.delete).not.toHaveBeenCalled();

    hook.mockResolvedValue(true);
    await del.onClick!({ commandItem: del, data: { rtId: 'r1', ckTypeId: 'A/B' } });
    expect(confirmation.showDangerConfirm).toHaveBeenCalled();
    expect(dataService.delete).toHaveBeenCalledWith([{ rtId: 'r1', ckTypeId: 'A/B' }]);
  });

  it('names the count in a multi-delete danger confirmation (AB#5579)', async () => {
    setInputs(makeModel());
    const del = component.contextMenuItems().find((i) => i.id === 'delete')!;
    await del.onClick!({ commandItem: del, data: [{ rtId: 'r1', ckTypeId: 'A/B' }, { rtId: 'r2', ckTypeId: 'A/B' }] });
    expect(confirmation.showDangerConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete 2 entities?',
      targetName: '2 entities',
      confirmText: 'Delete entities',
    }));
  });

  it('uses the host danger confirmation instead of the built-in dialog when provided (AB#5579)', async () => {
    const host = vi.fn().mockResolvedValue(false);
    // The token is optional and injected at construction; stand in for a provided host hook.
    (component as unknown as { dangerConfirmation: unknown }).dangerConfirmation = host;
    setInputs(makeModel());
    const del = component.contextMenuItems().find((i) => i.id === 'delete')!;
    await del.onClick!({ commandItem: del, data: { rtId: 'r1', ckTypeId: 'A/B', name: 'Primary' } });
    expect(host).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete Primary?', targetName: 'Primary' }),
      expect.objectContaining({ action: 'delete', count: 1 }),
    );
    expect(confirmation.showDangerConfirm).not.toHaveBeenCalled();
    expect(dataService.delete).not.toHaveBeenCalled();
  });

  it('uses canonical icons for the row actions (AB#5579)', () => {
    setInputs(makeModel());
    expect(component.actionItems()[0].svgIcon).toBe(MM_ACTION_ICONS.edit);
    expect(component.contextMenuItems()[0].svgIcon).toBe(MM_ACTION_ICONS.copy);
    expect(component.contextMenuItems().find((i) => i.id === 'delete')!.svgIcon).toBe(MM_ACTION_ICONS.delete);
    setInputs(makeModel(), false);
    expect(component.actionItems()[0].svgIcon).toBe(MM_ACTION_ICONS.view);
  });

  it('does not delete when the confirmation is declined', async () => {
    setInputs(makeModel());
    confirmation.showDangerConfirm.mockResolvedValue(false);
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

  describe('host extensions (AB#5623)', () => {
    const noop = async () => undefined;

    it('appends host toolbar, row and row-menu actions; the actions column grows per row action', () => {
      setInputs(makeModel());
      fixture.componentRef.setInput('toolbarActions', [{ id: 'import', type: 'link', text: 'Import', onClick: noop }]);
      fixture.componentRef.setInput('rowActions', [{ id: 'export', type: 'link', text: 'Export', onClick: noop }]);
      fixture.componentRef.setInput('rowMenuActions', [{ id: 'archive', type: 'link', text: 'Archive', onClick: noop }]);
      expect(ids(component.toolbarItems())).toEqual(['new', 'import']);
      expect(ids(component.actionItems())).toEqual(['open', 'export']);
      expect(ids(component.contextMenuItems())).toEqual(['copyId', 'archive', 'separator1', 'delete']);
      expect((component as unknown as { actionsColumnWidth: () => number }).actionsColumnWidth()).toBe(120);
    });

    it('keeps host toolbar actions for read-only users (New is hidden)', () => {
      setInputs(makeModel(), false);
      fixture.componentRef.setInput('toolbarActions', [{ id: 'export', type: 'link', text: 'Export', onClick: noop }]);
      expect(ids(component.toolbarItems())).toEqual(['export']);
      expect((component as unknown as { actionsColumnWidth: () => number }).actionsColumnWidth()).toBe(80);
    });

    it('translates column titles and enum chips with the label resolver', () => {
      setInputs(makeModel({
        listColumns: [{ field: 'kind', label: 'Kind', display: 'chip', kind: 'attribute', valueType: 'ENUM', enumOptions: [{ key: 0, name: 'GIRO' }] }],
      }));
      fixture.componentRef.setInput('labelResolver', (r: { kind: string; key: string }) =>
        r.kind === 'listColumn' ? 'Art' : r.kind === 'enumOption' && r.key === 'GIRO' ? 'Girokonto' : null);
      const column = (component as unknown as { columns: () => { displayName?: string; badgeMapping?: Record<string, { label: string }> }[] }).columns()[0];
      expect(column.displayName).toBe('Art');
      expect(column.badgeMapping?.['0']).toEqual({ label: 'Girokonto' });
    });

    it('notifies a copy with the copiedId message (one format with the form header)', async () => {
      setInputs(makeModel());
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
      const item = component.copyIdMenuItem().children!.find((c) => c.id === 'copyRtId')!;
      await item.onClick!({ commandItem: item, data: { rtId: 'abc', ckTypeId: 'A/B' } });
      expect(notifications.showSuccess).toHaveBeenCalledWith('RtId copied', 2000);
      fixture.componentRef.setInput('messages', { copiedId: '{label} kopiert' });
      await item.onClick!({ commandItem: item, data: { rtId: 'abc', ckTypeId: 'A/B' } });
      expect(notifications.showSuccess).toHaveBeenCalledWith('RtId kopiert', 2000);
    });

    it('uses the copyFailed message when the clipboard is unavailable', async () => {
      setInputs(makeModel());
      fixture.componentRef.setInput('messages', { copyFailed: 'Kopieren fehlgeschlagen' });
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
      vi.spyOn(console, 'error').mockReturnValue(undefined);
      const item = component.copyIdMenuItem().children!.find((c) => c.id === 'copyRtId')!;
      await item.onClick!({ commandItem: item, data: { rtId: 'abc', ckTypeId: 'A/B' } });
      expect(notifications.showError).toHaveBeenCalledWith('Kopieren fehlgeschlagen');
    });

    it('prefers the defaultSort input over the form listDefaultSort', () => {
      setInputs(makeModel({ listDefaultSort: [{ field: 'host', dir: 'asc' }] }));
      const sort = () => (component as unknown as { effectiveDefaultSort: () => unknown }).effectiveDefaultSort();
      expect(sort()).toEqual([{ field: 'host', dir: 'asc' }]);
      fixture.componentRef.setInput('defaultSort', [{ field: 'port', dir: 'desc' }]);
      expect(sort()).toEqual([{ field: 'port', dir: 'desc' }]);
      fixture.componentRef.setInput('defaultSort', []);
      expect(sort()).toEqual([]);
    });

    describe('rowClass', () => {
      interface RowClassApi { listViewRowClass: () => ((c: { dataItem: unknown; index: number }) => unknown) | undefined }
      const rowClassFn = () => (component as unknown as RowClassApi).listViewRowClass();

      it('passes no row class callback by default (unchanged list)', () => {
        setInputs(makeModel());
        expect(rowClassFn()).toBeUndefined();
      });

      it('maps the row callback onto mm-list-view rowClass with the row as argument', () => {
        setInputs(makeModel());
        fixture.componentRef.setInput('rowClass', (row: Record<string, unknown>) => ({ 'row-disabled': row['enabled'] === false }));
        const fn = rowClassFn()!;
        expect(fn({ dataItem: { rtId: 'a', enabled: false }, index: 0 })).toEqual({ 'row-disabled': true });
        expect(fn({ dataItem: { rtId: 'b', enabled: true }, index: 1 })).toEqual({ 'row-disabled': false });
      });

      it('accepts string and array results and treats null as no class', () => {
        setInputs(makeModel());
        fixture.componentRef.setInput('rowClass', (row: Record<string, unknown>) =>
          row['rtId'] === 'a' ? 'one' : row['rtId'] === 'b' ? ['x', 'y'] : null);
        const fn = rowClassFn()!;
        expect(fn({ dataItem: { rtId: 'a' }, index: 0 })).toBe('one');
        expect(fn({ dataItem: { rtId: 'b' }, index: 1 })).toEqual(['x', 'y']);
        expect(fn({ dataItem: { rtId: 'c' }, index: 2 })).toEqual({});
      });

      it('logs a throwing callback and yields no class', () => {
        setInputs(makeModel());
        const error = vi.spyOn(console, 'error').mockReturnValue(undefined);
        fixture.componentRef.setInput('rowClass', () => { throw new Error('boom'); });
        expect(rowClassFn()!({ dataItem: { rtId: 'a' }, index: 0 })).toEqual({});
        expect(error).toHaveBeenCalled();
      });
    });
  });
});

describe('ENTITY_LIST_ROW_CLASS', () => {
  it('is the default row class; the input wins', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EntityListComponent],
      providers: [
        { provide: ConfirmationService, useValue: {} },
        { provide: NotificationDisplayService, useValue: {} },
        { provide: EntityFormDataService, useValue: {} },
        { provide: EntityFormService, useValue: { getForms: vi.fn().mockResolvedValue([]) } },
        { provide: ENTITY_LIST_ROW_CLASS, useValue: () => 'from-token' },
      ],
    })
      .overrideComponent(EntityListComponent, {
        set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA], template: '<mm-list-view></mm-list-view>' },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(EntityListComponent);
    fixture.componentRef.setInput('model', makeModel());
    fixture.detectChanges();
    const fn = () => (fixture.componentInstance as unknown as { listViewRowClass: () => (c: { dataItem: unknown; index: number }) => unknown })
      .listViewRowClass();
    expect(fn()({ dataItem: { rtId: 'a' }, index: 0 })).toBe('from-token');
    fixture.componentRef.setInput('rowClass', () => 'from-input');
    expect(fn()({ dataItem: { rtId: 'a' }, index: 0 })).toBe('from-input');
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

  describe('unset placeholders (AB#5623)', () => {
    const lookup = entityFormUnsetPlaceholderLookup({ global: ['TODO_SET_VALUE'], attributes: { azureTenantId: ['TODO_SET_AZURE_TENANT_ID'] } });

    it('shows "Not configured" for a placeholder in text, mono and chip cells', () => {
      const text = toEntityListColumn({ field: 'azureTenantId', label: 'Tenant', display: 'text', kind: 'attribute', valueType: 'STRING' }, {}, lookup);
      expect(text.formatter!('TODO_SET_AZURE_TENANT_ID', {})).toBe('Not configured');
      expect(text.formatter!('TODO_SET_VALUE', {})).toBe('Not configured');
      expect(text.formatter!('real-id', {})).toBe('real-id');
      expect(text.formatter!(null, {})).toBe('');

      const mono = toEntityListColumn({ field: 'clientId', label: 'Client', display: 'mono', kind: 'attribute' }, { notConfigured: 'Nicht konfiguriert' }, lookup);
      expect(mono.cellInputs!({ clientId: 'TODO_SET_VALUE' })).toEqual({ value: 'Nicht konfiguriert' });
      // Per-attribute values only match their own attribute.
      expect(mono.cellInputs!({ clientId: 'TODO_SET_AZURE_TENANT_ID' })).toEqual({ value: 'TODO_SET_AZURE_TENANT_ID' });

      const chip = toEntityListColumn({ field: 'state', label: 'State', display: 'chip', kind: 'attribute' }, {}, lookup);
      expect(chip.badgeMapping!['TODO_SET_VALUE'].label).toBe('Not configured');
    });

    it('is case-sensitive and leaves the columns unchanged without placeholders', () => {
      const text = toEntityListColumn({ field: 'clientId', label: 'Client', display: 'text', kind: 'attribute' }, {}, lookup);
      expect(text.formatter!('todo_set_value', {})).toBe('todo_set_value');
      const plain = toEntityListColumn({ field: 'clientId', label: 'Client', display: 'text', kind: 'attribute' }, {}, entityFormUnsetPlaceholderLookup(null));
      expect(plain.formatter).toBeUndefined();
    });

    it('never applies to SECRET columns or system columns', () => {
      const secret = toEntityListColumn({ field: 'token', label: 'Token', display: 'text', kind: 'attribute', valueType: 'SECRET' }, {}, lookup);
      expect(secret.formatter).toBeUndefined();
      const system = toEntityListColumn({ field: 'rtWellKnownName', label: 'WK', display: 'mono', kind: 'system' }, {}, lookup);
      expect(system.cellInputs!({ rtWellKnownName: 'TODO_SET_VALUE' })).toEqual({ value: 'TODO_SET_VALUE' });
    });

    it('mm-entity-list reads ENTITY_FORM_UNSET_PLACEHOLDER_VALUES, skips secretFields and uses the notConfigured message', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EntityListComponent],
        providers: [
          { provide: ConfirmationService, useValue: {} },
          { provide: NotificationDisplayService, useValue: {} },
          { provide: EntityFormDataService, useValue: {} },
          { provide: EntityFormService, useValue: { getForms: vi.fn().mockResolvedValue([]) } },
          { provide: ENTITY_FORM_UNSET_PLACEHOLDER_VALUES, useValue: ['TODO_SET_VALUE'] },
        ],
      })
        .overrideComponent(EntityListComponent, {
          set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA], template: '<mm-list-view></mm-list-view>' },
        })
        .compileComponents();
      const fixture = TestBed.createComponent(EntityListComponent);
      fixture.componentRef.setInput('model', makeModel({
        listColumns: [
          { field: 'host', label: 'Host', display: 'text', kind: 'attribute' },
          { field: 'password', label: 'Password', display: 'text', kind: 'attribute' },
        ],
      }));
      fixture.componentRef.setInput('messages', { notConfigured: 'Nicht konfiguriert' });
      fixture.detectChanges();
      const cols = (fixture.componentInstance as unknown as { columns: () => { field: string; formatter?: (v: unknown, i: unknown) => string }[] }).columns();
      expect(cols.find((c) => c.field === 'host')!.formatter!('TODO_SET_VALUE', {})).toBe('Nicht konfiguriert');
      expect(cols.find((c) => c.field === 'password')!.formatter).toBeUndefined();
    });
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

  it('applies the default sort until the user sorts by a column (AB#5623)', () => {
    directive.setModel(makeModel(), [{ field: 'port', dir: 'desc' }, { field: 'host', dir: 'asc' }]);
    expect(directive.buildVariables(options)!['sort']).toEqual([
      { attributePath: 'port', sortOrder: SortOrdersDto.DescendingDto },
      { attributePath: 'host', sortOrder: SortOrdersDto.AscendingDto },
    ]);
    // A cleared column sort (descriptor without direction) still counts as "not sorted".
    expect(directive.buildVariables({ ...options, state: { ...options.state, sort: [{ field: 'host' }] } })!['sort'])
      .toEqual(expect.arrayContaining([{ attributePath: 'port', sortOrder: SortOrdersDto.DescendingDto }]));
    expect(directive.buildVariables({ ...options, state: { ...options.state, sort: [{ field: 'host', dir: 'desc' }] } })!['sort'])
      .toEqual([{ attributePath: 'host', sortOrder: SortOrdersDto.DescendingDto }]);
  });

  it('keeps the server order without a default sort and refetches only on a changed default sort', () => {
    directive.setModel(makeModel());
    expect(directive.buildVariables(options)!['sort']).toBeNull();
    const fetchAgain = vi.spyOn(directive, 'fetchAgain').mockImplementation(() => undefined);
    directive.setDefaultSort([{ field: 'host', dir: 'asc' }]);
    directive.setDefaultSort([{ field: 'host', dir: 'asc' }]);
    expect(fetchAgain).toHaveBeenCalledTimes(1);
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

@Directive({
  selector: '[mmTestEntityListDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => StaticEntityListDataSourceDirective) }],
})
class StaticEntityListDataSourceDirective extends DataSourceBase {
  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    const rows = [
      { rtId: 'r1', ckTypeId: 'A/B', rtWellKnownName: 'primary', host: 'sftp.example.com' },
      { rtId: 'r2', ckTypeId: 'A/B', rtWellKnownName: 'backup', host: 'backup.example.com' },
    ];
    return of(new FetchResultBase(rows, rows.length));
  }
}

describe('EntityListComponent rendered row actions (AB#5579)', () => {
  async function render(): Promise<ComponentFixture<EntityListComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EntityListComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
        { provide: ConfirmationService, useValue: {} },
        { provide: NotificationDisplayService, useValue: {} },
        { provide: EntityFormDataService, useValue: {} },
        { provide: EntityFormService, useValue: { getForms: vi.fn().mockResolvedValue([]) } },
      ],
    })
      // The real mm-list-view with a static data source instead of the GraphQL one.
      .overrideComponent(EntityListComponent, {
        set: {
          imports: [ListViewComponent, StaticEntityListDataSourceDirective],
          template: `
            <div style="height: 600px; display: flex;">
              <mm-list-view mmTestEntityListDs style="flex: 1" [columns]="columns()"
                            [actionCommandItems]="actionItems()" [contextMenuCommandItems]="contextMenuItems()"
                            [leftToolbarActions]="toolbarItems()" rowLabelField="rtWellKnownName"></mm-list-view>
            </div>`,
        },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(EntityListComponent);
    fixture.componentRef.setInput('model', makeModel());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('names every icon-only action (AB#5581 guard)', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const edit = el.querySelector<HTMLElement>('tr.k-master-row [data-action="open"]')!;
    expect(edit.getAttribute('aria-label')).toBe('Edit primary');
    expect(edit.getAttribute('title')).toBe('Edit');
    expectIconButtonsAccessible(fixture);
  });
});
