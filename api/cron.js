const { runCronJob } = require('../services/cron');

module.exports = async function handler(req, res) {
  // Optional: add a secret token check here so only Vercel can trigger this
  if (req.query.secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await runCronJob();
    res.status(200).json({ message: 'Cron job executed successfully' });
  } catch (err) {
    console.error('Vercel Cron Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
