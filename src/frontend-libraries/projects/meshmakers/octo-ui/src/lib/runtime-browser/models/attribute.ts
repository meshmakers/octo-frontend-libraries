import { AttributeEnumOption } from './attribute-metadata';

export interface Attribute {
  id: {
    ckId: string;
    rtId: string | null;
  };
  attributeName: string;
  attributeValueType: string;
  isOptional: boolean;
  enumOptions?: AttributeEnumOption[] | null;
  value?: unknown;
  /**
   * Secret candidate (credential-like name or `secret: true` metadata, AB#5542). Its stored value
   * is never read; an empty value means "keep" and is omitted from create/update payloads.
   */
  secret?: boolean;
}
