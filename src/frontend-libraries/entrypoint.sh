#!/bin/sh

export ADMIN_PANEL_URI=${ADMIN_PANEL_URI:-https://localhost:5005}
export CLIENT_ID=${CLIENT_ID:-octo-template-app}
export APP_URI=${APP_URI:-https://localhost:4201}
envsubst < /usr/share/nginx/html/assets/config.template.json > /usr/share/nginx/html/assets/config.json
echo "Config file created."

nginx -g 'daemon off;'
