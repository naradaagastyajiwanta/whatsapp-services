const Queue = require('bull');
const sendMessagesHandler = require('../websocket/handlers/sendMessagesHandler');

const messageQueue = new Queue('messageQueue');

messageQueue.process(async (job, done) => {
    const { ws, accountId, projectId, data } = job.data;
    try {
        await sendMessagesHandler(ws, accountId, projectId, data);
        done();
    } catch (error) {
        console.error('Error processing job:', error);
        done(error);
    }
});

module.exports = messageQueue;