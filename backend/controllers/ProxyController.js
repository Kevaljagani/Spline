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
    // // Skip CONNECT method for HTTPS tunneling - let it pass through
    // if (req.method === 'CONNECT') {
    //   return this.handleConnectPassthrough(req, res);
    // }

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
    
    console.log(`Intercepted request ${currentRequestId}: ${req.method} ${req.url}`);
    
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
    const currentRequestId = ++this.requestId;
    const [hostname, port] = req.url.split(':');
    
    // Create request model for CONNECT
    const requestModel = new Request(
      currentRequestId,
      'CONNECT',
      req.url,
      req.headers,
      null,
      hostname
    );
    
    console.log(`Intercepted CONNECT request ${currentRequestId}: ${req.url}`);
    
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
        this.forwardConnect(req, socket, head, hostname, port || 443, requestModel);
      } else {
        this.dropConnect(socket, requestModel);
      }
      
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
      
      requestModel.markForwarded();
      console.log(`CONNECT request ${requestModel.id} forwarded to ${hostname}:${port}`);
    });
    
    targetSocket.on('error', (err) => {
      console.error('CONNECT target error:', err);
      socket.end('HTTP/1.1 500 Connection failed\r\n\r\n');
    });
  }

  dropConnect(socket, requestModel) {
    console.log(`CONNECT request ${requestModel.id} dropped`);
    socket.end('HTTP/1.1 403 Connection blocked by Torpedo\r\n\r\n');
    requestModel.markDropped();
  }

  async forwardRequest(req, res, requestModel, body) {
    const targetUrl = `http://${req.headers.host}${req.url}`;
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
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.writeHead(500);
      res.end('Proxy Error');
    });
    
    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
    
    requestModel.markForwarded();
    console.log(`Request ${requestModel.id} forwarded`);
  }

  dropRequest(res, requestModel) {
    console.log(`Request ${requestModel.id} dropped`);
    res.writeHead(200);
    res.end('Request dropped by Torpedo');
    requestModel.markDropped();
  }

  handleUserDecision(requestId, action) {
    if (this.pendingRequests.has(requestId)) {
      const { resolve, requestModel } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      console.log(`User decision for request ${requestId}: ${action}`);
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

  getPendingRequests() {
    return Array.from(this.pendingRequests.keys()).map(id => {
      const { requestModel } = this.pendingRequests.get(id);
      return requestModel.toJSON();
    });
  }
}

module.exports = new ProxyController();