const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// POST /api/support/tickets — Company admin submits a support ticket
router.post('/tickets', authMiddleware('admin'), async (req, res) => {
  const { subject, message } = req.body;
  const user = req.user;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  if (!user.companyRegNum) {
    return res.status(403).json({ error: 'Only company admins can submit support tickets.' });
  }

  try {
    // Fetch company name from the master database
    const companyRes = await db.queryMain(
      'SELECT name FROM companies WHERE reg_num = $1',
      [user.companyRegNum]
    );

    const companyName = companyRes.rows.length > 0 ? companyRes.rows[0].name : 'Unknown Company';

    await db.queryMain(
      `INSERT INTO support_tickets (company_reg_num, company_name, admin_email, subject, message, status)
       VALUES ($1, $2, $3, $4, $5, 'open')`,
      [user.companyRegNum, companyName, user.email, subject, message]
    );

    res.status(201).json({ message: 'Support ticket submitted successfully.' });
  } catch (err) {
    console.error('Submit ticket error:', err);
    res.status(500).json({ error: 'Failed to submit support ticket.' });
  }
});

// GET /api/support/tickets — Fetch tickets
// - Superadmin gets ALL tickets
// - Company admin gets only their own tickets
router.get('/tickets', authMiddleware('admin'), async (req, res) => {
  const user = req.user;
  const isSuperadmin = !user.companyRegNum || user.email === 'tellecaller111@eazzio.com';

  try {
    let result;
    if (isSuperadmin) {
      result = await db.queryMain(
        `SELECT * FROM support_tickets ORDER BY created_at DESC`
      );
    } else {
      result = await db.queryMain(
        `SELECT * FROM support_tickets WHERE company_reg_num = $1 ORDER BY created_at DESC`,
        [user.companyRegNum]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch tickets error:', err);
    res.status(500).json({ error: 'Failed to fetch support tickets.' });
  }
});

// GET /api/support/tickets/count — Open ticket count for superadmin badge
router.get('/tickets/count', authMiddleware('admin'), async (req, res) => {
  const user = req.user;
  const isSuperadmin = !user.companyRegNum || user.email === 'tellecaller111@eazzio.com';

  try {
    let result;
    if (isSuperadmin) {
      result = await db.queryMain(
        `SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'`
      );
    } else {
      result = await db.queryMain(
        `SELECT COUNT(*) as count FROM support_tickets WHERE company_reg_num = $1 AND status = 'open'`,
        [user.companyRegNum]
      );
    }
    const count = parseInt(result.rows[0].count) || 0;
    res.json({ count });
  } catch (err) {
    console.error('Ticket count error:', err);
    res.json({ count: 0 });
  }
});

// PUT /api/support/tickets/:id/resolve — Superadmin resolves a ticket
router.put('/tickets/:id/resolve', authMiddleware('admin'), async (req, res) => {
  const user = req.user;
  const isSuperadmin = !user.companyRegNum || user.email === 'tellecaller111@eazzio.com';

  if (!isSuperadmin) {
    return res.status(403).json({ error: 'Only superadmins can resolve tickets.' });
  }

  const { id } = req.params;

  try {
    const result = await db.queryMain(
      `UPDATE support_tickets SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    if (result.changes === 0 && result.rows && result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    res.json({ message: 'Ticket resolved successfully.' });
  } catch (err) {
    console.error('Resolve ticket error:', err);
    res.status(500).json({ error: 'Failed to resolve ticket.' });
  }
});

module.exports = router;
