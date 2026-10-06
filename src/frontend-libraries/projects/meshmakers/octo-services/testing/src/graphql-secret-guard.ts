import { DocumentNode, getNamedType, GraphQLSchema, print, TypeInfo, visit, visitWithTypeInfo } from 'graphql';
import { isCredentialLikeAttributeName } from '@meshmakers/octo-services';

/**
 * SECRET-safe GraphQL document rule (AB#5542), shared by the guard specs of the libraries
 * (`octo-services/src/lib/graphql-secret-guard.spec.ts`) and the Refinery Studio
 * (`src/app/graphql-secret-guard.spec.ts`). Pure functions — the specs do the file scanning.
 *
 * A document violates the rule when
 * 1. a generic runtime `attributes` selection (`RtEntityAttributeDtoConnection`) has no
 *    `attributeNames` argument, binds it to a NULLABLE variable, or lists a credential-like name
 *    (list or single string) — omitting the filter returns every attribute incl. secrets;
 * 2. a typed selection contains a credential-like String field (`password`, `clientSecret`,
 *    `apiKey`, `botToken`, …; Boolean/number fields such as `isSecret` or `maxTokens` are fine).
 *
 * A non-null variable with a default (`$attributeNames: [String!]! = []`) is accepted.
 */

/** One violation: `key` = `<file>#<field path>` (allow-list key), `message` = human readable. */
export interface SecretGuardViolation {
  readonly key: string;
  readonly message: string;
}

const GENERIC_ATTRIBUTE_CONNECTION = 'RtEntityAttributeDtoConnection';
const NON_TEXT_SCALARS = new Set(['Boolean', 'Int', 'Float', 'Long', 'Decimal', 'DateTime', 'Date', 'TimeSpan']);
const INLINE_GQL = /gql`([\s\S]*?)`/g;
const OPERATION_START = /^\s*(#[^\n]*\n\s*)*(query|mutation|subscription|fragment|\{)/;

/**
 * The GraphQL documents of a source file: the whole text of a `.graphql` file, or the inline
 * `gql` template literals (interpolations removed) of a `.ts` file.
 */
export function extractGraphQlDocuments(path: string, source: string): string[] {
  if (path.endsWith('.graphql')) return [source];
  return [...source.matchAll(INLINE_GQL)]
    .map((m) => m[1].replace(/\$\{[^}]*\}/g, ''))
    .filter((text) => OPERATION_START.test(text));
}

/** Violations of the SECRET rule in one parsed document, validated against `schema`. */
export function findSecretUnsafeSelections(schema: GraphQLSchema, doc: DocumentNode, file: string): SecretGuardViolation[] {
  const violations: SecretGuardViolation[] = [];
  const variableTypes = new Map<string, string>();
  for (const def of doc.definitions) {
    if (def.kind === 'OperationDefinition') {
      for (const v of def.variableDefinitions ?? []) variableTypes.set(v.variable.name.value, print(v.type));
    }
  }

  const typeInfo = new TypeInfo(schema);
  const path: string[] = [];
  visit(doc, visitWithTypeInfo(typeInfo, {
    Field: {
      enter(node) {
        path.push(node.alias?.value ?? node.name.value);
        const fieldPath = path.join('.');
        const named = getNamedType(typeInfo.getType() ?? undefined);
        const selectsValue = node.selectionSet?.selections.some(
          (s) => s.kind === 'Field' && s.name.value === 'items'
            && s.selectionSet?.selections.some((i) => i.kind === 'Field' && i.name.value === 'value'),
        );
        const isGeneric = node.name.value === 'attributes'
          && (named?.name === GENERIC_ATTRIBUTE_CONNECTION || (!named && !!selectsValue));

        if (isGeneric) {
          const arg = node.arguments?.find((a) => a.name.value === 'attributeNames');
          const key = `${file}#${fieldPath}`;
          if (!arg) {
            violations.push({ key, message: 'generic `attributes` without `attributeNames` (returns ALL attributes incl. secrets)' });
          } else if (arg.value.kind === 'Variable') {
            const type = variableTypes.get(arg.value.name.value);
            if (!type?.endsWith('!')) {
              violations.push({ key, message: `\`attributeNames\` bound to nullable variable $${arg.value.name.value}: ${type ?? '?'}` });
            }
          } else if (arg.value.kind === 'ListValue') {
            for (const item of arg.value.values) {
              if (item.kind === 'StringValue' && isCredentialLikeAttributeName(item.value)) {
                violations.push({ key, message: `\`attributeNames\` lists credential-like "${item.value}"` });
              }
            }
          } else if (arg.value.kind === 'StringValue') {
            // A single string is coerced to a one-element list.
            if (isCredentialLikeAttributeName(arg.value.value)) {
              violations.push({ key, message: `\`attributeNames\` lists credential-like "${arg.value.value}"` });
            }
          } else {
            violations.push({ key, message: '`attributeNames` must be a non-null list' });
          }
        } else if (!node.selectionSet && isCredentialLikeAttributeName(node.name.value)) {
          const scalar = named?.name;
          if (!scalar || !NON_TEXT_SCALARS.has(scalar)) {
            violations.push({
              key: `${file}#${fieldPath}`,
              message: `typed selection of credential-like field "${node.name.value}" (${scalar ?? 'unknown type'})`,
            });
          }
        }
      },
      leave() {
        path.pop();
      },
    },
  }));
  return violations;
}
