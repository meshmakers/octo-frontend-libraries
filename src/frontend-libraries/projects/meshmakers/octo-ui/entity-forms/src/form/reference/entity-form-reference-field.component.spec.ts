import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { of } from 'rxjs';
import { EntityFormGetReferenceOptionsDtoGQL } from '../../graphQL/getEntityFormReferenceOptions';
import { EntityFormGetReferenceOptionsWithAttributesDtoGQL } from '../../graphQL/getEntityFormReferenceOptionsWithAttributes';
import { EntityFormReferenceFieldComponent, EntityFormReferenceValue } from './entity-form-reference-field.component';
import { EntityReferenceDataSource } from './entity-reference-data-source';

/** Stand-in for shared-ui `mm-entity-select-input`; the field only listens to its pick events. */
@Component({ selector: 'mm-entity-select-input', standalone: true, template: '' })
class EntitySelectInputStubComponent {
  readonly dataSource = input<unknown>();
  readonly dialogDataSource = input<unknown>();
  readonly multiSelect = input(false);
  readonly minSearchLength = input(3);
  readonly placeholder = input('');
  readonly dialogTitle = input('');
  readonly entitySelected = output<unknown>();
  readonly entitiesSelected = output<unknown[]>();
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EntityFormReferenceFieldComponent],
  template: `<mm-entity-form-reference-field [formControl]="control" [targetCkTypeId]="target"
                                             [multiple]="multiple" [readOnly]="readOnly"></mm-entity-form-reference-field>`
})
class HostComponent {
  control = new FormControl<EntityFormReferenceValue[]>([], { nonNullable: true });
  target = 'System.Communication/HelmRepository';
  multiple = false;
  readOnly = false;
}

const A = { rtId: 'a', ckTypeId: 'T/X', displayName: 'Alpha', rtWellKnownName: 'alpha' };
const B = { rtId: 'b', ckTypeId: 'T/X', displayName: 'Beta' };
const C = { rtId: 'c', ckTypeId: 'T/Y', displayName: 'Gamma' };

describe('EntityFormReferenceFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let field: EntityFormReferenceFieldComponent;

  async function setup(opts: { multiple?: boolean; readOnly?: boolean; value?: EntityFormReferenceValue[] } = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: EntityFormGetReferenceOptionsDtoGQL, useValue: { fetch: vi.fn().mockReturnValue(of({ data: null })) } },
        { provide: EntityFormGetReferenceOptionsWithAttributesDtoGQL, useValue: { fetch: vi.fn().mockReturnValue(of({ data: null })) } }
      ]
    })
      .overrideComponent(EntityFormReferenceFieldComponent, {
        remove: { imports: [EntitySelectInputComponent] },
        add: { imports: [EntitySelectInputStubComponent] }
      })
      .compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.multiple = opts.multiple ?? false;
    host.readOnly = opts.readOnly ?? false;
    if (opts.value) {
      host.control.setValue(opts.value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    field = fixture.debugElement.children[0].componentInstance as EntityFormReferenceFieldComponent;
  }

  describe('single selection', () => {
    beforeEach(() => setup());

    it('stores a pick as a one-element array of {rtId, ckTypeId, displayName}', () => {
      field.onPicked([A]);
      expect(host.control.value).toEqual([{ rtId: 'a', ckTypeId: 'T/X', displayName: 'Alpha' }]);
      expect(host.control.dirty).toBe(true);
    });

    it('a second pick replaces the first; the value never exceeds one entry', () => {
      field.onPicked([A]);
      field.onPicked([B]);
      expect(host.control.value).toEqual([{ rtId: 'b', ckTypeId: 'T/X', displayName: 'Beta' }]);
    });

    it('a multi-pick from the dialog keeps only the first entity', () => {
      field.onPicked([B, C]);
      expect(host.control.value.map(v => v.rtId)).toEqual(['b']);
    });

    it('reports maxItems when a written value has more than one entry', () => {
      host.control.setValue([A, B]);
      host.control.updateValueAndValidity();
      expect(host.control.errors).toEqual({ maxItems: expect.objectContaining({ max: 1, actual: 2 }) });
    });

    it('remove clears the selection to an empty array', () => {
      field.onPicked([A]);
      field.remove('a');
      expect(host.control.value).toEqual([]);
    });

    it('passes multiSelect=false and a secret-safe data source to the select input', () => {
      const stub = fixture.debugElement.query(d => d.componentInstance instanceof EntitySelectInputStubComponent)
        .componentInstance as EntitySelectInputStubComponent;
      expect(stub.multiSelect()).toBe(false);
      expect(stub.dataSource()).toBeInstanceOf(EntityReferenceDataSource);
      expect((stub.dataSource() as EntityReferenceDataSource).targetCkTypeId).toBe('System.Communication/HelmRepository');
      expect(stub.dialogDataSource()).toBe(stub.dataSource());
    });

    it('renders the selected display name', () => {
      field.onPicked([A]);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.mm-efref-name')?.textContent).toContain('Alpha');
    });
  });

  describe('multiple selection', () => {
    beforeEach(() => setup({ multiple: true, value: [{ rtId: 'a', ckTypeId: 'T/X', displayName: 'Alpha' }] }));

    it('appends picks and de-duplicates by rtId', () => {
      field.onPicked([B, A]);
      field.onPicked([C]);
      expect(host.control.value.map(v => v.rtId)).toEqual(['a', 'b', 'c']);
      expect(host.control.valid).toBe(true);
    });

    it('does not emit when a pick adds nothing new', () => {
      const spy = vi.fn();
      host.control.valueChanges.subscribe(spy);
      field.onPicked([A]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('removes a single entry', () => {
      field.onPicked([B]);
      field.remove('a');
      expect(host.control.value.map(v => v.rtId)).toEqual(['b']);
    });

    it('passes multiSelect=true to the select input', () => {
      const stub = fixture.debugElement.query(d => d.componentInstance instanceof EntitySelectInputStubComponent)
        .componentInstance as EntitySelectInputStubComponent;
      expect(stub.multiSelect()).toBe(true);
    });
  });

  describe('read-only and disabled', () => {
    it('readOnly ignores picks and removals and hides the picker', async () => {
      await setup({ readOnly: true, value: [{ rtId: 'a', ckTypeId: 'T/X', displayName: 'Alpha' }] });
      field.onPicked([B]);
      field.remove('a');
      expect(host.control.value.map(v => v.rtId)).toEqual(['a']);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('mm-entity-select-input')).toBeNull();
      expect(el.querySelector('.mm-efref-remove')).toBeNull();
    });

    it('a disabled control behaves like read-only', async () => {
      await setup();
      host.control.disable();
      fixture.detectChanges();
      field.onPicked([A]);
      expect(host.control.value).toEqual([]);
    });
  });
});
