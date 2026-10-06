export interface AttributeEnumOption {
  key?: number | string | null;
  name?: string | null;
}

export interface CkAttributeMetadata {
  attributeName: string;
  attributeValueType: string;
  graphqlPath?: string | null;
  isOptional: boolean;
  autoCompleteValues?: (string | null)[] | null;
  enumOptions?: AttributeEnumOption[] | null;
  ckAttributeId?: { fullName?: string | null } | null;
  attribute?: {
    defaultValues?: (unknown | null)[] | null;
    /** CK attribute metadata; `{ key: 'secret', value: 'true' }` marks a secret (AB#5542). */
    metaData?: ({ key?: string | null; value?: string | null } | null)[] | null;
    ckRecord?: { ckRecordId?: { fullName?: string | null } | null } | null;
    ckEnum?: {
      ckEnumId?: { fullName?: string | null } | null;
      values?: (AttributeEnumOption | null)[] | null;
    } | null;
  } | null;
}
