const { Queue } = require('bullmq');
const Redis = require('ioredis');

// We use the same Redis URL as the rate limiter
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

connection.on('error', (err) => {
  console.error('[BullMQ] Redis Connection Error:', err.message);
});

// Create the AI Verification Queue
const aiVerificationQueue = new Queue('ai-verification', { connection });

module.exports = {
  connection,
  aiVerificationQueue,
};
