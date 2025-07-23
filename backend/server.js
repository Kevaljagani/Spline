const express = require('express');
const http = require('http');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const WebSocketController = require('./controllers/WebSocketController');
const ProxyController = require('./controllers/ProxyController');

const app = express();
const PORT = process.env.PORT || 3001;
const PROXY_PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Create HTTP server for Express app
const server = http.createServer(app);

// Initialize WebSocket controller
const webSocketController = new WebSocketController(server);

// Create proxy server
const proxyServer = http.createServer(async (req, res) => {
  console.log(`[PROXY] HTTP ${req.method} ${req.url} from ${req.connection.remoteAddress}`);
  await ProxyController.handleProxyRequest(req, res);
});

// Add error handling for proxy server
proxyServer.on('error', (err) => {
  console.error('Proxy server error:', err);
});

// Handle CONNECT method for HTTPS proxying
proxyServer.on('connect', (req, socket, head) => {
  console.log(`[PROXY] CONNECT ${req.url} from ${socket.remoteAddress}`);
  ProxyController.handleConnect(req, socket, head);
});

// Start servers
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`WebSocket server ready for frontend connections`);
});

proxyServer.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`Proxy server running on 127.0.0.1:${PROXY_PORT}`);
  console.log(`Set Firefox HTTP proxy to localhost:${PROXY_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down servers...');
  server.close();
  proxyServer.close();
  process.exit(0);
});