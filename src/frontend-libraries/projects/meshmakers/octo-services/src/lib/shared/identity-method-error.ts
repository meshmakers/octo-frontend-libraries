/**
 * Errors of the identity user methods (`System.Identity/User.*`, called through GraphQL) and their REST counterparts
 * (AB#8864): one error shape for both paths, the schema-mismatch and handler-not-available checks of the REST fallback.
 *
 * The method errors are language-neutral: `extensions.code`, `extensions.parameters` and, for the password policy, one
 * `extensions.details` entry per failed rule (code only, never a value). The REST endpoints answer the same outcomes
 * with readable texts. {@link identityUserFailureOf} turns both into the same {@link IdentityUserFailure}: same code, same
 * text.
 */

/** The gateway answers this code when no handler serves the method, e.g. the password methods are switched off. */
export const METHOD_HANDLER_NOT_AVAILABLE_CODE = 'METHOD_HANDLER_NOT_AVAILABLE';
/** The new or initial password breaks the password policy; `details` name the failed rules. */
export const PASSWORD_POLICY_VIOLATION_CODE = 'PASSWORD_POLICY_VIOLATION';
/** Another user of the tenant already has the user name or e-mail address (`parameters.field`). */
export const USER_ALREADY_EXISTS_CODE = 'USER_ALREADY_EXISTS';
/** The user does not exist (or the caller cannot read it). */
export const METHOD_TARGET_NOT_FOUND_CODE = 'METHOD_TARGET_NOT_FOUND';

/** One entry of a GraphQL `errors` array, as far as this module reads it. */
export interface GraphQlErrorEntry {
  message?: string;
  extensions?: Record<string, unknown> | null;
}

/** One failed rule of a {@link IdentityUserFailure}, e.g. `PasswordTooShort`. */
export interface IdentityUserFailureDetail {
  code: string;
  description: string;
}

/** The outcome of a refused user operation, the same on the method and on the REST path. */
export interface IdentityUserFailure {
  /** Stable, language-neutral code, e.g. {@link PASSWORD_POLICY_VIOLATION_CODE}. */
  code: string;
  /** Readable text; identical on both paths for the codes this module knows. */
  message: string;
  /** Language-neutral parameters, e.g. `field` of {@link USER_ALREADY_EXISTS_CODE}. */
  parameters: Record<string, string>;
  /** The failed password rules of {@link PASSWORD_POLICY_VIOLATION_CODE}, otherwise empty. */
  details: IdentityUserFailureDetail[];
}

/**
 * Thrown by the method path of `IdentityService.createUser` / `resetPassword` for a refused call. `message` and the
 * fields are those of {@link identityUserFailureOf}; the error never carries a request variable (no password).
 */
export class IdentityMethodError extends Error implements IdentityUserFailure {
  readonly code: string;
  readonly parameters: Record<string, string>;
  readonly details: IdentityUserFailureDetail[];

  constructor(failure: IdentityUserFailure) {
    super(failure.message);
    this.name = 'IdentityMethodError';
    this.code = failure.code;
    this.parameters = failure.parameters;
    this.details = failure.details;
  }
}

/** GraphQL validation codes that mean "the server's schema does not have this field, type or argument". */
const SCHEMA_MISMATCH_CODES = new Set(['FIELDS_ON_CORRECT_TYPE', 'KNOWN_TYPE_NAMES', 'KNOWN_ARGUMENT_NAMES']);
const SCHEMA_MISMATCH_MESSAGE = /cannot query field|unknown (type|argument)/i;

/**
 * The GraphQL errors of a failed operation: Apollo 4 `CombinedGraphQLErrors.errors`, Apollo 3 `graphQLErrors`, or the
 * body of a non-2xx answer (`ServerError.bodyText`, `result.errors`) — GraphQL.NET answers validation errors with 400.
 */
export function graphQlErrorsOf(error: unknown): GraphQlErrorEntry[] {
  if (!error || typeof error !== 'object') {
    return [];
  }
  const e = error as Record<string, unknown>;
  const candidates: unknown[] = [e['errors'], e['graphQLErrors'], (e['result'] as Record<string, unknown> | undefined)?.['errors']];
  const bodyText = e['bodyText'];
  if (typeof bodyText === 'string') {
    try {
      candidates.push((JSON.parse(bodyText) as Record<string, unknown> | null)?.['errors']);
    } catch {
      // not a GraphQL body
    }
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate as GraphQlErrorEntry[];
    }
  }
  return [];
}

function codesOf(entry: GraphQlErrorEntry): string[] {
  const extensions = entry.extensions ?? {};
  const codes = Array.isArray(extensions['codes']) ? (extensions['codes'] as unknown[]).map(String) : [];
  const code = extensions['code'];
  return typeof code === 'string' ? [code, ...codes] : codes;
}

/** True when every GraphQL error says the server's schema lacks a field, type or argument of the operation. */
export function isGraphQlSchemaMismatch(error: unknown): boolean {
  const errors = graphQlErrorsOf(error);
  return errors.length > 0 && errors.every(e =>
    codesOf(e).some(c => SCHEMA_MISMATCH_CODES.has(c)) || SCHEMA_MISMATCH_MESSAGE.test(e.message ?? ''));
}

/** True when the gateway answered {@link METHOD_HANDLER_NOT_AVAILABLE_CODE}: the method did not run. */
export function isMethodHandlerNotAvailable(error: unknown): boolean {
  return graphQlErrorsOf(error).some(e => codesOf(e).includes(METHOD_HANDLER_NOT_AVAILABLE_CODE));
}

/**
 * Texts of the password rules. They equal the REST texts of the identity service (ASP.NET Core Identity's default
 * error describer with the default password options, the source of the AB#8523 parity test), so a refused password
 * reads the same on both paths. An unknown rule code is shown as its code.
 */
export const PASSWORD_RULE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  PasswordTooShort: 'Passwords must be at least 6 characters.',
  PasswordRequiresNonAlphanumeric: 'Passwords must have at least one non alphanumeric character.',
  PasswordRequiresDigit: "Passwords must have at least one digit ('0'-'9').",
  PasswordRequiresLower: "Passwords must have at least one lowercase ('a'-'z').",
  PasswordRequiresUpper: "Passwords must have at least one uppercase ('A'-'Z').",
  PasswordRequiresUniqueChars: 'Passwords must use at least 1 different characters.'
};

/** Titles of the REST 409 answer (`UserCreationProblems` of the identity service) per `field`. */
const USER_ALREADY_EXISTS_MESSAGES: Readonly<Record<string, string>> = {
  userName: 'Another user of this tenant already has this user name.',
  email: 'Another user of this tenant already has this e-mail address.'
};

/** Text of an unknown user, the same as the 404 of `POST users/ResetPassword`. */
export function userNotFoundMessage(userName: string | undefined): string {
  return userName ? `User '${userName}' not found.` : 'User not found.';
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => [k, String(v)]));
}

function policyFailure(details: IdentityUserFailureDetail[]): IdentityUserFailure {
  return {
    code: PASSWORD_POLICY_VIOLATION_CODE,
    message: details.map(d => d.description).join(' '),
    parameters: {},
    details
  };
}

/**
 * The {@link IdentityUserFailure} of a refused method call, or `null` when the error is no method refusal.
 *
 * @param userName The user the call was about; only used for the text of {@link METHOD_TARGET_NOT_FOUND_CODE}.
 */
export function methodFailureOf(error: unknown, userName?: string): IdentityUserFailure | null {
  const entry = graphQlErrorsOf(error).find(e => typeof e.extensions?.['code'] === 'string');
  if (!entry) {
    return null;
  }
  const code = entry.extensions!['code'] as string;
  const parameters = stringRecord(entry.extensions?.['parameters']);
  const rawDetails = Array.isArray(entry.extensions?.['details']) ? entry.extensions!['details'] as unknown[] : [];
  const ruleCodes = rawDetails
    .map(d => (d && typeof d === 'object' ? (d as Record<string, unknown>)['code'] : undefined))
    .filter((c): c is string => typeof c === 'string' && c.length > 0);

  switch (code) {
    case PASSWORD_POLICY_VIOLATION_CODE:
      return policyFailure(ruleCodes.map(c => ({ code: c, description: PASSWORD_RULE_DESCRIPTIONS[c] ?? c })));
    case USER_ALREADY_EXISTS_CODE:
      return {
        code, parameters, details: [],
        message: USER_ALREADY_EXISTS_MESSAGES[parameters['field'] ?? ''] ?? USER_ALREADY_EXISTS_MESSAGES['userName']
      };
    case METHOD_TARGET_NOT_FOUND_CODE:
      return { code, parameters, details: [], message: userNotFoundMessage(userName) };
    default:
      // Every other code (METHOD_FORBIDDEN, METHOD_VALIDATION_FAILED, ...) keeps the gateway's language-neutral message.
      return { code, parameters, details: [], message: entry.message ?? code };
  }
}

/** Structural check: the error may come from a second `@angular/common` copy, where `instanceof` fails. */
function isHttpErrorResponse(error: unknown): error is { status: number; error: unknown } {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'HttpErrorResponse';
}

/** The {@link IdentityUserFailure} of a refused REST call of `POST users` / `POST users/ResetPassword`, or `null`. */
export function restFailureOf(error: unknown, userName?: string): IdentityUserFailure | null {
  if (!isHttpErrorResponse(error)) {
    return null;
  }
  const body = (typeof error.error === 'object' && error.error !== null ? error.error : {}) as Record<string, unknown>;
  const rawDetails = Array.isArray(body['details']) ? body['details'] as unknown[] : [];
  const rules = rawDetails
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .filter(d => typeof d['code'] === 'string' && (d['code'] as string).startsWith('Password'))
    .map(d => ({
      code: d['code'] as string,
      description: typeof d['description'] === 'string' ? d['description'] as string : d['code'] as string
    }));

  if (error.status === 400 && rules.length > 0) {
    return policyFailure(rules);
  }
  if (error.status === 409 && body['code'] === USER_ALREADY_EXISTS_CODE) {
    const field = typeof body['field'] === 'string' ? body['field'] as string : 'userName';
    return {
      code: USER_ALREADY_EXISTS_CODE,
      parameters: { field },
      details: [],
      message: typeof body['title'] === 'string' ? body['title'] as string : USER_ALREADY_EXISTS_MESSAGES[field]
    };
  }
  if (error.status === 404) {
    return {
      code: METHOD_TARGET_NOT_FOUND_CODE,
      parameters: {},
      details: [],
      message: typeof body['message'] === 'string' ? body['message'] as string : userNotFoundMessage(userName)
    };
  }
  return null;
}

/**
 * The outcome of a refused `createUser` / `resetPassword` call of `IdentityService`, whichever path ran: an
 * {@link IdentityMethodError} of the method path or an `HttpErrorResponse` of the REST path. `null` for anything else
 * (network failure, 5xx, ...), which the caller reports as it did before.
 */
export function identityUserFailureOf(error: unknown, userName?: string): IdentityUserFailure | null {
  if (error instanceof IdentityMethodError) {
    return { code: error.code, message: error.message, parameters: error.parameters, details: error.details };
  }
  return restFailureOf(error, userName) ?? methodFailureOf(error, userName);
}
