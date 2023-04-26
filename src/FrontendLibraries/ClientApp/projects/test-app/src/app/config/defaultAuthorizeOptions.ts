import {AuthorizeOptions} from "@meshmakers/shared-auth";

export const defaultAuthorizeOptions: AuthorizeOptions = {

  // Url of the Identity Provider
  issuer: '', // defined by backend using endpoint _configuration/{clientId}

  // URL of the SPA to redirect the user to after login
  redirectUri: window.location.origin,
  postLogoutRedirectUri: window.location.origin,

  // The SPA's id. The SPA is registered with this id at the auth-server
  clientId: 'octo-admin-panel',

  // set the scope for the permissions the client should request
  // The first three are defined by OIDC. The 4th is a use case-specific one
  scope: '', // defined by backend using endpoint _configuration/{clientId}

  showDebugInformation: true,
  sessionChecksEnabled: true,

  wellKnownServiceUris: []
}
