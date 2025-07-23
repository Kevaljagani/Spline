const WebSocket = require('ws');
const ProxyController = require('./ProxyController');

class WebSocketController {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.setupWebSocketHandlers();
    ProxyController.setWebSocketServer(this.wss);
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('Frontend connected via WebSocket');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(data, ws);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('Frontend disconnected');
      });
    });
  }

  handleClientMessage(data) {
    const { type, requestId, action } = data;
    
    if (type === 'proxy_decision') {
      ProxyController.handleUserDecision(requestId, action);
    }
  }

  getWebSocketServer() {
    return this.wss;
  }
}

module.exports = WebSocketController;