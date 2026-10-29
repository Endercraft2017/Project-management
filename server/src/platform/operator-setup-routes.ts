import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { activateInitialOperator } from './operator-setup';

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many setup attempts; wait before trying again' },
});
router.post('/setup', limiter, async (req, res) => {
  try {
    await activateInitialOperator(req.body); res.json({ success: true });
  } catch {
    // Never log request fields or distinguish email/code/expiry/DB failures.
    res.status(400).json({ success: false, message: 'Operator setup could not be completed. Check the details or contact your platform administrator.' });
  }
});
export default router;
