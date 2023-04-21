import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AuthorizeService} from './authorize.service';

@Injectable()
export class AuthorizeInterceptor implements HttpInterceptor {

  accessToken: string | null;

  constructor(private authorize: AuthorizeService) {

    this.accessToken = null;
    authorize.getAccessToken().subscribe(value => this.accessToken = value);

  }

  private static isSameOriginUrl(req: any) {
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
    if (/^\/[^\/].*/.test(req.url)) {
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
  private processRequestWithToken(token: string | null, req: HttpRequest<any>, next: HttpHandler) {
    if (!!token && (AuthorizeInterceptor.isSameOriginUrl(req) || this.isKnownServiceUri(req))) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req);
  }

  private isKnownServiceUri(req: any) {

    const serviceUris = this.authorize.getServiceUris();

    if (serviceUris) {
      for (let i = 0; i < serviceUris.length; i++) {
        if (req.url.startsWith(`${serviceUris[i]}`)) {
          return true;
        }
      }
    }

    // It's an absolute or protocol relative url that
    // doesn't have the same origin.
    return false;
  }
}
