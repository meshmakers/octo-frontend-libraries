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
import { signal } from '@angular/core';
import { ENTITY_FORM_SECRET_KEY_RING_CONFIGURED } from '../core/secret-write-availability';
import { ENTITY_FORM_LABEL_RESOLVER } from '../core/entity-form-labels';

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
      expect(input.placeholder).toBe('Leave empty to keep');
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

  describe('SECRET value type (AB#5542 / AB#5544 item 4)', () => {
    /** Mail-receiver-like form: required SECRET password, optional SECRET API key and PEM key. */
    function secretModel(): ResolvedEntityForm {
      const m = model([
        section('auth', [
          field({ key: 'userName' }),
          field({ key: 'password', valueType: 'SECRET', editor: 'password', secret: true, required: true }),
          field({ key: 'apiKey', valueType: 'SECRET', editor: 'password', secret: true }),
          field({ key: 'privateKey', valueType: 'SECRET', editor: 'multiline', secret: true }),
        ]),
      ]);
      m.secretFields = ['password', 'apiKey', 'privateKey'];
      m.secretStateFields = ['password', 'apiKey', 'privateKey'];
      return m;
    }

    function secretState(): EntityFormValueState {
      return {
        values: { userName: 'mail' },
        secretPresence: { password: true, apiKey: true, privateKey: true },
        secretStates: {
          password: { isSet: true, keyMissing: false, setAt: new Date('2026-10-06T03:00:00Z') },
          apiKey: { isSet: true, keyMissing: false, setAt: null },
          privateKey: { isSet: false, keyMissing: true, setAt: null },
        },
        associations: {},
      };
    }

    const badge = (key: string) => fieldEl(key)?.querySelector('.mm-ef-field__badge') as HTMLElement | null;

    it('shows "Set · set at …", legacy "Set" and "Key missing — re-enter"', async () => {
      await render(secretModel(), 'edit', secretState());
      expect(badge('password')?.getAttribute('data-secret-state')).toBe('set');
      expect(badge('password')?.textContent).toContain('Set · set at');
      expect(badge('apiKey')?.textContent?.trim()).toBe('Set');
      expect(badge('privateKey')?.getAttribute('data-secret-state')).toBe('keyMissing');
      expect(badge('privateKey')?.textContent?.trim()).toBe('Key missing — re-enter');
      // A key-missing secret counts as present: not required, never prefilled.
      expect(api.control('privateKey').value).toBeNull();
    });

    it('read-only users see the badge but no input, show or clear', async () => {
      await render(secretModel(), 'edit', secretState(), true);
      expect(badge('password')?.textContent).toContain('Set · set at');
      expect(fieldEl('password')?.querySelector('input')).toBeNull();
      expect(fieldEl('apiKey')?.querySelector('[data-secret-clear]')).toBeNull();
      expect(fieldEl('apiKey')?.querySelector('[data-secret-show]')).toBeNull();
    });

    it('offers Clear only for optional secrets with a value', async () => {
      await render(secretModel(), 'edit', secretState());
      expect(fieldEl('password')?.querySelector('[data-secret-clear]')).toBeNull();
      expect(fieldEl('apiKey')?.querySelector('[data-secret-clear]')).not.toBeNull();
      expect(fieldEl('privateKey')?.querySelector('[data-secret-clear]')).not.toBeNull();
      await render(secretModel(), 'create');
      expect(fieldEl('apiKey')?.querySelector('[data-secret-clear]')).toBeNull();
    });

    it('stages Clear and sends it on save as clearSecretAttributes; Undo restores', async () => {
      await render(secretModel(), 'edit', secretState());
      expect(component.isDirty()).toBe(false);
      (fieldEl('apiKey')?.querySelector('[data-secret-clear]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(badge('apiKey')?.getAttribute('data-secret-state')).toBe('clearStaged');
      expect(fieldEl('apiKey')?.querySelector('[data-secret-clear-staged]')).not.toBeNull();
      expect(api.control('apiKey').disabled).toBe(true);
      expect(component.isDirty()).toBe(true);
      const cs = component.getChangeSet();
      expect(cs.clearSecretAttributes).toEqual(['apiKey']);
      expect(cs.attributes).toEqual([]);
      expect(cs.isEmpty).toBe(false);

      (fieldEl('apiKey')?.querySelector('[data-secret-undo]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(api.control('apiKey').enabled).toBe(true);
      expect(component.getChangeSet().clearSecretAttributes).toBeUndefined();
      expect(component.isDirty()).toBe(false);
    });

    it('Clear and a new value are mutually exclusive', async () => {
      await render(secretModel(), 'edit', secretState());
      api.control('apiKey').setValue('new-key');
      fixture.detectChanges();
      const clear = fieldEl('apiKey')?.querySelector('[data-secret-clear]') as HTMLButtonElement;
      expect(clear.disabled).toBe(true);
      expect(component.getChangeSet().attributes).toEqual([{ attributeName: 'apiKey', value: 'new-key' }]);
      expect(component.getChangeSet().clearSecretAttributes).toBeUndefined();
    });

    it('"Show" reveals only the typed value and is disabled while empty', async () => {
      await render(secretModel(), 'edit', secretState());
      const show = () => fieldEl('apiKey')?.querySelector('[data-secret-show]') as HTMLButtonElement;
      const input = () => fieldEl('apiKey')?.querySelector('input') as HTMLInputElement;
      expect(show().disabled).toBe(true);
      expect(input().type).toBe('password');
      // The placeholder doubles as tooltip (truncated in the narrow Explorer peek).
      expect(fieldEl('apiKey')?.querySelector('kendo-textbox')?.getAttribute('title')).toBe('Leave empty to keep');
      api.control('apiKey').setValue('typed');
      fixture.detectChanges();
      expect(show().disabled).toBe(false);
      show().click();
      fixture.detectChanges();
      expect(input().type).toBe('text');
      api.control('apiKey').setValue('');
      fixture.detectChanges();
      expect(input().type).toBe('password');
    });

    it('renders a masked multiline editor for PEM keys (Editor: multiline)', async () => {
      await render(secretModel(), 'edit', secretState());
      const area = fieldEl('privateKey')?.querySelector('textarea') as HTMLTextAreaElement;
      expect(area).not.toBeNull();
      expect(fieldEl('privateKey')?.querySelector('.mm-ef-secret__input--masked')).not.toBeNull();
    });

    it('disables secret inputs with a hint when no key ring is configured (Q17)', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EntityFormComponent],
        animationsEnabled: false,
        providers: [{ provide: ENTITY_FORM_SECRET_KEY_RING_CONFIGURED, useValue: signal(false) }],
      }).compileComponents();
      fixture = TestBed.createComponent(EntityFormComponent);
      component = fixture.componentInstance;
      api = component as unknown as Testable;
      await render(secretModel(), 'edit', secretState());
      expect(api.control('apiKey').disabled).toBe(true);
      expect(api.control('userName').enabled).toBe(true);
      expect(fieldEl('apiKey')?.querySelector('[data-secret-writes-disabled]')).not.toBeNull();
      expect((fieldEl('apiKey')?.querySelector('[data-secret-clear]') as HTMLButtonElement).disabled).toBe(true);
    });

    async function renderWithKeyRing(keyRing: ReturnType<typeof signal<boolean | null>>, mode: EntityFormMode, state?: EntityFormValueState): Promise<void> {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EntityFormComponent],
        animationsEnabled: false,
        providers: [{ provide: ENTITY_FORM_SECRET_KEY_RING_CONFIGURED, useValue: keyRing }],
      }).compileComponents();
      fixture = TestBed.createComponent(EntityFormComponent);
      component = fixture.componentInstance;
      api = component as unknown as Testable;
      await render(secretModel(), mode, state);
    }

    it('follows a key ring status that arrives after the form was built (Q17)', async () => {
      const keyRing = signal<boolean | null>(null);
      await renderWithKeyRing(keyRing, 'edit', secretState());
      expect(api.control('apiKey').enabled).toBe(true);
      expect(fieldEl('apiKey')?.querySelector('[data-secret-writes-disabled]')).toBeNull();

      keyRing.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(api.control('apiKey').disabled).toBe(true);
      expect(api.control('password').disabled).toBe(true);
      expect(api.control('userName').enabled).toBe(true);
      expect(fieldEl('apiKey')?.querySelector('[data-secret-writes-disabled]')).not.toBeNull();

      keyRing.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(api.control('apiKey').enabled).toBe(true);
      expect(fieldEl('apiKey')?.querySelector('[data-secret-writes-disabled]')).toBeNull();
    });

    it('blocks Create while a required secret cannot be entered (no key ring) and names the reason', async () => {
      const keyRing = signal<boolean | null>(true);
      await renderWithKeyRing(keyRing, 'create');
      const validEvents: boolean[] = [];
      component.validChange.subscribe((v) => validEvents.push(v));
      api.control('password').setValue('pw');
      expect(component.isValid()).toBe(true);
      expect(component.saveBlockedReason()).toBeNull();

      keyRing.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      // The field stays required (marker + hint), the control is disabled, the form is blocked.
      expect(fieldEl('password')?.querySelector('.mm-ef-field__required')).not.toBeNull();
      expect(api.control('password').disabled).toBe(true);
      expect(component.isValid()).toBe(false);
      expect(component.saveBlockedReason()).toContain('password');
      expect(el().querySelector('[data-save-blocked]')?.textContent).toContain('encryption key ring');
      expect(validEvents.at(-1)).toBe(false);
    });

    it('the key ring only gates SECRET-typed fields, not name-rule / metadata secrets', async () => {
      const m = model([section('auth', [
        field({ key: 'password', valueType: 'SECRET', editor: 'password', secret: true, required: true }),
        field({ key: 'legacyToken', valueType: 'STRING', editor: 'password', secret: true, required: true }),
      ])]);
      m.secretFields = ['password', 'legacyToken'];
      m.secretStateFields = ['password'];
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EntityFormComponent],
        animationsEnabled: false,
        providers: [{ provide: ENTITY_FORM_SECRET_KEY_RING_CONFIGURED, useValue: signal(false) }],
      }).compileComponents();
      fixture = TestBed.createComponent(EntityFormComponent);
      component = fixture.componentInstance;
      api = component as unknown as Testable;
      await render(m, 'create');
      expect(api.control('password').disabled).toBe(true);
      expect(api.control('legacyToken').enabled).toBe(true);
      expect(fieldEl('legacyToken')?.querySelector('[data-secret-writes-disabled]')).toBeNull();
      expect(component.saveBlockedReason()).toContain('password');
      expect(component.saveBlockedReason()).not.toContain('legacyToken');
    });

    it('does not block saving an existing entity without key ring (required secret only enforced on create)', async () => {
      await renderWithKeyRing(signal<boolean | null>(false), 'edit', secretState());
      expect(component.saveBlockedReason()).toBeNull();
      expect(component.isValid()).toBe(true);
    });

    it('masks a typed multiline value in every browser and reports only the line count', async () => {
      await render(secretModel(), 'edit', secretState());
      api.control('privateKey').setValue('-----BEGIN KEY-----\nabc\n-----END KEY-----');
      fixture.detectChanges();
      const status = fieldEl('privateKey')?.querySelector('[data-secret-masked-status]');
      expect(status?.textContent).toContain('3 line(s)');
      expect(status?.textContent).not.toContain('abc');
      (fieldEl('privateKey')?.querySelector('[data-secret-show]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fieldEl('privateKey')?.querySelector('.mm-ef-secret__input--masked')).toBeNull();
      expect(fieldEl('privateKey')?.querySelector('[data-secret-masked-status]')).toBeNull();
    });
  });

  describe('needs re-entry wording (visual check 2026-10-06)', () => {
    it('a required SECRET without a value reads "Needs re-entry", an optional one "Not set"', async () => {
      const m = model([section('auth', [
        field({ key: 'password', valueType: 'SECRET', editor: 'password', secret: true, required: true }),
        field({ key: 'apiKey', valueType: 'SECRET', editor: 'password', secret: true }),
      ])]);
      m.secretFields = ['password', 'apiKey'];
      m.secretStateFields = ['password', 'apiKey'];
      await render(m, 'edit', {
        values: {}, associations: {},
        secretPresence: { password: false, apiKey: false },
        secretStates: { password: { isSet: false, keyMissing: false, setAt: null }, apiKey: { isSet: false, keyMissing: false, setAt: null } },
      });
      const badge = (key: string) => fieldEl(key)?.querySelector('.mm-ef-field__badge');
      expect(badge('password')?.textContent?.trim()).toBe('Needs re-entry');
      expect(badge('password')?.getAttribute('data-secret-state')).toBe('needsReEntry');
      expect(badge('apiKey')?.textContent?.trim()).toBe('Not set');
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

  describe('host labels and prefill (AB#5623)', () => {
    it('renders translated labels without rebuilding the controls on a language change', async () => {
      const lang = signal('en');
      fixture.componentRef.setInput('labelResolver', (r: { kind: string; key: string }) =>
        lang() === 'de' && r.kind === 'field' && r.key === 'host' ? 'Rechner' : null);
      await render(sftpModel(), 'create');
      expect(fieldEl('host')?.textContent).toContain('host');
      api.control('host').setValue('typed');

      lang.set('de');
      fixture.detectChanges();
      expect(fieldEl('host')?.textContent).toContain('Rechner');
      expect(api.control('host').value).toBe('typed');
    });

    it('uses ENTITY_FORM_LABEL_RESOLVER when no input is bound, and names translated fields in saveBlockedReason', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EntityFormComponent],
        animationsEnabled: false,
        providers: [
          { provide: ENTITY_FORM_LABEL_RESOLVER, useValue: (r: { key: string }) => (r.key === 'token' ? 'Schlüssel' : null) },
          { provide: ENTITY_FORM_SECRET_KEY_RING_CONFIGURED, useValue: signal(false) },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(EntityFormComponent);
      component = fixture.componentInstance;
      await render(model([section('s', [field({ key: 'token', valueType: 'SECRET', editor: 'password', secret: true, required: true })])]), 'create');
      expect(component.saveBlockedReason()).toContain('Schlüssel');
    });

    it('prefills a create form from initialValues (any key casing, over defaults, never secrets)', async () => {
      fixture.componentRef.setInput('initialValues', { HOST: 'h.example.com', port: 2222, password: 'nope', rtWellKnownName: 'Main' });
      await render(model([section('s', [
        field({ key: 'host' }),
        field({ key: 'port', valueType: 'INT', editor: 'number', defaultValue: 22 }),
        field({ key: 'password', editor: 'password', secret: true }),
      ])]), 'create');
      expect(api.control('host').value).toBe('h.example.com');
      expect(api.control('port').value).toBe(2222);
      expect(api.control('password').value).toBeNull();
      expect(component.isDirty()).toBe(false);
      const changeSet = component.getChangeSet();
      expect(changeSet.rtWellKnownName).toBe('Main');
      expect(changeSet.attributes).toEqual(expect.arrayContaining([{ attributeName: 'host', value: 'h.example.com' }]));
    });

    it('ignores initialValues outside create mode', async () => {
      fixture.componentRef.setInput('initialValues', { host: 'other' });
      await render(sftpModel(), 'edit', editState());
      expect(api.control('host').value).toBe('sftp.example.com');
    });

    it('patchValues sets writable fields as edits and skips secrets, read-only and unknown keys', async () => {
      await render(sftpModel(), 'edit', editState());
      const applied = component.patchValues({ Port: 2200, host: 'x', password: 'secret', unknown: 1, timeout: 30 });
      // host is afterCreate (read-only in edit mode), password is a secret.
      expect(applied).toEqual(['port', 'timeout']);
      expect(api.control('port').value).toBe(2200);
      expect(api.control('host').value).toBe('sftp.example.com');
      expect(component.isDirty()).toBe(true);
      expect(component.getChangeSet().attributes).toEqual(expect.arrayContaining([
        { attributeName: 'port', value: 2200 },
        { attributeName: 'timeout', value: 30 },
      ]));
    });
  });
});
