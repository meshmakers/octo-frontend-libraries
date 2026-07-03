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
    this.errorLink = onError(({error}) => {

      if (error) {

        if (error instanceof CombinedGraphQLErrors) {
          this.showError(error);
        } else {
          this.showErrorLike(error);
        }
      }

      // Display-only link: do NOT return forward(operation). Returning it re-runs the failed
      // operation (re-submitting the mutation) and re-invokes this handler, so the same error
      // toast appears twice — observed on the AB#4289 rollup-activation reject. Returning nothing
      // lets the original error propagate to the caller's own error handling.
    });
  }

  private showErrorLike(error: ErrorLike): void {
    // Network connectivity errors (HTTP status 0) are already handled by MmHttpErrorInterceptor
    // which either shows the connection error overlay (via ON_CONNECTION_LOST) or a toast.
    // Suppress the raw "Http failure response for ...: 0 Unknown Error" message here.
    if ('status' in error && (error as Record<string, unknown>)['status'] === 0) {
      return;
    }

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
    }

    // Show ONE toast after accumulating every error into title + details. Calling this inside the
    // loop showed one toast per error in the array — and since `title` is only set by the first
    // error, a multi-error response (e.g. a domain error + GraphQL's generic "Error trying to
    // resolve field …" wrapper) surfaced the same title twice (the AB#4289 reject appeared doubled).
    messageService.showErrorWithDetails(title, details);
  }

  override request(operation: ApolloLink.Operation, forward: ApolloLink.ForwardFunction) {
    return this.errorLink.request(operation, forward);
  }
}
