const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize, errors, metadata, label, json } = winston.format;

// 1. Custom Log Levels for precise control (Security, audit, http)
const customLevels = {
  levels: {
    error: 0,
    security: 1,
    audit: 2,
    warn: 3,
    info: 4,
    http: 5,
    debug: 6,
    trace: 7
  },
  colors: {
    error: 'red',
    security: 'redBG',
    audit: 'magenta',
    warn: 'yellow',
    info: 'green',
    http: 'cyan',
    debug: 'blue',
    trace: 'grey'
  }
};

winston.addColors(customLevels.colors);

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

// Filter for security/audit levels only
const securityFilter = winston.format((info) => {
  return (info.level === 'security' || info.level === 'audit') ? info : false;
});

// printf (custom) format - Full control over exact string format
const customPrint = printf((info) => {
  const { timestamp, level, message, module, stack, metadata, ...rest } = info;
  
  // Use module as label if provided
  const moduleLabel = module ? `[${module}] ` : (info.label ? `[${info.label}] ` : '');
  const stackTrace = stack ? `\n${stack}` : '';
  
  // Combine metadata into a string
  let metaObj = { ...rest };
  if (metadata && Object.keys(metadata).length > 0) {
    metaObj = { ...metaObj, ...metadata };
  }
  const metaStr = Object.keys(metaObj).length ? `\n    ${JSON.stringify(metaObj)}` : '';
  
  return `${timestamp} ${level}: ${moduleLabel}${message}${stackTrace}${metaStr}`;
});

// development Pretty / colorize (Human-readable, color-coded output in terminal)
const devFormat = combine(
  colorize({ all: true }),
  label({ label: 'app' }), // Tags logs with default module name
  errors({ stack: true }), // Captures full stack traces on Error objects
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS Z' }),
  customPrint
);

// production JSON format (Machine-readable, queryable by Elasticsearch, Loki, etc.)
const prodFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // required Timestamp (ISO 8601)
  metadata({ fillExcept: ['message', 'level', 'timestamp', 'label', 'module'] }), // Nests extra fields under meta
  json()
);

// Choose base format based on environment
const defaultFormat = isProd ? prodFormat : devFormat;

const transports = [
  // 1. Console always - Dev feedback, pretty format. 
  // Disable in production if needed by setting DISABLE_CONSOLE=true
  new winston.transports.Console({
    format: devFormat,
    silent: process.env.DISABLE_CONSOLE === 'true',
    handleExceptions: true,
    handleRejections: true
  }),

  // 2. combined.log always - Every log in one file. Audit trail and search baseline.
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    format: prodFormat,
    handleExceptions: true,
    handleRejections: true
  }),

  // 3. error.log required - Errors only. First place you check when something breaks.
  new DailyRotateFile({
    level: 'error',
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    format: prodFormat,
    handleExceptions: true,
    handleRejections: true
  }),

  // 4. security.log required - Security + audit levels only. Never rotated away — kept long-term.
  new DailyRotateFile({
    filename: 'logs/security-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '365d', 
    format: combine(
      securityFilter(),
      prodFormat
    )
  })
];

// 5. debug.log dev only - Debug + trace. Disable entirely in production to avoid noise.
if (!isProd) {
  transports.push(
    new DailyRotateFile({
      level: 'trace',
      filename: 'logs/debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      format: prodFormat,
    })
  );
}

// Create the main logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'trace'),
  format: defaultFormat,
  defaultMeta: { // recommended defaultMeta: service name, environment, version
    service: 'my-service',
    env: env,
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: transports,
  exitOnError: false,
  handleExceptions: true, // catches uncaught errors automatically
  handleRejections: true  // catches unhandled Promise rejections
});

module.exports = logger;

/*
=========================================================
USAGE PATTERNS & CONTEXTUAL METADATA OPTIONS
=========================================================
Consistent calling conventions make logs uniform and parseable.

// 1. Create a Child Logger per Module (scoped context per feature)
const authLogger = logger.child({ module: 'auth' });
const dbLogger = logger.child({ module: 'database' });

// 2. Contextual Metadata Options
// What you attach to every log entry determines how useful it is during an incident.
authLogger.info('User authenticated successfully', {
  // --- Required ---
  // correlationId: ties all logs from one operation together
  correlationId: '550e8400-e29b-41d4-a716-446655440000',
  
  // --- Recommended ---
  userId: 'user_12345',                                 // Who triggered this event
  ipAddress: '192.168.1.50',                            // For security/http logs
  
  // --- Optional Tracing ---
  requestId: 'req_9876',                                // Separate from correlation ID
  durationMs: 45                                        // Performance tracking
});

// 3. Exception Handling (always captures stack trace via errors({ stack: true }))
try {
  throw new Error('Database connection timeout');
} catch (error) {
  // Pass the error object directly so the format captures its stack trace
  dbLogger.error('Failed to query users', { error, correlationId: 'req-uuid' });
}

// 4. Security and Audit logs
authLogger.security('Suspicious login attempt detected', {
  userId: 'unknown',
  ipAddress: '10.0.0.99',
  action: 'login',
  reason: 'invalid_credentials'
});

authLogger.audit('Administrator changed system settings', {
  userId: 'admin_1',
  action: 'update_settings',
  target: 'password_policy'
});

// 5. HTTP Request Logging
authLogger.http('Incoming HTTP Request', {
  method: 'POST',
  path: '/api/v1/login',
  ipAddress: '127.0.0.1',
  durationMs: 12,
  requestId: 'req-111'
});
*/
