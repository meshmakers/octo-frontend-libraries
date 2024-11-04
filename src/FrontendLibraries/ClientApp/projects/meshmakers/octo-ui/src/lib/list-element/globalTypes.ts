/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

//==============================================================
// START Enums and Input Objects
//==============================================================
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;

/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: any; output: any; }
  CkAttributeId: { input: string; output: string; }
  CkEnumId: { input: string; output: string; }
  CkModelId: { input: any; output: any; }
  CkRecordId: { input: string; output: string; }
  CkTypeId: { input: string; output: string; }
  DateTime: { input: any; output: any; }
  Decimal: { input: any; output: any; }
  LargeBinary: { input: any; output: any; }
  OctoObjectId: { input: string; output: string; }
  Seconds: { input: any; output: any; }
  SimpleScalar: { input: any; output: any; }
  ULong: { input: any; output: any; }
  Uri: { input: any; output: any; }
};

export type FieldFilterDto = {
  attributeName: Scalars['String']['input'];
  comparisonValue?: InputMaybe<Scalars['SimpleScalar']['input']>;
  operator: FieldFilterOperatorsDto;
};

/** Defines the operator of field compare */
export enum FieldFilterOperatorsDto {
  AnyEqDto = 'ANY_EQ',
  EqualsDto = 'EQUALS',
  GreaterEqualThanDto = 'GREATER_EQUAL_THAN',
  GreaterThanDto = 'GREATER_THAN',
  InDto = 'IN',
  LessEqualThanDto = 'LESS_EQUAL_THAN',
  LessThanDto = 'LESS_THAN',
  LikeDto = 'LIKE',
  MatchDto = 'MATCH',
  MatchRegExDto = 'MATCH_REG_EX',
  NotEqualsDto = 'NOT_EQUALS',
  NotInDto = 'NOT_IN'
}


export type SearchFilterDto = {
  attributeNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  language?: InputMaybe<Scalars['String']['input']>;
  searchTerm: Scalars['String']['input'];
  type?: InputMaybe<SearchFilterTypesDto>;
};

/** The type of search that is used (a text based search using text analysis (high performance, scoring, maybe more false positives) or filtering of attributes (lower performance, more exact results) */
export enum SearchFilterTypesDto {
  AttributeFilterDto = 'ATTRIBUTE_FILTER',
  TextSearchDto = 'TEXT_SEARCH'
}

export type SortDto = {
  attributeName: Scalars['String']['input'];
  sortOrder?: InputMaybe<SortOrdersDto>;
};

/** Defines the sort order */
export enum SortOrdersDto {
  AscendingDto = 'ASCENDING',
  DefaultDto = 'DEFAULT',
  DescendingDto = 'DESCENDING'
}

//==============================================================
// END Enums and Input Objects
//==============================================================
