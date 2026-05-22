import express from 'express';
import { sendTestEmail } from '../services/emailService.js';

const router = express.Router();

// POST /email/test { to }
router.post('/test', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Missing to address' });
  try {
    await sendTestEmail(to);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('sendTestEmail error', err);
    return res.status(500).json({ error: err.message || 'send failed' });
  }
});

export default router;
