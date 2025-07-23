const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const Request = require('../models/Request');

class ProxyController {
  constructor() {
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.websocketServer = null;
  }

  setWebSocketServer(wss) {
    this.websocketServer = wss;
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
      
      try {
        // Create promise to wait for user decision
        const userDecision = new Promise((resolve) => {
          this.pendingRequests.set(currentRequestId, { 
            resolve, 
            requestModel 
          });
        });
        
        // Broadcast request to frontend
        this.broadcastRequest(requestModel);
        
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
        
      } catch (error) {
        console.error('Error processing request:', error);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  }

  async handleConnect(req, socket, head) {
    const [hostname, port] = req.url.split(':');
    
    
    try {
      // Directly forward CONNECT requests without interception
      this.forwardConnect(req, socket, head, hostname, port || 443, null);
    } catch (error) {
      console.error('Error processing CONNECT:', error);
      socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
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
    
    const proxyReq = http.request(options, (proxyRes) => {
      // Capture response for frontend
      let responseBody = '';
      let responseBodyBuffer = Buffer.alloc(0);
      
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Capture response data
      proxyRes.on('data', (chunk) => {
        responseBodyBuffer = Buffer.concat([responseBodyBuffer, chunk]);
        res.write(chunk);
      });
      
      proxyRes.on('end', () => {
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
        
        // Send response to frontend
        this.broadcastResponse(requestModel.id, {
          statusCode: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: responseBody,
          timestamp: new Date().toISOString()
        });
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
    if (!this.websocketServer) return;
    
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
}

module.exports = new ProxyController();