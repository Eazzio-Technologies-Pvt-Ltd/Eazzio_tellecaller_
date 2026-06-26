const db = require('../config/database');

// Create a new campaign
exports.createCampaign = async (req, res) => {
  const { name, description } = req.body;
  const createdBy = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Campaign name is required.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO campaigns (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, 'pending', createdBy]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Server error creating campaign.' });
  }
};

// Get all campaigns with progress details
exports.listCampaigns = async (req, res) => {
  try {
    // Get campaigns and sub-select details
    const result = await db.query(`
      SELECT 
        c.*,
        COUNT(con.id) as total_contacts,
        COUNT(CASE WHEN con.status = 'connected' OR con.status = 'completed' THEN 1 END) as completed_contacts,
        COUNT(CASE WHEN con.status = 'pending' THEN 1 END) as pending_contacts,
        COUNT(CASE WHEN con.status = 'missed' THEN 1 END) as missed_contacts
      FROM campaigns c
      LEFT JOIN contacts con ON c.id = con.campaign_id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ error: 'Server error listing campaigns.' });
  }
};

// Update Campaign Status
exports.updateCampaignStatus = async (req, res) => {
  const { campaignId } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'active', 'paused', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid campaign status.' });
  }

  try {


    const result = await db.query(
      'UPDATE campaigns SET status = $1 WHERE id = $2 RETURNING *',
      [status, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update campaign status error:', error);
    res.status(500).json({ error: 'Server error updating campaign.' });
  }
};

// Upload Voice Broadcast Audio File removed

// Delete Campaign and all associated data
exports.deleteCampaign = async (req, res) => {
  const { campaignId } = req.params;

  try {
    const campaignResult = await db.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    // 1. Fetch associated contacts to delete their call logs first
    const contactsRes = await db.query('SELECT id FROM contacts WHERE campaign_id = $1', [campaignId]);
    const contactIds = contactsRes.rows.map(r => r.id);
    
    if (contactIds.length > 0) {
      // Delete call logs associated with these contacts
      const placeholders = contactIds.map((_, index) => `$${index + 1}`).join(',');
      await db.query(`DELETE FROM call_logs WHERE contact_id IN (${placeholders})`, contactIds);
      // Delete contacts
      await db.query('DELETE FROM contacts WHERE campaign_id = $1', [campaignId]);
    }

    // 3. Delete the campaign itself
    await db.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);

    res.json({ message: 'Campaign and all associated data deleted successfully.' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ error: 'Server error deleting campaign.' });
  }
};
