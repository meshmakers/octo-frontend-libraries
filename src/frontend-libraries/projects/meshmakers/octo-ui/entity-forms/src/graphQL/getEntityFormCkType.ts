import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetCkTypeQueryVariablesDto = Exact<{
  rtCkTypeId: string;
}>;


export type EntityFormGetCkTypeQueryDto = { constructionKit: { types: { items: Array<{ rtCkTypeId: any, isAbstract: boolean, description: string | null, ckTypeId: { fullName: string }, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean, baseType: { rtCkTypeId: any, isAbstract: boolean } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null, attributes: { items: Array<{ attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, ckAttributeId: { fullName: string }, attribute: { description: string | null, defaultValues: Array<any> | null, metaData: Array<{ key: string, value: string | null } | null> | null, ckEnum: { ckEnumId: { fullName: string }, values: Array<{ key: number | null, name: string | null } | null> } | null, ckRecord: { ckRecordId: { fullName: string } } | null } | null } | null> | null } | null, associations: { in: { all: Array<{ rtRoleId: any, navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, rtTargetCkTypeId: any, rtOriginCkTypeId: any } | null> | null } | null, out: { all: Array<{ rtRoleId: any, navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, rtTargetCkTypeId: any, rtOriginCkTypeId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const EntityFormGetCkTypeDocumentDto = gql`
    query entityFormGetCkType($rtCkTypeId: String!) {
  constructionKit {
    types(rtCkId: $rtCkTypeId, first: 1) {
      items {
        ckTypeId {
          fullName
        }
        rtCkTypeId
        isAbstract
        description
        baseType {
          rtCkTypeId
          isAbstract
          baseType {
            rtCkTypeId
            isAbstract
            baseType {
              rtCkTypeId
              isAbstract
              baseType {
                rtCkTypeId
                isAbstract
                baseType {
                  rtCkTypeId
                  isAbstract
                  baseType {
                    rtCkTypeId
                    isAbstract
                    baseType {
                      rtCkTypeId
                      isAbstract
                      baseType {
                        rtCkTypeId
                        isAbstract
                        baseType {
                          rtCkTypeId
                          isAbstract
                          baseType {
                            rtCkTypeId
                            isAbstract
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        attributes(first: 1000) {
          items {
            attributeName
            attributeValueType
            isOptional
            ckAttributeId {
              fullName
            }
            attribute {
              description
              defaultValues
              metaData {
                key
                value
              }
              ckEnum {
                ckEnumId {
                  fullName
                }
                values {
                  key
                  name
                }
              }
              ckRecord {
                ckRecordId {
                  fullName
                }
              }
            }
          }
        }
        associations {
          in {
            all {
              rtRoleId
              navigationPropertyName
              multiplicity
              rtTargetCkTypeId
              rtOriginCkTypeId
            }
          }
          out {
            all {
              rtRoleId
              navigationPropertyName
              multiplicity
              rtTargetCkTypeId
              rtOriginCkTypeId
            }
          }
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormGetCkTypeDtoGQL extends Apollo.Query<EntityFormGetCkTypeQueryDto, EntityFormGetCkTypeQueryVariablesDto> {
    document = EntityFormGetCkTypeDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }