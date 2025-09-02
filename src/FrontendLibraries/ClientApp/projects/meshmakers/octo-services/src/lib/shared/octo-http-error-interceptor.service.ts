import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { MessageService } from '@meshmakers/shared-services';
import { inject, Injectable } from "@angular/core";

@Injectable()
export class OctoHttpErrorInterceptor implements HttpInterceptor {

  private readonly messageService = inject(MessageService);

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      retry(0),
      catchError((error: HttpErrorResponse) => {

        if (error.status === 0) {
          this.messageService.showError('Cannot connect to server. Please check your network connection or if the server is down.', 'Connection Error');
        }

        return throwError(() => error);
      })
    );
  }
}
