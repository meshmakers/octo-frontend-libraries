import { buildSchema, parse } from 'graphql';
import { extractGraphQlDocuments, findSecretUnsafeSelections, findSecretUnsafeSelectionsInSource } from '../../testing/src/public-api';

describe('findSecretUnsafeSelections (AB#5542)', () => {
  const schema = buildSchema(`
    type Query { runtime: Runtime }
    type Runtime { entities: [RtEntity] sap: [Sap] }
    type RtEntity { rtId: ID attributes(attributeNames: [String]): RtEntityAttributeDtoConnection }
    type RtEntityAttributeDtoConnection { items: [Attr] }
    type Attr { attributeName: String value: String }
    type Sap { user: String password: String isSecret: Boolean maxTokens: Int apiKey: OctoSecretState values: [Override] }
    type Override { path: String value: String secretValue: OctoSecretState }
    type OctoSecretState { isSet: Boolean! keyMissing: Boolean setAt: String }
  `);
  const check = (text: string) => findSecretUnsafeSelections(schema, parse(text), 'x.graphql').map((v) => v.message);

  it('flags a missing or nullable attributeNames and credential-like literals', () => {
    expect(check('{ runtime { entities { attributes { items { value } } } } }')).toHaveLength(1);
    expect(check('query q($n: [String]) { runtime { entities { attributes(attributeNames: $n) { items { value } } } } }')).toHaveLength(1);
    expect(check('{ runtime { entities { attributes(attributeNames: ["name", "password"]) { items { value } } } } }')).toHaveLength(1);
  });

  it('checks a single-string attributeNames too (coerced to a one-element list)', () => {
    expect(check('{ runtime { entities { attributes(attributeNames: "clientSecret") { items { value } } } } }')).toEqual([
      '`attributeNames` lists credential-like "clientSecret"',
    ]);
    expect(check('{ runtime { entities { attributes(attributeNames: "name") { items { value } } } } }')).toEqual([]);
  });

  it('accepts non-null variables (with or without default) and safe literals', () => {
    expect(check('query q($n: [String!]!) { runtime { entities { attributes(attributeNames: $n) { items { value } } } } }')).toEqual([]);
    expect(check('query q($n: [String!]! = []) { runtime { entities { attributes(attributeNames: $n) { items { value } } } } }')).toEqual([]);
    expect(check('{ runtime { entities { attributes(attributeNames: ["name"]) { items { value } } } } }')).toEqual([]);
  });

  it('flags typed credential String fields but not Boolean/Int look-alikes', () => {
    expect(check('{ runtime { sap { user password isSecret maxTokens } } }')).toEqual([
      'typed selection of credential-like field "password" (String)',
    ]);
  });

  it('accepts a SECRET field selected as { isSet } (typed and inside records)', () => {
    expect(check('{ runtime { sap { apiKey { isSet keyMissing setAt } values { path secretValue { isSet } } } } }')).toEqual([]);
  });

  it('flags a SECRET field selected without isSet', () => {
    expect(check('{ runtime { sap { apiKey { setAt } } } }')).toEqual([
      'SECRET field "apiKey" must be selected as { isSet … }',
    ]);
    expect(check('{ runtime { sap { values { secretValue } } } }')).toEqual([
      'SECRET field "secretValue" must be selected as { isSet … }',
    ]);
  });

  it('builds field-path allow-list keys', () => {
    expect(findSecretUnsafeSelections(schema, parse('{ runtime { sap { password } } }'), 'a.graphql')[0].key)
      .toBe('a.graphql#runtime.sap.password');
  });

  it('extracts .graphql files whole and only operation-shaped inline gql documents', () => {
    expect(extractGraphQlDocuments('a.graphql', 'query a { x }')).toEqual(['query a { x }']);
    const ts = 'const Q = gql`\n  query q { runtime { x } }\n`; // inline `gql` (not codegen) comment';
    expect(extractGraphQlDocuments('a.ts', ts)).toEqual(['\n  query q { runtime { x } }\n']);
  });

  it('checks source text with the library\'s own graphql instance (published-package hosts)', () => {
    const sdl = `
      type Query { runtime: Runtime }
      type Runtime { sap: [Sap] }
      type Sap { user: String password: String }
    `;
    expect(findSecretUnsafeSelectionsInSource(sdl, 'query q { runtime { sap { user } } }', 'a.graphql')).toEqual([]);
    expect(findSecretUnsafeSelectionsInSource(sdl, 'query q { runtime { sap { password } } }', 'a.graphql').map((v) => v.key))
      .toEqual(['a.graphql#runtime.sap.password']);
  });
});
