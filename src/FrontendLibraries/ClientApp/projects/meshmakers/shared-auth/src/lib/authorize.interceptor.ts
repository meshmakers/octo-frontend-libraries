import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthorizeService } from './authorize.service';

@Injectable()
export class AuthorizeInterceptor implements HttpInterceptor {
  accessToken: string | null;

  constructor(private readonly authorize: AuthorizeService) {
    this.accessToken = null;
    authorize.getAccessToken().subscribe((value) => (this.accessToken = value));
  }

  private static isSameOriginUrl(req: HttpRequest<any>): boolean {
    // It's an absolute url with the same origin.
    if (req.url.startsWith(`${window.location.origin}/`)) {
      return true;
    }

    // It's a protocol relative url with the same origin.
    // For example: //www.example.com/api/Products
    if (req.url.startsWith(`//${window.location.host}/`)) {
      return true;
    }

    // It's a relative url like /api/Products
    if (/^\/[^/].*/.test(req.url)) {
      return true;
    }

    // It's an absolute or protocol relative url that
    // doesn't have the same origin.
    return false;
  }

  // Checks if there is an access_token available in the authorize service
  // and adds it to the request in case it's targeted at the same origin as the

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return this.processRequestWithToken(this.accessToken, req, next);
  }

  // single page application.
  private processRequestWithToken(token: string | null, req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!!token && (AuthorizeInterceptor.isSameOriginUrl(req) || this.isKnownServiceUri(req))) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req);
  }

  private isKnownServiceUri(req: any): boolean {
    const serviceUris = this.authorize.getServiceUris();

    if (serviceUris != null) {
      for (const serviceUri of serviceUris) {
        if (req.url.startsWith(`${serviceUri}`)) {
          return true;
        }
      }
    }

    // It's an absolute or protocol relative url that
    // doesn't have the same origin.
    return false;
  }
}
