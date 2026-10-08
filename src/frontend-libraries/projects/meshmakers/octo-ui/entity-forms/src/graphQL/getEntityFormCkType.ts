import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetCkTypeQueryVariablesDto = Types.Exact<{
  rtCkTypeId: Types.Scalars['String']['input'];
}>;


export type EntityFormGetCkTypeQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, description?: string | null, ckTypeId: { __typename?: 'CkTypeId', fullName: string }, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null, attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, ckAttributeId: { __typename?: 'CkAttributeId', fullName: string }, attribute?: { __typename?: 'CkAttribute', description?: string | null, defaultValues?: Array<any | null> | null, metaData?: Array<{ __typename?: 'CkAttributeMetaData', key: string, value?: string | null } | null> | null, ckEnum?: { __typename?: 'CkEnum', ckEnumId: { __typename?: 'CkEnumId', fullName: string }, values: Array<{ __typename?: 'CkEnumValue', key?: number | null, name?: string | null } | null> } | null, ckRecord?: { __typename?: 'CkRecord', ckRecordId: { __typename?: 'CkRecordId', fullName: string } } | null } | null } | null> | null } | null, associations?: { __typename?: 'CkTypeAssociationDirection', in?: { __typename?: 'CkTypeAssociationSource', all?: Array<{ __typename?: 'CkTypeAssociation', rtRoleId: any, navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, rtTargetCkTypeId: any, rtOriginCkTypeId: any } | null> | null } | null, out?: { __typename?: 'CkTypeAssociationSource', all?: Array<{ __typename?: 'CkTypeAssociation', rtRoleId: any, navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, rtTargetCkTypeId: any, rtOriginCkTypeId: any } | null> | null } | null } | null } | null> | null } | null } | null };

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