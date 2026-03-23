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
}
