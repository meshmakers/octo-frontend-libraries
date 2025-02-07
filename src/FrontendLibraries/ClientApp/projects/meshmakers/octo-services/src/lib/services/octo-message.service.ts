import { Injectable } from '@angular/core';
import { MessageService } from "@meshmakers/shared-services";
import { ApolloError } from "@apollo/client/errors";

@Injectable()
export class OctoMessageService{

  constructor(private readonly messageService: MessageService) {
  }

  showErrorWithDetails(error: any): void {
    if (error.constructor.name === ApolloError.prototype.constructor.name)
    {
      console.info("is apollo error");

      if (error.graphQLErrors) {
        for (const graphQLError of error.graphQLErrors) {
          const path = graphQLError.path?.join('.');
          const message = `${path}: ${graphQLError.message}`;
          this.messageService.showError(message, "Request because of GraphQL error failed");
        }
      }
      else if (error.networkError) {
        this.messageService.showError(error.networkError.message, "Request because of network error failed");
      }
      else if (error.clientErrors) {
        let message = "";
        for (const clientError of error.clientErrors) {
          if (message.length > 0) {
            message += "\n";
          }
          message += `${clientError.message}`;
        }
        this.messageService.showError(message, "Request because of client error failed");
      }
      else if (error.protocolErrors) {
        let message = "";
        for (const clientError of error.protocolErrors) {
          if (message.length > 0) {
            message += "\n";
          }
          message += `${clientError.message}`;
        }
        this.messageService.showError(message, "Request because of protocol error failed");
      }
      else {
        this.messageService.showErrorWithDetails(error);
      }
    }
  }

}
