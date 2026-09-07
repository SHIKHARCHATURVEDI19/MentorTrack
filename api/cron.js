const { runCronJob } = require('../services/cron');

module.exports = async function handler(req, res) {
  // Support both Vercel Cron Authorization header and secret query param
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.query.secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    await runCronJob();
    res.status(200).json({ message: 'Cron job executed successfully' });
  } catch (err) {
    console.error('Vercel Cron Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
