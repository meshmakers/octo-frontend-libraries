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
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** The `DateTime` scalar type represents a date and time. `DateTime` expects timestamps to be formatted in accordance with the [ISO-8601](https://en.wikipedia.org/wiki/ISO_8601) standard. */
  DateTime: any;
  Decimal: any;
  OspObjectIdType: any;
  SimpleScalarType: any;
};

export type FieldFilterDto = {
  attributeName: Scalars['String'];
  comparisonValue?: InputMaybe<Scalars['SimpleScalarType']>;
  operator?: InputMaybe<FieldFilterOperatorsDto>;
};

/** Defines the operator of field compare */
export enum FieldFilterOperatorsDto {
  EqualsDto = 'EQUALS',
  GreaterEqualThanDto = 'GREATER_EQUAL_THAN',
  GreaterThanDto = 'GREATER_THAN',
  InDto = 'IN',
  LessEqualThanDto = 'LESS_EQUAL_THAN',
  LessThanDto = 'LESS_THAN',
  LikeDto = 'LIKE',
  MatchRegExDto = 'MATCH_REG_EX',
  NotEqualsDto = 'NOT_EQUALS',
  NotInDto = 'NOT_IN',
  NotMatchRegExDto = 'NOT_MATCH_REG_EX'
}

/** The scope of the construction kit model */
export enum ScopesDto {
  ApplicationDto = 'APPLICATION',
  Layer_2Dto = 'LAYER_2',
  Layer_3Dto = 'LAYER_3',
  Layer_4Dto = 'LAYER_4',
  SystemDto = 'SYSTEM'
}

export type SearchFilterDto = {
  attributeNames?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  language?: InputMaybe<Scalars['String']>;
  searchTerm: Scalars['String'];
  type?: InputMaybe<SearchFilterTypesDto>;
};

/** The type of search that is used (a text based search using text analysis (high performance, scoring, maybe more false positives) or filtering of attributes (lower performance, more exact results) */
export enum SearchFilterTypesDto {
  AttributeFilterDto = 'ATTRIBUTE_FILTER',
  TextSearchDto = 'TEXT_SEARCH'
}

export type SortDto = {
  attributeName: Scalars['String'];
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
