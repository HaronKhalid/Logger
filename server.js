const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logging.js'); // Import the main logger

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the web GUI static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const LOGS_DIR = path.join(__dirname, 'logs');

// Helper to get all .log files
async function getLogFiles() {
  try {
    const files = await fs.readdir(LOGS_DIR);
    return files.filter(f => f.endsWith('.log')).sort().reverse();
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(LOGS_DIR, { recursive: true });
      return [];
    }
    throw err;
  }
}

// API: Ingest logs from external sites/apps
app.post('/api/logs/ingest', (req, res) => {
  try {
    const { level = 'info', message, service = 'external-app', ...meta } = req.body;
    
    // Write incoming logs directly to our local files using winston
    logger.log({
      level: level.toLowerCase(),
      message: message || 'No message provided',
      service, // Tags it with the external site's name
      ...meta  // Any extra metadata they sent (IP, correlationId, etc.)
    });

    res.status(200).json({ success: true, message: 'Log ingested' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: List all log files
app.get('/api/logs', async (req, res) => {
  try {
    const files = await getLogFiles();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Read a specific log file
app.get('/api/logs/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security check: ensure only .log files in the logs directory can be read
    if (!filename.endsWith('.log') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }
    
    const filePath = path.join(LOGS_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse JSON lines from the file
    const logs = content.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          // Fallback if the line is not JSON
          return { message: line, level: 'unknown', timestamp: new Date().toISOString() };
        }
      });
      
    // Newest logs first
    res.json({ logs: logs.reverse() });
  } catch (err) {
    if (err.code === 'ENOENT') {
       return res.json({ logs: [] });
    }
    res.status(500).json({ error: err.message });
  }
});

// API: Clear a specific log file
app.delete('/api/logs/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename.endsWith('.log') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }
    
    const filePath = path.join(LOGS_DIR, filename);
    await fs.writeFile(filePath, ''); // Erase contents
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Clear all log files
app.delete('/api/logs', async (req, res) => {
  try {
    const files = await getLogFiles();
    for (const file of files) {
      await fs.writeFile(path.join(LOGS_DIR, file), '');
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 Aero Logs Web GUI running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`===========================================\n`);
});
