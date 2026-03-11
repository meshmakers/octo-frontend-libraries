# Ensure that you have logged in to identity services (e. g. om_login_local.ps1)

# Delete the clients
octo-cli -c DeleteClient --clientid octo-demo-app
octo-cli -c DeleteClient --clientid octo-legacy-demo-app
