# Aero Logs

Aero Logs is a premium, high-performance logging system and Web GUI built for modern Node.js applications. It leverages Winston for robust, daily-rotated file logging and provides an elegant Express-powered Web GUI to search, trace, and debug your application logs in real-time.

## Features

- **Advanced Winston Configuration**: Implements custom levels (Security, Audit, HTTP) alongside standard levels like Error, Info, and Debug.
- **Daily Log Rotation**: Automatically manages log retention periods (e.g., `combined.log` for 14 days, `security.log` for 365 days).
- **HTTP Ingestion API**: Acts as a centralized log server. Remote sites or apps written in any language can `POST` logs directly to the GUI.
- **Premium Web Dashboard**: A sleek, dark-themed UI to easily filter logs by level, trace specific request IDs across microservices, and erase log files cleanly.
- **Environment Aware**: Emits pretty, color-coded human-readable strings to the console in development, while strictly writing JSON payloads to disk for machine parsing.

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd aero-logs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### 1. Starting the GUI & Ingestion Server
To launch the Web GUI and start listening for external logs:

```bash
node server.js
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Using the Logger Locally (Node.js)
If you are running another Node app on the same machine, simply import the logger and use `.child()` to create scoped context:

```javascript
const logger = require('./logging');

// Create a child logger
const authLogger = logger.child({ module: 'auth-service' });

authLogger.info('User successfully authenticated', {
  userId: 'usr_123',
  correlationId: 'req_888'
});

authLogger.security('Failed login attempt', {
  ipAddress: '192.168.1.50'
});
```

### 3. Sending Logs Remotely (HTTP Ingestion)
Any external application (frontend or backend) can send logs to your dashboard using the `/api/logs/ingest` endpoint:

```javascript
fetch('http://localhost:3000/api/logs/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service: 'my-frontend-app',
    level: 'error',
    message: 'Failed to load user profile',
    userId: 'usr_456'
  })
});
```

## Technologies Used
- **Backend**: Node.js, Express, Winston, Winston-Daily-Rotate-File
- **Frontend**: Vanilla HTML, CSS (Variables, Flexbox/Grid), JavaScript

## License
[MIT License](LICENSE)

# Author 
Haroon Khalid