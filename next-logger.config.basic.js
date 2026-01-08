/** @type {import('pino')} */
const pino = require('pino');

// https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
const levelToSeverity = {
  10: 'DEBUG',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARNING',
  50: 'ERROR',
  60: 'CRITICAL',
};

/** @type {import('pino').LoggerOptions} */
const logger = (defaultConfig) =>
  pino({
    ...defaultConfig,
    formatters: {
      level(_, number) {
        return { severity: levelToSeverity[number] };
      },
    },
  });

module.exports = {
  logger,
};
