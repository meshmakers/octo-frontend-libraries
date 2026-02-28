# Ensure that you have logged in to identity services (om_login_local.ps1)

Write-Host "Configuring Template App..."
$client_Id = "octo-template-app"
$uri =  "https://localhost:4201/"
$frontChannelLogoutUri = "https://localhost:4201/logout/callback"

octo-cli -c AddAuthorizationCodeClient --clienturi $uri --clientid $client_Id --redirectUri $uri --name "OctoMesh Template App" --frontChannelLogoutUri $frontChannelLogoutUri
octo-cli -c AddScopeToClient --clientid $client_Id --name "assetSystemAPI.full_access"
octo-cli -c AddScopeToClient --clientid $client_Id --name "identityAPI.full_access"
octo-cli -c AddScopeToClient --clientid $client_Id --name "botAPI.full_access"
octo-cli -c AddScopeToClient --clientid $client_Id --name "communicationSystemAPI.full_access"
octo-cli -c AddScopeToClient --clientid $client_Id --name "communicationTenantAPI.full_access"
