const express = require('express');
const ProxyController = require('../controllers/ProxyController');
const database = require('../database');

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

router.post('/add-to-scope', (req, res) => {
  const { domain } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'domain is required' });
  }
  
  ProxyController.addToScope(domain);
  res.json({ success: true, message: `Domain ${domain} added to scope` });
});

router.post('/set-intercept', (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  
  ProxyController.setInterceptEnabled(enabled);
  res.json({ success: true, message: `Intercept ${enabled ? 'enabled' : 'disabled'}` });
});

// Get all stored requests from database
router.get('/stored-requests', async (req, res) => {
  try {
    const requests = await database.getRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching stored requests:', error);
    res.status(500).json({ error: 'Failed to fetch stored requests' });
  }
});

// Get responses for a specific request
router.get('/stored-responses/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const responses = await database.getResponses(parseInt(requestId));
    res.json(responses);
  } catch (error) {
    console.error('Error fetching stored responses:', error);
    res.status(500).json({ error: 'Failed to fetch stored responses' });
  }
});

module.exports = router;