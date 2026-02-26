export interface Attribute {
  id: {
    ckId: string;
    rtId: string | null;
  };
  attributeName: string;
  attributeValueType: string;
  isOptional: boolean;
  enumOptions?: any[] | null;
  value?: any;
}
