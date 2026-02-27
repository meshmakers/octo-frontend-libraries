import { AbstractControl } from '@angular/forms';

export interface AttributeField {
  id: {
    ckId: string;
    rtId: string | null;
  };
  attributeName: string;
  attributeValueType: string;
  graphqlPath: string;
  isOptional: boolean;
  control: AbstractControl;
  enumOptions?: { key: string; name: string }[];
}
