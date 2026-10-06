import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogRef } from '@progress/kendo-angular-dialog';
import type { CkAttributeInfo, CkRecordInfo } from '../../models/entity-form.models';
import { EntityFormRecordRowDialogComponent } from './entity-form-record-row-dialog.component';

function attr(attributeName: string, valueType: string, extra: Partial<CkAttributeInfo> = {}): CkAttributeInfo {
  return { attributeName, valueType, isOptional: false, defaultValues: [], secret: false, ...extra };
}

const RECORD: CkRecordInfo = {
  ckRecordId: 'System.UI/EntityFormSection-1',
  attributes: [
    attr('key', 'STRING'),
    attr('title', 'STRING'),
    attr('order', 'INT'),
    attr('collapsed', 'BOOLEAN'),
    attr('children', 'RECORD_ARRAY', { ckRecordId: 'X/Child-1' })
  ]
};

describe('EntityFormRecordRowDialogComponent', () => {
  let fixture: ComponentFixture<EntityFormRecordRowDialogComponent>;
  let component: EntityFormRecordRowDialogComponent;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EntityFormRecordRowDialogComponent],
      providers: [{ provide: DialogRef, useValue: { close } }]
    }).compileComponents();
    fixture = TestBed.createComponent(EntityFormRecordRowDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('record', RECORD);
  });

  it('creates one control per editable sub-field; nested records get none and are shown read-only', () => {
    fixture.componentRef.setInput('row', { key: 'a', children: [{ x: 1 }] });
    fixture.detectChanges();
    expect(Object.keys(component.form().controls)).toEqual(['key', 'title', 'order', 'collapsed']);
    const nested = (fixture.nativeElement as HTMLElement).querySelector('[data-attribute="children"] .mm-efr-readonly');
    expect(nested?.textContent).toContain('Nested entries cannot be edited here.');
  });

  it('no sub-field is required, although the CK reports isOptional=false for all of them', () => {
    fixture.detectChanges();
    expect(component.form().valid).toBe(true);
    for (const control of Object.values(component.form().controls)) {
      control.setValue(null);
    }
    expect(component.form().valid).toBe(true);
  });

  it('prefills from the row and returns a flat camelCase dict, keeping the nested value', () => {
    fixture.componentRef.setInput('row', { key: 'a', title: 'Old', order: 1, children: [{ x: 1 }] });
    fixture.detectChanges();
    expect(component.form().controls['title'].value).toBe('Old');

    component.form().controls['title'].setValue('New');
    component.form().controls['order'].setValue(2);
    component.form().controls['key'].setValue('');

    expect(component.result()).toEqual({ title: 'New', order: 2, children: [{ x: 1 }] });
  });

  it('Apply closes the dialog with the row, Cancel with undefined', () => {
    fixture.componentRef.setInput('row', null);
    fixture.detectChanges();
    component.form().controls['key'].setValue('k');
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith({ key: 'k' });

    (el.querySelector('button[type="button"]') as HTMLButtonElement).click();
    expect(close).toHaveBeenLastCalledWith(undefined);
  });

  it('read-only disables every control and offers no Apply button', () => {
    fixture.componentRef.setInput('row', { key: 'a' });
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    expect(Object.values(component.form().controls).every(c => c.disabled)).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]')).toBeNull();
  });

  describe('SECRET members (AB#5528)', () => {
    const SECRET_RECORD: CkRecordInfo = { ckRecordId: 'Test/Endpoint-1', attributes: [attr('key', 'STRING'), attr('token', 'SECRET')] };
    const stored = { isSet: true, keyMissing: false, setAt: null };

    beforeEach(() => fixture.componentRef.setInput('record', SECRET_RECORD));

    it('shows the badge instead of "unsupported" and an empty write-only input', () => {
      fixture.componentRef.setInput('row', { key: 'a', token: stored });
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const field = host.querySelector('[data-attribute="token"]') as HTMLElement;
      expect(field.querySelector('.mm-efr-secret-badge')?.textContent?.trim()).toBe('Set');
      expect(field.textContent).not.toContain('This value cannot be edited here.');
      const input = field.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input.value).toBe('');
      expect(component.form().controls['token'].value).toBeNull();
    });

    it('keeps the stored secret when left empty and sends a typed value', () => {
      fixture.componentRef.setInput('row', { key: 'a', token: stored });
      fixture.detectChanges();
      expect(component.result()).toEqual({ key: 'a', token: stored });
      component.form().controls['token'].setValue('new-token');
      expect(component.result()).toEqual({ key: 'a', token: 'new-token' });
    });

    it('read-only users see the badge only', () => {
      fixture.componentRef.setInput('row', { key: 'a', token: { isSet: false } });
      fixture.componentRef.setInput('readOnly', true);
      fixture.detectChanges();
      const field = (fixture.nativeElement as HTMLElement).querySelector('[data-attribute="token"]') as HTMLElement;
      expect(field.querySelector('.mm-efr-secret-badge')?.textContent?.trim()).toBe('Not set');
      expect(field.querySelector('input')).toBeNull();
    });
  });
});
