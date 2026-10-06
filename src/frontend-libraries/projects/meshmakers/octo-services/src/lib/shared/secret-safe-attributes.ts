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
 * - {@link isSecretAttributeCandidate}: THE rule — explicit decision, `secret` CK metadata, else the
 *   name heuristic for textual value types only.
 * - {@link toAttributeNameFilter}: name-only list for read-only callers without type information.
 * - {@link toUniqueCamelCaseNames}: camelCase + de-duplication for type-aware callers.
 * The server compares camelCase names only, and one list also filters the sub-attributes of records.
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
  /** CK value type (`STRING`, `INT`, `BOOLEAN`, `RECORD`, …). Unknown = treated as textual (conservative). */
  attributeValueType?: string | null;
  /** CK attribute metadata; `secret: true` marks a secret, `secret: false` opts out of the name rule. */
  metaData?: readonly ({ key?: string | null; value?: string | null } | null)[] | null;
  /**
   * Explicit decision of the caller (e.g. an entity form field `Secret: true/false`). Wins over the
   * metadata and the name rule.
   */
  secret?: boolean | null;
}

/** Whether a CK value type can hold a credential (textual). `undefined` (unknown) counts as textual. */
export function isTextualValueType(valueType: string | null | undefined): boolean {
  return !valueType || TEXTUAL_VALUE_TYPES.has(valueType.toUpperCase());
}

/**
 * THE credential rule of the frontend (AB#5542; entity forms, runtime browser, meshboard, Data
 * Explorer all use it). An attribute is a secret candidate when
 * 1. the caller decided explicitly (`secret: true|false`, e.g. form `Secret: false` opts out), else
 * 2. its CK metadata says `secret: true|false`, else
 * 3. it is TEXTUAL (`STRING`, `STRING_ARRAY`, unknown) and its name is credential-like
 *    ({@link isCredentialLikeAttributeName}). Non-textual attributes (`isSecret: BOOLEAN`,
 *    `maxTokens: INT`, a `credentials` RECORD) are never secrets by name.
 */
export function isSecretAttributeCandidate(attribute: SecretCandidateAttribute): boolean {
  if (attribute.secret === true || attribute.secret === false) return attribute.secret;
  const marker = (attribute.metaData ?? []).find((m) => !!m && m.key?.toLowerCase() === 'secret');
  if (marker) {
    const value = (marker.value ?? '').trim().toLowerCase();
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  if (!isTextualValueType(attribute.attributeValueType)) return false;
  return isCredentialLikeAttributeName(attribute.attributeName);
}

/** camelCase, de-duplicated, without empty entries — no secret filtering (callers decided already). */
export function toUniqueCamelCaseNames(names: Iterable<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    const camel = toCamelCaseAttributeName(name);
    if (seen.has(camel)) continue;
    seen.add(camel);
    result.push(camel);
  }
  return result;
}

/**
 * Builds the value of an `attributeNames` argument from names WITHOUT type information (widget
 * configuration, user-picked fields): camelCase, de-duplicated, without empty and credential-like
 * names. Because the type is unknown, the name rule is applied conservatively — use it only for
 * READ-ONLY displays. Anything that is written back must derive its list type-aware
 * ({@link isSecretAttributeCandidate}, octo-ui `SecretSafeAttributeNamesService`), otherwise a
 * dropped non-secret attribute (`isSecret: BOOLEAN`) would be saved back empty.
 * Always returns an array, so a `[String!]!` variable can never fall back to "all attributes".
 */
export function toAttributeNameFilter(names: Iterable<string | null | undefined>): string[] {
  return toUniqueCamelCaseNames([...names].filter((name) => !isCredentialLikeAttributeName(name)));
}

/**
 * Whether a query column (`attributePath` such as `password`, `endpoint.apiKey`,
 * `parent->clientSecret`) is a secret candidate: its last path segment by the shared rule.
 * Column pickers hide these so users cannot add credential columns to runtime queries
 * (AB#5542 — query rows would project the value).
 */
export function isSecretQueryColumn(attributePath: string | null | undefined, attributeValueType?: string | null): boolean {
  if (!attributePath) return false;
  const lastSegment = attributePath.split(/->|\.|\//).pop() ?? attributePath;
  return isSecretAttributeCandidate({ attributeName: lastSegment, attributeValueType });
}
