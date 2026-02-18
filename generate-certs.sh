#!/bin/bash

# Create local certificates for development to avoid "Not Secure" warnings
# This creates certificates that are trusted by the local system

CERT_DIR="./certs"

# Create certificates directory if it doesn't exist
mkdir -p $CERT_DIR

# Generate a private key
openssl genrsa -out $CERT_DIR/dev.key 2048

# Create a certificate signing request (CSR)
openssl req -new -key $CERT_DIR/dev.key -out $CERT_DIR/dev.csr -subj "/C=US/ST=State/L=City/O=Development/OU=Dev/CN=localhost"

# Create a self-signed certificate valid for 1 year
openssl x509 -req -days 365 -in $CERT_DIR/dev.csr -signkey $CERT_DIR/dev.key -out $CERT_DIR/dev.crt

# Create a certificate for the local IP address as well
openssl req -new -key $CERT_DIR/dev.key -out $CERT_DIR/dev-local.csr -subj "/C=US/ST=State/L=City/O=Development/OU=Dev/CN=127.0.0.1"

openssl x509 -req -days 365 -in $CERT_DIR/dev-local.csr -signkey $CERT_DIR/dev.key -out $CERT_DIR/dev-local.crt

echo "Certificates generated in $CERT_DIR"
echo ""
echo "To trust these certificates:"
echo "- macOS: Double-click the .crt files and add to Keychain Access, then trust 'Always Trust'"
echo "- Linux: Copy to /usr/local/share/ca-certificates/ and run sudo update-ca-certificates"
echo "- Windows: Import into Trusted Root Certification Authorities"
