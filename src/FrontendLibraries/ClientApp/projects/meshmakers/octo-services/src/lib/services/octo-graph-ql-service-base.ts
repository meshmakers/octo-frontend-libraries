import { DocumentNode } from 'graphql';
import { finalize, map } from 'rxjs/operators';
import { Apollo } from 'apollo-angular';
import { OctoServiceOptions } from '../options/octo-service-options';
import { PagedGraphResultDto } from '../models/pagedGraphResultDto';
import { PagedResultDto } from '@meshmakers/shared-services';
import { HttpLink } from 'apollo-angular/http';
import { ApolloQueryResult, InMemoryCache } from '@apollo/client/core';
import { OperationVariables } from '@apollo/client/core/types';
import { Observable } from 'rxjs';

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
    f: (resultSet: PagedResultDto<TEntity>, result: TResult) => void
  ): Observable<PagedResultDto<TEntity>> {
    const query = watchQuery
      ? this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode)
      : this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);
    return query.pipe(
      map((result) => {
        const resultSet = new PagedResultDto<TEntity>();

        if (result.errors != null) {
          console.error(result.errors);
          throw Error('Error in GraphQL statement.');
        } else if (result.data) {
          f(resultSet, result.data);
        }
        return resultSet;
      })
    );
  }

  protected getGraphEntities<TResult, TP, TC, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode,
    watchQuery: boolean,
    f: (resultSet: PagedGraphResultDto<TP, TC>, result: TResult) => void
  ): Observable<PagedGraphResultDto<TP, TC>> {
    const query = watchQuery
      ? this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode)
      : this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);
    return query.pipe(
      map((result) => {
        const resultSet = new PagedGraphResultDto<TP, TC>();

        if (result.errors != null) {
          console.error(result.errors);
          throw Error('Error in GraphQL statement.');
        } else if (result.data) {
          f(resultSet, result.data);
        }
        return resultSet;
      })
    );
  }

  protected getEntityDetail<TResult, TEntity, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode,
    watchQuery: boolean,
    f: (result: TResult) => TEntity
  ): Observable<TEntity | null> {
    const query = watchQuery
      ? this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode)
      : this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);
    return query.pipe(
      map((result) => {
        if (result.errors != null) {
          console.error(result.errors);
          throw Error('Error in GraphQL statement.');
        } else if (result.data) {
          return f(result.data);
        }
        return null;
      })
    );
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
        dataIdFromObject: (o) => <string>o['rtId']
      })
    });
  }

  private prepareWatchQuery<TResult, TVariable extends OperationVariables>(
    tenantId: string,
    variables: TVariable,
    queryNode: DocumentNode
  ): Observable<ApolloQueryResult<TResult>> {
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
  ): Observable<ApolloQueryResult<TResult>> {
    this.createApolloForTenant(tenantId);

    return this.apollo.use(tenantId).query<TResult>({
      query: queryNode,
      variables,
      fetchPolicy: 'network-only'
    });
  }
}
