const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Create certs directory if it doesn't exist
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
}

console.log('Generating Torpedo Proxy certificates...');

// Generate CA certificate
console.log('1. Generating CA certificate...');

const caKeys = forge.pki.rsa.generateKeyPair(2048);
const caCert = forge.pki.createCertificate();

caCert.publicKey = caKeys.publicKey;
caCert.serialNumber = '01';
caCert.validity.notBefore = new Date();
caCert.validity.notAfter = new Date();
caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 10);

const caAttrs = [
  { name: 'countryName', value: 'US' },
  { name: 'stateOrProvinceName', value: 'CA' },
  { name: 'localityName', value: 'San Francisco' },
  { name: 'organizationName', value: 'Torpedo Proxy' },
  { name: 'organizationalUnitName', value: 'Certificate Authority' },
  { name: 'commonName', value: 'Torpedo Proxy CA' }
];

caCert.setSubject(caAttrs);
caCert.setIssuer(caAttrs);

caCert.setExtensions([
  {
    name: 'basicConstraints',
    cA: true,
    critical: true
  },
  {
    name: 'keyUsage',
    keyCertSign: true,
    cRLSign: true,
    critical: true
  },
  {
    name: 'subjectKeyIdentifier'
  }
]);

// Self-sign the CA certificate
caCert.sign(caKeys.privateKey, forge.md.sha256.create());

// Save CA certificate and private key
const caPem = forge.pki.certificateToPem(caCert);
const caKeyPem = forge.pki.privateKeyToPem(caKeys.privateKey);

fs.writeFileSync(path.join(certsDir, 'ca-cert.pem'), caPem);
fs.writeFileSync(path.join(certsDir, 'ca-key.pem'), caKeyPem);
console.log('   CA certificate saved to: certs/ca-cert.pem');
console.log('   CA private key saved to: certs/ca-key.pem');

console.log('\n✅ Certificate generation complete!');
console.log('\n📋 Next steps:');
console.log('1. Import certs/ca-cert.pem into Firefox:');
console.log('   - Go to Settings > Privacy & Security > Certificates > View Certificates');
console.log('   - Click "Authorities" tab > "Import"');
console.log('   - Select ca-cert.pem and check "Trust this CA to identify websites"');
console.log('2. Restart your Torpedo proxy server');
console.log('3. HTTPS requests will now be intercepted!');