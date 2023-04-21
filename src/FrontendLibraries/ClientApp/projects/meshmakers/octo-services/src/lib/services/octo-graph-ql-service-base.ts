import {DocumentNode} from "graphql";
import {finalize, map} from "rxjs/operators";
import {Apollo} from "apollo-angular";
import {OctoServiceOptions} from "../options/octo-service-options";
import {PagedGraphResultDto} from "../models/pagedGraphResultDto";
import {PagedResultDto} from "@meshmakers/shared-services";
import {HttpLink} from 'apollo-angular/http';
import {InMemoryCache} from '@apollo/client/core';
import {OperationVariables} from "@apollo/client/core/types";
import {EmptyObject} from "apollo-angular/types";

export class OctoGraphQLServiceBase {

  constructor(private apollo: Apollo, private httpLink: HttpLink, private octoServiceOptions: OctoServiceOptions) {
  }

  protected getEntities<TResult, TEntity, TVariable extends OperationVariables>(tenantId: string, variables: TVariable, queryNode: DocumentNode, watchQuery: boolean, f: (resultSet: PagedResultDto<TEntity>, result: TResult) => void) {

    const query = watchQuery ? this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode) : this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);
    return query.pipe(map(result => {

      const resultSet = new PagedResultDto<TEntity>();

      if (result.errors) {
        console.error(result.errors);
        throw Error("Error in GraphQL statement.")
      } else if (result.data) {
        f(resultSet, result.data);
      }
      return resultSet;
    }));
  }

  protected getGraphEntities<TResult, TP, TC, TVariable extends OperationVariables>(tenantId: string, variables: TVariable, queryNode: DocumentNode, watchQuery: boolean, f: (resultSet: PagedGraphResultDto<TP, TC>, result: TResult) => void) {

    const query = watchQuery ? this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode) : this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);
    return query.pipe(map(result => {

      const resultSet = new PagedGraphResultDto<TP, TC>();

      if (result.errors) {
        console.error(result.errors);
        throw Error("Error in GraphQL statement.")
      } else if (result.data) {
        f(resultSet, result.data);
      }
      return resultSet;
    }));
  }

  protected getEntityDetail<TResult, TEntity, TVariable extends OperationVariables>(tenantId: string, variables: TVariable, queryNode: DocumentNode, watchQuery: boolean, f: (result: TResult) => TEntity) {

    const query = watchQuery ? this.prepareWatchQuery<TResult, TVariable>(tenantId, variables, queryNode) : this.prepareQuery<TResult, TVariable>(tenantId, variables, queryNode);
    return query.pipe(map(result => {

      if (result.errors) {
        console.error(result.errors);
        throw Error("Error in GraphQL statement.")
      } else if (result.data) {
        return f(result.data);
      }
      return null;
    }));
  }

  protected createUpdateEntity<TResult, TEntity, TVariable extends OperationVariables>(tenantId: string, variables: TVariable, queryNode: DocumentNode, f: (result: TResult | null | undefined) => TEntity) {

    this.createApolloForTenant(tenantId);

    return this.apollo.use(tenantId).mutate<TResult>({
      mutation: queryNode,
      variables: variables
    }).pipe(
      map(value => f(value.data)),
      finalize(() => this.apollo.use(tenantId).client.reFetchObservableQueries(true))
    );
  }

  protected deleteEntity<TResult, TVariable extends OperationVariables>(tenantId: string, variables: TVariable, queryNode: DocumentNode, f: (result: TResult | null | undefined) => boolean) {
    this.createApolloForTenant(tenantId);

    return this.apollo.use(tenantId).mutate<TResult>({
      mutation: queryNode,
      variables: variables
    }).pipe(
      map(value => f(value.data)),
      finalize(() => this.apollo.use(tenantId).client.reFetchObservableQueries(true))
    );
  }

  private createApolloForTenant(tenantId: string) {

    const result = this.apollo.use(tenantId);
    if (result) {
      return;
    }

    const uri = `${this.octoServiceOptions.assetServices}tenants/${tenantId}/GraphQL`;

    this.apollo.createNamed(tenantId,
      {
        link: this.httpLink.create({uri}),
        cache: new InMemoryCache({
          dataIdFromObject: o => <string>o['rtId']
        }),
      });
  }

  private prepareWatchQuery<TResult, TVariable extends OperationVariables>(tenantId: string, variables: TVariable, queryNode: DocumentNode) {
    this.createApolloForTenant(tenantId);

    return this.apollo.use(tenantId).watchQuery<TResult>({
      query: queryNode,
      variables: variables
    }).valueChanges;
  }

  private prepareQuery<TResult, TVariable extends OperationVariables>(tenantId: string, variables: TVariable, queryNode: DocumentNode) {
    this.createApolloForTenant(tenantId);

    return this.apollo.use(tenantId).query<TResult>({
      query: queryNode,
      variables: variables,
      fetchPolicy: "network-only"
    });
  }


}
