// config.js
module.exports = {
    WS_MAX_PAYLOAD: 50 * 1024 * 1024,
    RATE_LIMIT_WINDOW: 1000,
    RATE_LIMIT_MAX: 15,
    HEARTBEAT_INTERVAL: 300000,
    INITIAL_MESSAGE_TIMEOUT: 180000,
    INACTIVITY_TIMEOUT: 1800000,
    ACTION_TIMEOUTS: {
        initialize: 1200000,
        sendMessages: 1200000,
        checkStatus: 150000
    }
};