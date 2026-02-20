import { DocumentNode } from 'graphql';
import { finalize, map } from 'rxjs/operators';
import { Apollo } from 'apollo-angular';
import { OctoServiceOptions } from '../options/octo-service-options';
import { PagedGraphResultDto } from '../models/pagedGraphResultDto';
import { PagedResultDto } from '@meshmakers/shared-services';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, type OperationVariables, type ObservableQuery } from '@apollo/client/core';
import { Observable } from 'rxjs';
import { type DeepPartial } from "@apollo/client/utilities";
import QueryResult = Apollo.QueryResult;

export class OctoGraphQLServiceBase {
  constructor(
    private readonly apollo: Apollo,
    private readonly httpLink: HttpLink,
    private readonly octoServiceOptions: OctoServiceOptions
  ) {}

  protected getEntities<TResult, TEntity, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode,
    watchQuery: boolean,
    f: (resultSet: PagedResultDto<TEntity>, result: NonNullable<TResult> | NonNullable<DeepPartial<TResult>>) => void
  ): Observable<PagedResultDto<TEntity>> {

    if (watchQuery){
      const prepareWatchQuery = this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode);

      return prepareWatchQuery.pipe(
        map((result) => {
          const resultSet = new PagedResultDto<TEntity>();

          if (result.error != null) {
            console.error(result.error);
            throw Error('Error in GraphQL statement.');
          } else if (result.data) {
            f(resultSet, result.data);
          }
          return resultSet;
        })
      );
    } else {
      const prepareQuery = this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);

      return prepareQuery.pipe(
        map((result) => {
          const resultSet = new PagedResultDto<TEntity>();

          if (result.error != null) {
            console.error(result.error);
            throw Error('Error in GraphQL statement.');
          } else if (result.data) {
            f(resultSet, result.data);
          }
          return resultSet;
        })
      );
    }
  }

  protected getGraphEntities<TResult, TP, TC, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode,
    watchQuery: boolean,
    f: (resultSet: PagedGraphResultDto<TP, TC>, result: NonNullable<TResult> | NonNullable<DeepPartial<TResult>>) => void
  ): Observable<PagedGraphResultDto<TP, TC>> {

    if (watchQuery){
      const prepareWatchQuery = this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode);

      return prepareWatchQuery.pipe(
        map((result) => {
          const resultSet = new PagedGraphResultDto<TP, TC>();

          if (result.error != null) {
            console.error(result.error);
            throw Error('Error in GraphQL statement.');
          } else if (result.data) {
            f(resultSet, result.data);
          }
          return resultSet;
        })
      );
    } else{
      const prepareQuery = this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);

      return prepareQuery.pipe(
        map((result) => {
          const resultSet = new PagedGraphResultDto<TP, TC>();

          if (result.error != null) {
            console.error(result.error);
            throw Error('Error in GraphQL statement.');
          } else if (result.data) {
            f(resultSet, result.data);
          }
          return resultSet;
        })
      );
    }
  }

  protected getEntityDetail<TResult, TEntity, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode,
    watchQuery: boolean,
    f: (result: NonNullable<TResult> | NonNullable<DeepPartial<TResult>>) => TEntity
  ): Observable<TEntity | null> {


    if (watchQuery){
      const query = this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode);
      return query.pipe(
        map((result) => {
          if (result.error != null) {
            console.error(result.error);
            throw Error('Error in GraphQL statement.');
          } else if (result.data) {
            return f(result.data);
          }
          return null;
        })
      );
    }else {
      const query = this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);
      return query.pipe(
        map((result) => {
          if (result.error != null) {
            console.error(result.error);
            throw Error('Error in GraphQL statement.');
          } else if (result.data) {
            return f(result.data);
          }
          return null;
        })
      );
    }
  }

  protected createUpdateEntity<TResult, TEntity, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode,
    f: (result: TResult | null | undefined) => TEntity
  ): Observable<TEntity> {
    this.createApolloForTenant(tenantId);

    return this.apollo
      .use(tenantId)
      .mutate<TResult>({
        mutation: queryNode,
        variables
      })
      .pipe(
        map((value) => f(value.data)),
        finalize(() => {
          const promise = this.apollo.use(tenantId).client.reFetchObservableQueries(true);
          promise
            .then(() => {})
            .catch((error: string) => {
              console.error(error);
            });
        })
      );
  }

  protected deleteEntity<TResult, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode,
    f: (result: TResult | null | undefined) => boolean
  ): Observable<boolean> {
    this.createApolloForTenant(tenantId);

    return this.apollo
      .use(tenantId)
      .mutate<TResult>({
        mutation: queryNode,
        variables
      })
      .pipe(
        map((value) => f(value.data)),
        finalize(() => {
          const promise = this.apollo.use(tenantId).client.reFetchObservableQueries(true);
          promise
            .then(() => {})
            .catch((error: string) => {
              console.error(error);
            });
        })
      );
  }

  private createApolloForTenant(tenantId: string): void {
    const result = this.apollo.use(tenantId);
    if (result) {
      return;
    }

    const service = this.octoServiceOptions.assetServices ?? '';
    const uri = `${service}tenants/${tenantId}/GraphQL`;

    this.apollo.createNamed(tenantId, {
      link: this.httpLink.create({ uri }),
      cache: new InMemoryCache({
        dataIdFromObject: (o) => (o['rtId'] as string)
      })
    });
  }

  private prepareWatchQuery<TResult, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode
  ): Observable<ObservableQuery.Result<TResult>> {
    this.createApolloForTenant(tenantId);

    return this.apollo.use(tenantId).watchQuery<TResult>({
      query: queryNode,
      variables
    }).valueChanges;
  }

  private prepareQuery<TResult, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode
  ): Observable<QueryResult<TResult>> {
    this.createApolloForTenant(tenantId);

    return this.apollo.use(tenantId).query<TResult>({
      query: queryNode,
      variables,
      fetchPolicy: 'network-only'
    });
  }
}
