const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const forge = require('node-forge');
const Request = require('../models/Request');
const database = require('../database');

class ProxyController {
  constructor() {
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.websocketServer = null;
    this.scopedDomains = new Set();
    this.isInterceptEnabled = false;
    this.loadSSLCertificates();
  }

  loadSSLCertificates() {
    try {
      const caCertPath = path.join(__dirname, '../certs/ca-cert.pem');
      const caKeyPath = path.join(__dirname, '../certs/ca-key.pem');
      
      this.caCert = forge.pki.certificateFromPem(fs.readFileSync(caCertPath, 'utf8'));
      this.caKey = forge.pki.privateKeyFromPem(fs.readFileSync(caKeyPath, 'utf8'));
      this.certificateCache = new Map();
      
    } catch (error) {
      console.error('Failed to load CA certificates:', error.message);
      this.caCert = null;
      this.caKey = null;
    }
  }

  setWebSocketServer(wss) {
    this.websocketServer = wss;
  }

  generateCertificateForDomain(domain) {
    if (this.certificateCache.has(domain)) {
      return this.certificateCache.get(domain);
    }

    if (!this.caCert || !this.caKey) {
      throw new Error('CA certificate not loaded');
    }

    // Generate key pair for the domain
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = Math.floor(Math.random() * 100000).toString();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    // Set subject for the domain
    cert.setSubject([
      { name: 'countryName', value: 'US' },
      { name: 'stateOrProvinceName', value: 'CA' },
      { name: 'localityName', value: 'San Francisco' },
      { name: 'organizationName', value: 'Torpedo Proxy' },
      { name: 'organizationalUnitName', value: 'Generated Certificate' },
      { name: 'commonName', value: domain }
    ]);

    // Set issuer to CA
    cert.setIssuer(this.caCert.subject.attributes);

    // Set extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: domain },
          { type: 2, value: `*.${domain}` }
        ]
      }
    ]);

    // Sign with CA key
    cert.sign(this.caKey, forge.md.sha256.create());

    const certificateData = {
      cert: forge.pki.certificateToPem(cert),
      key: forge.pki.privateKeyToPem(keys.privateKey)
    };

    this.certificateCache.set(domain, certificateData);
    return certificateData;
  }

  async handleProxyRequest(req, res) {

    const currentRequestId = ++this.requestId;
    
    // Create request model
    const requestModel = new Request(
      currentRequestId,
      req.method,
      req.url,
      req.headers,
      null,
      req.headers.host
    );
    
    
    // Read request body if present
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      if (body) {
        requestModel.body = body;
      }
      
      // Save request to database if host is in scoped domains
      if (this.scopedDomains.has(requestModel.host)) {
        try {
          await database.saveRequest(requestModel);
        } catch (dbError) {
          console.error('Error saving request to database:', dbError);
        }
      }
      
      try {
        
        if (this.isInterceptEnabled) {
          // Broadcast request to frontend for manual review
          this.broadcastRequest(requestModel);
          
          // Create promise to wait for user decision
          const userDecision = new Promise((resolve) => {
            this.pendingRequests.set(currentRequestId, { 
              resolve, 
              requestModel 
            });
          });
          
          // Wait for user decision with timeout
          const shouldForward = await Promise.race([
            userDecision,
            new Promise(resolve => setTimeout(() => resolve(false), 30000))
          ]);
          
          if (shouldForward) {
            await this.forwardRequest(req, res, requestModel, body);
          } else {
            this.dropRequest(res, requestModel);
          }
        } else {
          // Auto-forward when intercept is disabled (don't broadcast to frontend)
          await this.forwardRequest(req, res, requestModel, body);
        }
        
      } catch (error) {
        console.error('Error processing request:', error);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  }

  async handleConnect(req, socket, head) {
    const [hostname, port] = req.url.split(':');
    
    if (!this.caCert || !this.caKey) {
      console.error('CA certificates not loaded, falling back to direct forwarding');
      this.forwardConnect(req, socket, head, hostname, port || 443, null);
      return;
    }
    
    try {
      // Perform SSL termination to intercept HTTPS traffic
      this.interceptHTTPS(req, socket, head, hostname, port || 443);
    } catch (error) {
      console.error('Error processing CONNECT:', error);
      socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    }
  }

  interceptHTTPS(req, socket, head, hostname, port) {
    // Tell client that connection is established
    socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
    
    try {
      // Generate certificate for this domain
      const { cert, key } = this.generateCertificateForDomain(hostname);
      
      // Create HTTPS server with generated certificate
      const httpsServer = https.createServer({ cert, key }, async (clientReq, clientRes) => {
        try {
          // Modify the request URL to include the original hostname
          clientReq.url = `https://${hostname}:${port}${clientReq.url}`;
          clientReq.headers.host = hostname;
          
          
          // Use existing HTTP handling logic for intercepted HTTPS requests
          await this.handleProxyRequest(clientReq, clientRes);
          
        } catch (error) {
          console.error('Error handling HTTPS request:', error);
          clientRes.writeHead(500);
          clientRes.end('Internal Server Error');
        }
      });

      httpsServer.on('error', (error) => {
        console.error('HTTPS server error:', error);
        socket.end();
      });

      // Handle the encrypted connection by emitting it to the HTTPS server
      httpsServer.emit('connection', socket);
      
    } catch (error) {
      console.error('Error setting up TLS interception:', error);
      socket.end();
    }
  }

  forwardConnect(req, socket, head, hostname, port, requestModel) {
    const targetSocket = net.connect(port, hostname, () => {
      socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
      
      // Pipe data between client and target
      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
      
      if (requestModel) {
        requestModel.markForwarded();
      }
    });
    
    targetSocket.on('error', (err) => {
      console.error('CONNECT target error:', err);
      socket.end('HTTP/1.1 500 Connection failed\r\n\r\n');
    });
  }

  dropConnect(socket, requestModel) {
    socket.end('HTTP/1.1 403 Connection blocked by Torpedo\r\n\r\n');
    requestModel.markDropped();
  }

  async forwardRequest(req, res, requestModel, body) {    
    // Handle both absolute URLs and relative paths
    let targetUrl;
    if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
      targetUrl = req.url;
    } else {
      targetUrl = `http://${req.headers.host}${req.url}`;
    }
    const parsedUrl = new URL(targetUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: { ...req.headers }
    };
    
    delete options.headers['proxy-connection'];
    
    // Use https.request for HTTPS URLs, http.request for HTTP URLs
    const requestModule = parsedUrl.protocol === 'https:' ? https : http;
    const proxyReq = requestModule.request(options, (proxyRes) => {
      // Capture response for frontend
      let responseBody = '';
      let responseBodyBuffer = Buffer.alloc(0);
      
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Capture response data
      proxyRes.on('data', (chunk) => {
        responseBodyBuffer = Buffer.concat([responseBodyBuffer, chunk]);
        res.write(chunk);
      });
      
      proxyRes.on('end', async () => {
        res.end();
        
        // Convert buffer to string for display, handle binary content
        try {
          responseBody = responseBodyBuffer.toString('utf8');
          // Check if it's likely binary content
          if (responseBodyBuffer.length > 0 && responseBody.includes('\ufffd')) {
            responseBody = `[Binary content - ${responseBodyBuffer.length} bytes]`;
          }
        } catch (error) {
          responseBody = `[Binary content - ${responseBodyBuffer.length} bytes]`;
        }
        
        // Create response object
        const responseData = {
          statusCode: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: responseBody,
          timestamp: new Date().toISOString()
        };
        
        // Send response to frontend
        this.broadcastResponse(requestModel.id, responseData);
        
        // Save response to database if host is in scoped domains
        if (this.scopedDomains.has(requestModel.host)) {
          try {
            await database.saveResponse(requestModel.id, responseData);
          } catch (dbError) {
            console.error('Error saving response to database:', dbError);
          }
        }
      });
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.writeHead(500);
      res.end('Proxy Error');
      
      // Send error response to frontend
      this.broadcastResponse(requestModel.id, {
        statusCode: 500,
        headers: {},
        body: 'Proxy Error: ' + err.message,
        timestamp: new Date().toISOString()
      });
    });
    
    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
    
    requestModel.markForwarded();
  }

  dropRequest(res, requestModel) {
    res.writeHead(200);
    res.end('Request dropped by Torpedo');
    requestModel.markDropped();
  }

  handleUserDecision(requestId, action) {
    if (this.pendingRequests.has(requestId)) {
      const { resolve, requestModel } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      resolve(action === 'forward');
    }
  }

  broadcastRequest(requestModel) {
    if (!this.websocketServer) {
      return;
    }
    
    const message = JSON.stringify({
      type: 'new_request',
      ...requestModel.toJSON()
    });
    
    
    this.websocketServer.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  broadcastResponse(requestId, response) {
    if (!this.websocketServer) {
      console.warn(`No WebSocket server available to broadcast response for request ${requestId}`);
      return;
    }
    
    const message = JSON.stringify({
      type: 'response',
      requestId: requestId,
      response: response
    });
    
    let clientCount = 0;
    this.websocketServer.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
        clientCount++;
      }
    });
  }

  getPendingRequests() {
    return Array.from(this.pendingRequests.keys()).map(id => {
      const { requestModel } = this.pendingRequests.get(id);
      return requestModel.toJSON();
    });
  }

  addToScope(domain) {
    this.scopedDomains.add(domain);
  }

  setInterceptEnabled(enabled) {
    this.isInterceptEnabled = enabled;
  }
}

module.exports = new ProxyController();