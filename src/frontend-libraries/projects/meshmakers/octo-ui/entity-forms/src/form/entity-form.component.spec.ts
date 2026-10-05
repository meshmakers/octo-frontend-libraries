import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import {
  EntityFormMode,
  EntityFormValueState,
  ResolvedEntityForm,
  ResolvedField,
  ResolvedSection,
} from '../models/entity-form.models';
import { EntityFormComponent } from './entity-form.component';

/** Protected-member view used by the spec. */
interface Testable {
  control(key: string): FormControl<unknown>;
}

function field(partial: Partial<ResolvedField> & { key: string }): ResolvedField {
  return {
    kind: 'attribute',
    attributeName: partial.key,
    valueType: 'STRING',
    label: partial.key,
    editor: 'text',
    required: false,
    readOnly: 'never',
    width: 'full',
    order: 0,
    secret: false,
    generated: false,
    ...partial,
  };
}

function section(key: string, fields: ResolvedField[], extra: Partial<ResolvedSection> = {}): ResolvedSection {
  return { key, title: key.toUpperCase(), columns: 1, collapsed: false, generated: false, fields, ...extra };
}

function model(sections: ResolvedSection[], canEdit = true): ResolvedEntityForm {
  return {
    source: 'tenant',
    rtCkTypeId: 'System.Communication/SftpConfiguration',
    formTargetCkTypeId: 'System.Communication/SftpConfiguration',
    isAbstract: false,
    includeDerivedTypes: false,
    title: 'SFTP',
    capabilities: { canCreate: true, canEdit, canDelete: true, canDuplicate: false, canExport: false, createRequiresSubtype: false },
    sections,
    listColumns: [],
    readAttributeNames: [],
    secretFields: [],
    warnings: [],
  };
}

/** SFTP-like form: connection (2 columns) + auth (1 column, secrets). */
function sftpModel(): ResolvedEntityForm {
  return model([
    section('connection', [
      field({ key: 'host', required: true, readOnly: 'afterCreate', width: 'half' }),
      field({ key: 'port', valueType: 'INT', editor: 'number', min: 1, max: 65535, width: 'half' }),
      field({ key: 'baseUrl', editor: 'url' }),
      field({ key: 'contact', editor: 'email' }),
      field({ key: 'code', pattern: '[A-Z]{3}' }),
      field({ key: 'options', editor: 'json' }),
    ], { columns: 2 }),
    section('auth', [
      field({ key: 'usePrivateKey', valueType: 'BOOLEAN', editor: 'toggle' }),
      field({ key: 'privateKey', editor: 'multiline', secret: true, visibleWhen: { path: 'usePrivateKey', value: 'true' } }),
      field({ key: 'password', editor: 'password', secret: true, required: true }),
      field({ key: 'privateKeyPassphrase', editor: 'password', secret: true, visibleWhen: { path: 'password', value: '*' } }),
    ]),
    section('advanced', [field({ key: 'timeout', valueType: 'INT', editor: 'number' })], { collapsed: true }),
  ]);
}

function editState(overrides: Partial<EntityFormValueState> = {}): EntityFormValueState {
  return {
    values: { host: 'sftp.example.com', port: 22, usePrivateKey: false, password: 'must-not-show' },
    secretPresence: { password: true, privateKey: false, privateKeyPassphrase: false },
    associations: {},
    ...overrides,
  };
}

describe('EntityFormComponent', () => {
  let fixture: ComponentFixture<EntityFormComponent>;
  let component: EntityFormComponent;
  let api: Testable;

  async function render(m: ResolvedEntityForm, mode: EntityFormMode, state?: EntityFormValueState, readOnly = false): Promise<void> {
    fixture.componentRef.setInput('model', m);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('readOnly', readOnly);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function fieldEl(key: string): HTMLElement | null {
    return el().querySelector(`mm-entity-form-field[data-field-key="${key}"]`);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityFormComponent],
      animationsEnabled: false,
    }).compileComponents();
    fixture = TestBed.createComponent(EntityFormComponent);
    component = fixture.componentInstance;
    api = component as unknown as Testable;
  });

  describe('layout', () => {
    it('renders sections, two-column grids and half-width fields', async () => {
      await render(sftpModel(), 'create');
      const sections = el().querySelectorAll('section.mm-ef-section');
      expect(Array.from(sections).map((s) => s.getAttribute('data-section-key'))).toEqual(['connection', 'auth', 'advanced']);
      expect(sections[0].querySelector('.mm-ef-section__grid--two')).not.toBeNull();
      expect(sections[1].querySelector('.mm-ef-section__grid--two')).toBeNull();
      expect(fieldEl('host')?.classList.contains('mm-ef-field--half')).toBe(true);
      expect(fieldEl('baseUrl')?.classList.contains('mm-ef-field--full')).toBe(true);
    });

    it('starts a collapsed section collapsed and expands it on click', async () => {
      await render(sftpModel(), 'create');
      expect(fieldEl('timeout')).toBeNull();
      const header = el().querySelector<HTMLButtonElement>('section[data-section-key="advanced"] .mm-ef-section__header');
      header?.click();
      fixture.detectChanges();
      expect(fieldEl('timeout')).not.toBeNull();
    });

    it('shows the empty notice for a form without fields', async () => {
      await render(model([]), 'create');
      expect(el().querySelector('.mm-ef-empty')?.textContent).toContain('This form has no fields.');
    });
  });

  describe('validation', () => {
    it('required, min, max, pattern, email, url and json make the form invalid', async () => {
      await render(sftpModel(), 'create');
      const valid: boolean[] = [];
      component.validChange.subscribe((v) => valid.push(v));

      api.control('host').setValue('h');
      api.control('password').setValue('secret');
      expect(component.isValid()).toBe(true);

      const cases: [string, unknown, string][] = [
        ['host', '', 'required'],
        ['port', 0, 'min'],
        ['port', 70000, 'max'],
        ['code', 'abcd', 'pattern'],
        ['contact', 'nope', 'email'],
        ['baseUrl', 'example.com', 'url'],
        ['options', '{bad', 'json'],
      ];
      for (const [key, bad, error] of cases) {
        const c = api.control(key);
        const good = c.value;
        c.setValue(bad);
        expect(c.hasError(error)).toBe(true);
        expect(component.isValid()).toBe(false);
        c.setValue(good);
      }
      expect(component.isValid()).toBe(true);
      expect(valid).toContain(false);
    });

    it('shows the error text after markAllAsTouched', async () => {
      await render(sftpModel(), 'create');
      component.markAllAsTouched();
      fixture.detectChanges();
      expect(fieldEl('host')?.querySelector('.mm-ef-field__error')?.textContent).toContain('This field is required.');
    });
  });

  describe('VisibleWhen', () => {
    it('hides the field and disables its control until the condition holds', async () => {
      await render(sftpModel(), 'create');
      expect(fieldEl('privateKey')).toBeNull();
      expect(api.control('privateKey').disabled).toBe(true);

      api.control('usePrivateKey').setValue(true);
      fixture.detectChanges();
      expect(fieldEl('privateKey')).not.toBeNull();
      expect(api.control('privateKey').enabled).toBe(true);

      api.control('usePrivateKey').setValue(false);
      fixture.detectChanges();
      expect(fieldEl('privateKey')).toBeNull();
      expect(api.control('privateKey').disabled).toBe(true);
    });

    it('a hidden field is not part of the change set', async () => {
      await render(sftpModel(), 'create');
      api.control('usePrivateKey').setValue(true);
      api.control('privateKey').setValue('-----BEGIN KEY-----');
      api.control('usePrivateKey').setValue(false);
      const names = component.getChangeSet().attributes.map((a) => a.attributeName);
      expect(names).not.toContain('privateKey');
    });

    it('Path=* on a secret source counts server-side presence as a value', async () => {
      await render(sftpModel(), 'edit', editState());
      expect(fieldEl('privateKeyPassphrase')).not.toBeNull();
    });

    it('Path=* on an unset secret source shows the field once a value is typed', async () => {
      await render(sftpModel(), 'edit', editState({ secretPresence: { password: false } }));
      expect(fieldEl('privateKeyPassphrase')).toBeNull();
      api.control('password').setValue('typed');
      fixture.detectChanges();
      expect(fieldEl('privateKeyPassphrase')).not.toBeNull();
    });
  });

  describe('secrets', () => {
    it('are never prefilled and show "set" with the keep placeholder', async () => {
      await render(sftpModel(), 'edit', editState());
      expect(api.control('password').value).toBeNull();
      const shell = fieldEl('password');
      expect(shell?.querySelector('.mm-ef-field__badge')?.getAttribute('data-secret-state')).toBe('set');
      const input = shell?.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input.placeholder).toBe('•••• set — leave empty to keep');
      expect(el().textContent).not.toContain('must-not-show');
    });

    it('show "not set" when the server has no value, and stay required', async () => {
      await render(sftpModel(), 'edit', editState({ secretPresence: { password: false } }));
      const shell = fieldEl('password');
      expect(shell?.querySelector('.mm-ef-field__badge')?.getAttribute('data-secret-state')).toBe('notSet');
      expect((shell?.querySelector('input') as HTMLInputElement).placeholder).toBe('Not set');
      expect(api.control('password').hasError('required')).toBe(true);
    });

    it('a set required secret may stay empty; empty is left out, typed is sent', async () => {
      await render(sftpModel(), 'edit', editState());
      expect(api.control('password').hasError('required')).toBe(false);
      expect(component.getChangeSet().attributes).toEqual([]);
      api.control('password').setValue('new-secret');
      expect(component.getChangeSet().attributes).toContainEqual({ attributeName: 'password', value: 'new-secret' });
    });
  });

  describe('read-only', () => {
    it('afterCreate is editable on create and read-only on edit', async () => {
      await render(sftpModel(), 'create');
      expect(api.control('host').enabled).toBe(true);
      await render(sftpModel(), 'edit', editState());
      expect(api.control('host').disabled).toBe(true);
      expect(fieldEl('host')?.classList.contains('mm-ef-field--readonly')).toBe(true);
      expect(api.control('port').enabled).toBe(true);
    });

    it('readOnly input and canEdit false make every field read-only', async () => {
      await render(sftpModel(), 'edit', editState(), true);
      expect(api.control('port').disabled).toBe(true);
      const noEdit = sftpModel();
      noEdit.capabilities.canEdit = false;
      await render(noEdit, 'edit', editState());
      expect(api.control('port').disabled).toBe(true);
      expect(api.control('usePrivateKey').disabled).toBe(true);
    });
  });

  describe('change set and dirty state', () => {
    it('contains only dirty controls on edit', async () => {
      await render(sftpModel(), 'edit', editState());
      expect(component.isDirty()).toBe(false);
      api.control('port').setValue(2222);
      expect(component.isDirty()).toBe(true);
      const cs = component.getChangeSet();
      expect(cs.attributes).toEqual([{ attributeName: 'port', value: 2222 }]);
      expect(cs.isEmpty).toBe(false);
    });

    it('reset() discards edits', async () => {
      await render(sftpModel(), 'edit', editState());
      api.control('port').setValue(2222);
      component.reset();
      expect(api.control('port').value).toBe(22);
      expect(component.isDirty()).toBe(false);
    });

    it('emits dirtyChange and changeSetChange', async () => {
      await render(sftpModel(), 'edit', editState());
      const dirty: boolean[] = [];
      const sets: number[] = [];
      component.dirtyChange.subscribe((d) => dirty.push(d));
      component.changeSetChange.subscribe((c) => sets.push(c.attributes.length));
      api.control('port').setValue(2222);
      expect(dirty).toEqual([true]);
      expect(sets[sets.length - 1]).toBe(1);
    });

    it('carries a host-prefilled well-known name on create (singleton)', async () => {
      await render(sftpModel(), 'create', { values: {}, secretPresence: {}, associations: {}, rtWellKnownName: 'Default' });
      expect(component.getChangeSet().rtWellKnownName).toBe('Default');
    });
  });
});
