const express = require('express');
const ProxyController = require('../controllers/ProxyController');

const router = express.Router();

// Health check endpoint
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from Torpedo!' });
});

// Get pending requests
router.get('/pending-requests', (req, res) => {
  const pending = ProxyController.getPendingRequests();
  res.json(pending);
});

// Manual decision endpoint (optional, mainly for testing)
router.post('/proxy-decision', (req, res) => {
  const { requestId, action } = req.body;
  
  if (!requestId || !action) {
    return res.status(400).json({ error: 'requestId and action are required' });
  }
  
  if (!['forward', 'drop'].includes(action)) {
    return res.status(400).json({ error: 'action must be "forward" or "drop"' });
  }
  
  ProxyController.handleUserDecision(requestId, action);
  res.json({ success: true, message: `Request ${requestId} ${action}ed` });
});

module.exports = router;