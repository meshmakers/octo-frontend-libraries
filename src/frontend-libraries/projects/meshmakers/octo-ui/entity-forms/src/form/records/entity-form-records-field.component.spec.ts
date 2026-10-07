import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DialogCloseResult, DialogService } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import type { CkRecordInfo } from '../../models/entity-form.models';
import { EntityFormService } from '../../services/entity-form.service';
import { EntityFormRecordColumn, EntityFormRecordsFieldComponent } from './entity-form-records-field.component';
import { EntityFormRecordRowDialogComponent } from './entity-form-record-row-dialog.component';

type Row = Record<string, unknown>;

/** Protected-member view used by the spec. */
interface Testable {
  openRowDialog(row: Row | null): Promise<Row | undefined>;
  cellText(row: Row, path: string): string;
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EntityFormRecordsFieldComponent],
  template: `<mm-entity-form-records-field [formControl]="control" [ckRecordId]="recordId" [columns]="columns"
                                           [single]="single" [readOnly]="readOnly"></mm-entity-form-records-field>`
})
class HostComponent {
  control = new FormControl<Row[]>([], { nonNullable: true });
  recordId = 'System.UI/EntityFormSection-1';
  columns: EntityFormRecordColumn[] = [];
  single = false;
  readOnly = false;
}

const RECORD: CkRecordInfo = {
  ckRecordId: 'System.UI/EntityFormSection-1',
  attributes: [
    { attributeName: 'key', valueType: 'STRING', isOptional: false, defaultValues: [], secret: false },
    { attributeName: 'title', valueType: 'STRING', isOptional: false, defaultValues: [], secret: false },
    { attributeName: 'order', valueType: 'INT', isOptional: false, defaultValues: [], secret: false }
  ]
};

describe('EntityFormRecordsFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let field: EntityFormRecordsFieldComponent;
  let dialogStub: ReturnType<typeof vi.fn>;
  let getCkRecord: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;

  async function setup(opts: { single?: boolean; readOnly?: boolean; value?: Row[]; columns?: EntityFormRecordColumn[] } = {}): Promise<void> {
    getCkRecord = vi.fn().mockResolvedValue(RECORD);
    dialogOpen = vi.fn();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: EntityFormService, useValue: { getCkRecord } }
      ]
    })
      // Kendo modules imported by the component bring their own DialogService; override it everywhere.
      .overrideProvider(DialogService, { useValue: { open: dialogOpen } })
      .compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.single = opts.single ?? false;
    host.readOnly = opts.readOnly ?? false;
    host.columns = opts.columns ?? [];
    if (opts.value) {
      host.control.setValue(opts.value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    field = fixture.debugElement.children[0].componentInstance as EntityFormRecordsFieldComponent;
    dialogStub = vi.spyOn(field as unknown as Testable, 'openRowDialog');
  }

  const keys = (): unknown[] => host.control.value.map(r => r['key']);

  describe('list editing', () => {
    beforeEach(() => setup({ value: [{ key: 'a', order: 1 }, { key: 'b', order: 2 }, { key: 'c', order: 3 }] }));

    it('loads the record metadata through EntityFormService.getCkRecord', () => {
      expect(getCkRecord).toHaveBeenCalledWith('System.UI/EntityFormSection-1');
      expect(field.record()).toBe(RECORD);
    });

    it('derives grid columns from the record when the form lists none', () => {
      expect(field.effectiveColumns()).toEqual([
        { path: 'key', label: 'Key' }, { path: 'title', label: 'Title' }, { path: 'order', label: 'Order' }
      ]);
      const t = field as unknown as Testable;
      expect(t.cellText({ Key: 'a', order: 1 }, 'key')).toBe('a');
      expect(t.cellText({ order: 1 }, 'title')).toBe('');
    });

    it('add appends the row returned by the dialog as a flat dict', async () => {
      dialogStub.mockResolvedValue({ key: 'd', title: 'Delta' });
      await field.addRow();
      expect(dialogStub).toHaveBeenCalledWith(null);
      expect(host.control.value[3]).toEqual({ key: 'd', title: 'Delta' });
      expect(host.control.dirty).toBe(true);
    });

    it('a cancelled add changes nothing', async () => {
      dialogStub.mockResolvedValue(undefined);
      await field.addRow();
      expect(keys()).toEqual(['a', 'b', 'c']);
    });

    it('edit replaces the row in place', async () => {
      dialogStub.mockResolvedValue({ key: 'B', order: 2 });
      await field.editRow(1);
      expect(dialogStub).toHaveBeenCalledWith({ key: 'b', order: 2 });
      expect(keys()).toEqual(['a', 'B', 'c']);
    });

    it('remove deletes the row at the index', () => {
      field.removeRow(0);
      expect(keys()).toEqual(['b', 'c']);
    });

    it('move up / move down reorder and ignore the edges', () => {
      field.moveUp(2);
      expect(keys()).toEqual(['a', 'c', 'b']);
      field.moveDown(0);
      expect(keys()).toEqual(['c', 'a', 'b']);
      field.moveUp(0);
      field.moveDown(2);
      expect(keys()).toEqual(['c', 'a', 'b']);
    });

    it('emits copies, never the internal rows', () => {
      field.removeRow(2);
      const emitted = host.control.value;
      emitted[0]['key'] = 'mutated';
      expect(field.getValue()[0]['key']).toBe('a');
    });
  });

  describe('single record', () => {
    it('allows one row only: add is disabled and ignored once a row exists', async () => {
      await setup({ single: true });
      dialogStub.mockResolvedValue({ key: 'only' });
      expect(field.canAdd()).toBe(true);
      await field.addRow();
      expect(keys()).toEqual(['only']);

      expect(field.canAdd()).toBe(false);
      await field.addRow();
      expect(dialogStub).toHaveBeenCalledTimes(1);
      expect(host.control.value.length).toBe(1);
      fixture.detectChanges();
      expect(((fixture.nativeElement as HTMLElement).querySelector('.mm-efrec-add') as HTMLButtonElement).disabled).toBe(true);
    });

    it('after removing the row, add is possible again', async () => {
      await setup({ single: true, value: [{ key: 'x' }] });
      field.removeRow(0);
      expect(field.canAdd()).toBe(true);
    });

    it('tolerates a bare dict written for a single RECORD', async () => {
      await setup({ single: true });
      host.control.setValue({ key: 'x' } as unknown as Row[]);
      expect(field.getValue()).toEqual([{ key: 'x' }]);
    });
  });

  describe('read-only', () => {
    beforeEach(() => setup({ readOnly: true, value: [{ key: 'a' }, { key: 'b' }], columns: [{ path: 'key', label: 'Key' }] }));

    it('ignores add / remove / move and does not apply dialog results', async () => {
      dialogStub.mockResolvedValue({ key: 'z' });
      await field.addRow();
      field.removeRow(0);
      field.moveDown(0);
      await field.editRow(0);
      expect(keys()).toEqual(['a', 'b']);
    });

    it('names the view buttons after the row (AB#5581 guard)', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.mm-efrec-actions button')!.getAttribute('aria-label')).toBe('Details row 1');
      expectIconButtonsAccessible(fixture);
    });

    it('shows no toolbar and no edit buttons', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.mm-efrec-add')).toBeNull();
      expect(el.querySelector('.mm-efrec-remove')).toBeNull();
    });
  });

  describe('row buttons (AB#5579)', () => {
    beforeEach(() => setup({ value: [{ key: 'a' }, { key: 'b' }] }));

    it('names every icon-only row button after its row; Remove is danger-styled (AB#5581 guard)', () => {
      const el = fixture.nativeElement as HTMLElement;
      const removes = el.querySelectorAll<HTMLElement>('.mm-efrec-remove');
      expect(removes[1].getAttribute('aria-label')).toBe('Remove row 2');
      expect(removes[1].getAttribute('title')).toBe('Remove');
      expect(removes[1].className).toMatch(/k-button-[a-z-]*error/);
      expectIconButtonsAccessible(fixture);
    });
  });

  describe('row dialog', () => {
    it('opens the row dialog with the record metadata and maps a close result to undefined', async () => {
      await setup({ value: [{ key: 'a' }] });
      dialogStub.mockRestore();
      const result = new Subject<unknown>();
      const setInput = vi.fn();
      dialogOpen.mockReturnValue({ content: { setInput }, result: result.asObservable() });

      const pending = field.editRow(0);
      await Promise.resolve();
      await Promise.resolve();
      expect(dialogOpen).toHaveBeenCalledWith(expect.objectContaining({ content: EntityFormRecordRowDialogComponent }));
      expect(setInput).toHaveBeenCalledWith('record', RECORD);
      expect(setInput).toHaveBeenCalledWith('row', { key: 'a' });
      expect(setInput).toHaveBeenCalledWith('readOnly', false);

      result.next(new DialogCloseResult());
      result.complete();
      await pending;
      expect(keys()).toEqual(['a']);
    });
  });
});
