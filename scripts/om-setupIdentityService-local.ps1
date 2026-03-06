# Ensure that you have logged in to identity services (om_login_local.ps1)

Write-Host "Configuring Demo App..."
$client_Id = "octo-demo-app"
$uri =  "https://localhost:4201/"
$frontChannelLogoutUri = "https://localhost:4201/logout/callback"

octo-cli -c AddAuthorizationCodeClient --clienturi $uri --clientid $client_Id --redirectUri $uri --name "OctoMesh Demo App" --frontChannelLogoutUri $frontChannelLogoutUri
octo-cli -c AddScopeToClient --clientid $client_Id --name "octo_api"

Write-Host "Configuring Legacy Demo App..."
$legacy_client_Id = "octo-legacy-demo-app"
$legacy_uri = "https://localhost:4202/"
$legacy_frontChannelLogoutUri = "https://localhost:4202/"

octo-cli -c AddAuthorizationCodeClient --clienturi $legacy_uri --clientid $legacy_client_Id --redirectUri $legacy_uri --name "OctoMesh Legacy Demo App" --frontChannelLogoutUri $legacy_frontChannelLogoutUri
octo-cli -c AddScopeToClient --clientid $legacy_client_Id --name "octo_api"
