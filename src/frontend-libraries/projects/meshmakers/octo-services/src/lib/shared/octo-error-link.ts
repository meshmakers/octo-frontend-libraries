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

    // Dedupe identical errors before rendering. A list query with one broken field produces one
    // error PER ROW (observed on AB#4771: 13 rollup rows each yielded the same "Error trying to
    // resolve field 'columns'" / INVALID_OPERATION), which used to flood the toast with the same
    // message N times. Identical (message, code, OctoDetails) tuples collapse into one entry with
    // an "(× N)" suffix; every raw error is still logged to the console individually.
    const deduped = new Map<string, { error: (typeof combinedGraphQLErrors.errors)[number]; count: number }>();
    for (const error of combinedGraphQLErrors.errors) {
      console.error(error);

      const key = JSON.stringify([
        error.message,
        error.extensions?.['code'] ?? null,
        error.extensions?.['OctoDetails'] ?? null,
      ]);
      const entry = deduped.get(key);
      if (entry) {
        entry.count++;
      } else {
        deduped.set(key, { error, count: 1 });
      }
    }

    let title = 'GraphQL error';
    let details = '';
    for (const { error, count } of deduped.values()) {

      const message = count > 1 ? `${error.message} (× ${count})` : `${error.message}`;
      if (title == 'GraphQL error') {
        title = message;
      } else {
        details += `======================`;
        details += message;
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
