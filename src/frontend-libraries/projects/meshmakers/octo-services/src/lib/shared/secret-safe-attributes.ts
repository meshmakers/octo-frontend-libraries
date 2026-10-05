/**
 * Secret-safe attribute selection for generic runtime GraphQL documents (AB#5542).
 *
 * The generic `attributes` field of `RtEntity` / `RtAssociation` returns EVERY attribute of the
 * entity — passwords, client secrets, API keys included — when its `attributeNames` argument is
 * omitted (or bound to a variable the caller leaves `undefined`). Until the SECRET value type
 * (AB#5528) lets the server mask those values, every generic document must pass an explicit,
 * non-nullable list, and callers that derive the list from CK metadata must leave out
 * credential-like attributes. These helpers are that rule in one place:
 *
 * - {@link isCredentialLikeAttributeName}: the name heuristic (suffix based, camelCase or PascalCase).
 * - {@link isSecretAttributeCandidate}: name heuristic + value type + `secret: true` CK metadata.
 * - {@link toAttributeNameFilter}: camelCase, de-duplicated list without credential-like names,
 *   ready for `attributes(attributeNames: …)` (the server compares camelCase names only, and the
 *   same list also filters the sub-attributes of records).
 *
 * The heuristic is an interim mitigation. Once the models declare `valueType: Secret`, the server
 * projects `{ isSet }` instead of the value and the heuristic can be dropped.
 */

/**
 * Credential-like name suffixes (lower case). Matched against the END of the attribute name so
 * that `password`, `adminPassword`, `privateKeyPassphrase`, `clientSecret`, `botToken`,
 * `refreshToken`, `apiKey`, `secretKey`, `connectionString` match, while `maxTokens`,
 * `tokensPerDay`, `tokenEndpoint` or `receivesClusterSecrets` do not.
 */
export const CREDENTIAL_ATTRIBUTE_NAME_SUFFIXES: readonly string[] = [
  'password',
  'passphrase',
  'secret',
  'secretkey',
  'token',
  'apikey',
  'privatekey',
  'connectionstring',
  'credential',
  'credentials',
  'encryptedvalue',
];

/** CK value types that can carry a credential (anything textual). */
const TEXTUAL_VALUE_TYPES = new Set(['STRING', 'STRING_ARRAY']);

/** Lower-cases the first character, like the server's `ToCamelCase` used by the `attributeNames` filter. */
export function toCamelCaseAttributeName(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** Whether an attribute name looks like a credential (password, secret, token, API key, …). */
export function isCredentialLikeAttributeName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalised = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return CREDENTIAL_ATTRIBUTE_NAME_SUFFIXES.some((suffix) => normalised.endsWith(suffix));
}

/** Minimal CK attribute description used by {@link isSecretAttributeCandidate}. */
export interface SecretCandidateAttribute {
  attributeName?: string | null;
  /** CK value type (`STRING`, `INT`, `BOOLEAN`, …). Unknown = treated as textual. */
  attributeValueType?: string | null;
  /** CK attribute metadata; `{ key: 'secret', value: 'true' }` marks a secret explicitly. */
  metaData?: readonly ({ key?: string | null; value?: string | null } | null)[] | null;
}

/**
 * Whether a CK attribute must not be selected by a generic document: explicitly marked
 * `secret: true` in its metadata, or textual with a credential-like name. Non-textual attributes
 * (`maxTokens: INT`, `isSecret: BOOLEAN`) are never treated as secrets by name.
 */
export function isSecretAttributeCandidate(attribute: SecretCandidateAttribute): boolean {
  const markedSecret = (attribute.metaData ?? []).some(
    (m) => !!m && m.key?.toLowerCase() === 'secret' && (m.value ?? '').trim().toLowerCase() === 'true',
  );
  if (markedSecret) return true;
  const valueType = attribute.attributeValueType?.toUpperCase();
  if (valueType && !TEXTUAL_VALUE_TYPES.has(valueType)) return false;
  return isCredentialLikeAttributeName(attribute.attributeName);
}

/**
 * Builds the value of an `attributeNames` argument: camelCase, de-duplicated, without empty and
 * credential-like names. Always returns an array (never `null`/`undefined`), so binding it to a
 * `[String!]!` variable can never fall back to "all attributes".
 */
export function toAttributeNameFilter(names: Iterable<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (!name || isCredentialLikeAttributeName(name)) continue;
    const camel = toCamelCaseAttributeName(name);
    if (seen.has(camel)) continue;
    seen.add(camel);
    result.push(camel);
  }
  return result;
}
