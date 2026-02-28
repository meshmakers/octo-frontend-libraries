openssl req -x509 -nodes -new -sha512 -days 365 -newkey rsa:4096 -keyout ca.key -out ca.pem -subj "/C=AT/CN=DevCA"
openssl x509 -outform pem -in ca.pem -out ca.crt

$content = @'
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names
[alt_names]
# Local hosts
DNS.1 = localhost
DNS.2 = 127.0.0.1
DNS.3 = ::1
# List your domain names here
#DNS.4 = local.dev
#DNS.5 = my-app.dev
#DNS.6 = local.some-app.dev
'@
Set-Content -Path "v3.ext" -Value $content

openssl req -new -nodes -newkey rsa:4096 -keyout localhost.key -out localhost.csr -subj "/C=AT/ST=Salzburg/L=Salzburg/O=meshmakers GmbH/CN=localhost"

openssl x509 -req -sha512 -days 365 -extfile v3.ext -CA ca.crt -CAkey ca.key -CAcreateserial -in localhost.csr -out localhost.crt

Copy-Item -Path localhost.crt -Destination ..\src\frontend-libraries\localhost.crt
Copy-Item -Path localhost.key -Destination ..\src\frontend-libraries\localhost.key
