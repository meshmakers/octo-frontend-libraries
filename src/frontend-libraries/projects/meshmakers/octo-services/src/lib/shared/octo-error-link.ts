import {onError} from '@apollo/client/link/error';
import { inject, Injectable, Injector } from "@angular/core";
import {MessageService} from "@meshmakers/shared-services";
import {ApolloLink} from '@apollo/client/core';
import { CombinedGraphQLErrors, ErrorLike } from "@apollo/client";

@Injectable()
export class OctoErrorLink extends ApolloLink {
  private errorLink: ApolloLink;
  private readonly injector: Injector = inject(Injector);

  constructor() {
    super();

    // There is currently no other way to inject a service into an Apollo Link,
    // because Apollo deprecated without replacement
    this.errorLink = onError(({error, operation, forward}) => {

      if (error) {

        if (error instanceof CombinedGraphQLErrors) {
          this.showError(error);
        } else {
          this.showErrorLike(error);
        }
      }

      return forward(operation);
    });
  }

  private showErrorLike(error: ErrorLike): void {
    const messageService = this.injector.get(MessageService);

    console.error(error);

    messageService.showError(error.message);
  }

  private showError(combinedGraphQLErrors: CombinedGraphQLErrors): void{
    const messageService = this.injector.get(MessageService);

    let title = 'GraphQL error';
    let details = '';
    for (const error of combinedGraphQLErrors.errors) {

      console.error(error);

      if (title == 'GraphQL error') {
        title = `${error.message}`;
      } else {
        details += `======================`;
        details += `${error.message}`;
      }

      if (error.extensions) {
        // check for custom error properties, OctoDetails should be an array of MessageDetails
        if (error.extensions['code']) {
          details += `Global Result Code: ${error.extensions['code']}`;
        }

        if (error.extensions['OctoDetails'] && Array.isArray(error.extensions['OctoDetails'])) {

          // iterate over the details and add them to the message
          for (const detail of error.extensions['OctoDetails']) {
            if (detail.message) {
              details += `\n\n✗ ${detail.message}`;
            }

            if (detail.details && Array.isArray(detail.details)) {
              for (const subDetail of detail.details) {
                if (subDetail) {
                  details += `\n  • ${subDetail}`;
                }
              }
            }
          }
        }
      }
      messageService.showErrorWithDetails(title, details);
    }

  }

  override request(operation: any, forward: any) {
    return this.errorLink.request(operation, forward);
  }
}
