import { entityFormCatalog, entityFormKey } from './entity-form-catalog';
import { form } from './testing/factories';

const SFTP = 'System.Communication/SftpConfiguration';
const MAIL = 'System.Communication/EMailSenderConfiguration';

describe('entityFormKey', () => {
  it('strips the form- prefix of a delivered well-known name', () => {
    expect(entityFormKey({ rtWellKnownName: 'form-email-sender-configuration', targetCkTypeId: MAIL })).toBe('email-sender-configuration');
  });

  it('falls back to the kebab type name', () => {
    expect(entityFormKey({ rtWellKnownName: null, targetCkTypeId: SFTP })).toBe('sftp-configuration');
    expect(entityFormKey({ rtWellKnownName: 'my-sftp', targetCkTypeId: SFTP })).toBe('sftp-configuration');
    expect(entityFormKey({ rtWellKnownName: 'form-', targetCkTypeId: SFTP })).toBe('sftp-configuration');
  });
});

describe('entityFormCatalog', () => {
  it('lists only forms with a category, sorted by title', () => {
    const entries = entityFormCatalog([
      form('System/Entity', { rtWellKnownName: 'form-default', includeDerivedTypes: true, name: 'Default form' }),
      form(SFTP, { rtWellKnownName: 'form-sftp-configuration', name: 'SFTP configuration', category: 'connections' }),
      form(MAIL, { rtWellKnownName: 'form-email-sender-configuration', name: 'E-mail sender configuration', category: 'Connections', description: ' Outgoing mail ' }),
    ]);
    expect(entries.map((e) => [e.key, e.category, e.title])).toEqual([
      ['email-sender-configuration', 'connections', 'E-mail sender configuration'],
      ['sftp-configuration', 'connections', 'SFTP configuration'],
    ]);
    expect(entries[0].description).toBe('Outgoing mail');
  });

  it('lets a tenant form win but keeps the delivered key', () => {
    const tenant = form(SFTP, { rtWellKnownName: null, isTenantForm: true, name: 'Our SFTP', category: 'data' });
    const entries = entityFormCatalog([
      form(SFTP, { rtWellKnownName: 'form-sftp-configuration', name: 'SFTP configuration', category: 'connections' }),
      tenant,
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(expect.objectContaining({ key: 'sftp-configuration', category: 'data', title: 'Our SFTP', form: tenant }));
  });

  it('drops a type whose effective form has no category', () => {
    expect(entityFormCatalog([
      form(SFTP, { rtWellKnownName: 'form-sftp-configuration', category: 'connections' }),
      form(SFTP, { rtWellKnownName: null, isTenantForm: true, category: null }),
    ])).toEqual([]);
  });

  it('uses the higher priority between seeded forms and humanizes a missing name', () => {
    const entries = entityFormCatalog([
      form(SFTP, { rtWellKnownName: 'form-a', category: 'connections', priority: 1 }),
      form(SFTP, { rtWellKnownName: 'form-b', category: 'ai', priority: 5, singleton: true }),
    ]);
    expect(entries[0]).toEqual(expect.objectContaining({ category: 'ai', title: 'Sftp configuration', singleton: true }));
  });
});
