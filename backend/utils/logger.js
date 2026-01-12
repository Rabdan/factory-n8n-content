const fs = require('fs');
const path = require('path');

const logDir = path.resolve(__dirname, '..', 'data', 'log');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);

    // Console output
    console.log(logMessage.trim());

    // File output
    fs.appendFileSync(logFile, logMessage);
}

module.exports = {
    log,
    info: (msg) => log(msg, 'INFO'),
    error: (msg) => log(msg, 'ERROR'),
    warn: (msg) => log(msg, 'WARN')
};
