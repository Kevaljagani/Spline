const express = require('express');
const ProxyController = require('../controllers/ProxyController');
const database = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');

const router = express.Router();

// Create payloads directory if it doesn't exist
const payloadsDir = path.join(__dirname, '..', 'payloads');
if (!fs.existsSync(payloadsDir)) {
  fs.mkdirSync(payloadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(payloadsDir, req.body.folderName || 'uploaded-folder');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Payload endpoints

// Get all payload folders
router.get('/payloads', (req, res) => {
  try {
    const folders = fs.readdirSync(payloadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    res.json(folders);
  } catch (error) {
    console.error('Error reading payloads directory:', error);
    res.status(500).json({ error: 'Failed to read payloads directory' });
  }
});

// Get folder contents
router.get('/payloads/:folderName/browse', (req, res) => {
  try {
    const { folderName } = req.params;
    const folderPath = path.join(payloadsDir, folderName);
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const browsePath = req.query.path || '';
    const fullPath = path.join(folderPath, browsePath);

    if (!fullPath.startsWith(folderPath)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const items = fs.readdirSync(fullPath, { withFileTypes: true }).map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'directory' : 'file',
      path: path.join(browsePath, item.name).replace(/\\/g, '/')
    }));

    res.json(items);
  } catch (error) {
    console.error('Error browsing folder:', error);
    res.status(500).json({ error: 'Failed to browse folder' });
  }
});

// Get file content (for txt files)
router.get('/payloads/:folderName/file', (req, res) => {
  try {
    const { folderName } = req.params;
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(payloadsDir, folderName, filePath);
    const folderPath = path.join(payloadsDir, folderName);

    if (!fullPath.startsWith(folderPath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    if (ext !== '.txt') {
      return res.status(400).json({ error: 'Only .txt files can be previewed' });
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ content });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Upload files to create a folder
router.post('/payloads/upload', upload.array('files'), (req, res) => {
  try {
    const { folderName } = req.body;
    if (!folderName) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    res.json({ 
      success: true, 
      message: `Files uploaded to ${folderName}`,
      folderName 
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Clone git repository
router.post('/payloads/clone', async (req, res) => {
  try {
    const { gitUrl, folderName } = req.body;
    
    if (!gitUrl || !folderName) {
      return res.status(400).json({ error: 'Git URL and folder name are required' });
    }

    const clonePath = path.join(payloadsDir, folderName);
    
    if (fs.existsSync(clonePath)) {
      return res.status(400).json({ error: 'Folder already exists' });
    }

    const git = simpleGit();
    await git.clone(gitUrl, clonePath);
    
    res.json({ 
      success: true, 
      message: `Repository cloned to ${folderName}`,
      folderName 
    });
  } catch (error) {
    console.error('Error cloning repository:', error);
    res.status(500).json({ error: 'Failed to clone repository: ' + error.message });
  }
});

// Delete payload folder
router.delete('/payloads/:folderName', (req, res) => {
  try {
    const { folderName } = req.params;
    const folderPath = path.join(payloadsDir, folderName);
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    fs.rmSync(folderPath, { recursive: true, force: true });
    res.json({ success: true, message: `Folder ${folderName} deleted` });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

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

// Replay a request
router.post('/replay-request', async (req, res) => {
  try {
    const { method, url, headers, body } = req.body;
    
    if (!method || !url) {
      return res.status(400).json({ error: 'method and url are required' });
    }

    const https = require('https');
    const http = require('http');
    const urlParse = require('url');
    
    const parsedUrl = urlParse.parse(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const port = parsedUrl.port || (isHttps ? 443 : 80);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: port,
      path: parsedUrl.path,
      method: method,
      headers: headers || {},
      rejectUnauthorized: false // For testing purposes - accept self-signed certs
    };

    const client = isHttps ? https : http;
    
    const request = client.request(options, (response) => {
      let responseBody = '';
      
      response.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      response.on('end', () => {
        res.json({
          status: response.statusCode,
          headers: response.headers,
          body: responseBody
        });
      });
    });
    
    request.on('error', (error) => {
      console.error('Replay request error:', error);
      res.status(500).json({ error: 'Failed to replay request: ' + error.message });
    });
    
    // Send the request body if provided
    if (body) {
      request.write(body);
    }
    
    request.end();
    
  } catch (error) {
    console.error('Error replaying request:', error);
    res.status(500).json({ error: 'Failed to replay request: ' + error.message });
  }
});

// Chat message endpoints
router.get('/chat-messages', async (req, res) => {
  try {
    const messages = await database.getChatMessages();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

router.post('/chat-messages', async (req, res) => {
  try {
    const message = req.body;
    
    if (!message.id || !message.type || !message.content) {
      return res.status(400).json({ error: 'id, type, and content are required' });
    }
    
    await database.saveChatMessage(message);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ error: 'Failed to save chat message' });
  }
});

router.delete('/flush-db', async (req, res) => {
  try {
    await database.clearAllData();
    res.json({ success: true, message: 'All data cleared successfully' });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: 'Failed to clear database' });
  }
});

module.exports = router;