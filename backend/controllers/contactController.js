const fs = require('fs');
const csv = require('csv-parser');
const db = require('../config/database');

// Import contacts from CSV file
exports.importContacts = async (req, res) => {
  const { campaignId, assignedToUserId, allotmentType, selectedTelecallerIds } = req.body;

  if (!campaignId) {
    return res.status(400).json({ error: 'Please specify a campaignId.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a CSV file.' });
  }

  const contactsToInsert = [];
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      // Expect columns: Name, Phone (or Phone Number)
      const name = row.Name || row.name || row.Name || 'Unknown';
      const phone = row.Phone || row.phone || row['Phone Number'] || row['phone_number'];
      
      if (phone) {
        contactsToInsert.push({ name, phone });
      }
    })
    .on('end', async () => {
      try {
        // Delete uploaded file after parsing
        fs.unlinkSync(req.file.path);

        if (contactsToInsert.length === 0) {
          return res.status(400).json({ error: 'No valid contacts found in the CSV.' });
        }

        const assignTo = (allotmentType === 'single' && assignedToUserId && assignedToUserId !== 'null' && assignedToUserId !== '') 
            ? parseInt(assignedToUserId) 
            : null;

        // Insert into DB
        for (const contact of contactsToInsert) {
          await db.query(
            'INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to) VALUES ($1, $2, $3, $4, $5)',
            [campaignId, contact.name, contact.phone, 'pending', assignTo]
          );
        }

        // Handle allotment
        if (allotmentType === 'selected') {
          let targetTelecallerIds = [];
          if (selectedTelecallerIds) {
            try {
              if (typeof selectedTelecallerIds === 'string') {
                targetTelecallerIds = JSON.parse(selectedTelecallerIds);
              } else {
                targetTelecallerIds = selectedTelecallerIds;
              }
            } catch (e) {
              if (typeof selectedTelecallerIds === 'string') {
                targetTelecallerIds = selectedTelecallerIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
              }
            }
          }
          await allotCampaignContactsToSubgroup(campaignId, targetTelecallerIds);
        } else if (allotmentType === 'single' && assignTo) {
          // Already assigned in insert loop
        } else {
          // Default: split equally among all
          await autoAllotCampaignContacts(campaignId);
        }

        res.json({ 
          message: `Successfully imported ${contactsToInsert.length} contacts.` 
        });
      } catch (error) {
        console.error('Error saving contacts:', error);
        res.status(500).json({ error: 'Database error importing contacts.' });
      }
    })
    .on('error', (err) => {
      console.error('CSV Parsing Error:', err);
      res.status(500).json({ error: 'Error parsing the CSV file.' });
    });
};

// Automatic allotment logic
const autoAllotCampaignContacts = async (campaignId) => {
  // 1. Get all active telecallers
  const telecallersResult = await db.query(
    "SELECT id FROM users WHERE role = 'telecaller'"
  );
  const telecallers = telecallersResult.rows;
  if (telecallers.length === 0) {
    console.log('No telecallers registered to allot contacts to.');
    return;
  }

  // 2. Get unassigned contacts in this campaign
  const unassignedResult = await db.query(
    "SELECT id FROM contacts WHERE campaign_id = $1 AND assigned_to IS NULL",
    [campaignId]
  );
  const contacts = unassignedResult.rows;
  if (contacts.length === 0) {
    console.log('No unassigned contacts to allot.');
    return;
  }

  // 3. Evenly distribute contacts
  let callerIndex = 0;
  for (const contact of contacts) {
    const telecallerId = telecallers[callerIndex].id;
    await db.query(
      'UPDATE contacts SET assigned_to = $1 WHERE id = $2',
      [telecallerId, contact.id]
    );
    callerIndex = (callerIndex + 1) % telecallers.length;
  }

  console.log(`Auto-allotted ${contacts.length} contacts to ${telecallers.length} telecallers.`);
};

// Allot campaign contacts to a custom subgroup of telecallers
const allotCampaignContactsToSubgroup = async (campaignId, telecallerIds) => {
  if (!telecallerIds || telecallerIds.length === 0) {
    return;
  }
  // Get unassigned contacts in this campaign
  const unassignedResult = await db.query(
    "SELECT id FROM contacts WHERE campaign_id = $1 AND assigned_to IS NULL",
    [campaignId]
  );
  const contacts = unassignedResult.rows;
  if (contacts.length === 0) {
    return;
  }

  let callerIndex = 0;
  for (const contact of contacts) {
    const telecallerId = parseInt(telecallerIds[callerIndex]);
    await db.query(
      'UPDATE contacts SET assigned_to = $1 WHERE id = $2',
      [telecallerId, contact.id]
    );
    callerIndex = (callerIndex + 1) % telecallerIds.length;
  }
  console.log(`Subgroup-allotted ${contacts.length} contacts to ${telecallerIds.length} telecallers.`);
};

// Trigger manual allotment for all unassigned contacts
exports.allotContactsManually = async (req, res) => {
  const { campaignId } = req.body;
  try {
    await autoAllotCampaignContacts(campaignId);
    res.json({ message: 'Auto-allotment completed successfully.' });
  } catch (error) {
    console.error('Allotment error:', error);
    res.status(500).json({ error: 'Failed to allot contacts.' });
  }
};

// Fetch contacts allotted to the logged-in telecaller
exports.getAllottedContacts = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT c.*, camp.name as campaign_name 
       FROM contacts c
       JOIN campaigns camp ON c.campaign_id = camp.id
       WHERE c.assigned_to = $1 
         AND c.status IN ('pending', 'calling', 'follow_up') 
       ORDER BY c.status DESC, c.follow_up_date ASC, c.id ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get allotted contacts error:', error);
    res.status(500).json({ error: 'Server error retrieving contacts.' });
  }
};

// Get all contacts with filters for Admin Dashboard
exports.getContacts = async (req, res) => {
  const { campaignId, status, search } = req.query;
  let sql = `
    SELECT c.*, u.name as assigned_caller, camp.name as campaign_name 
    FROM contacts c
    LEFT JOIN users u ON c.assigned_to = u.id
    LEFT JOIN campaigns camp ON c.campaign_id = camp.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (campaignId) {
    sql += ` AND c.campaign_id = $${paramIndex}`;
    params.push(campaignId);
    paramIndex++;
  }

  if (status) {
    sql += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (search) {
    sql += ` AND (c.name LIKE $${paramIndex} OR c.phone_number LIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  sql += ' ORDER BY c.id DESC LIMIT 1000';

  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Server error fetching contacts.' });
  }
};

// Update contact status
exports.updateContactStatus = async (req, res) => {
  const { contactId } = req.params;
  const { status, followUpDate } = req.body;

  try {
    let updateSql = 'UPDATE contacts SET status = $1';
    const params = [status];
    let paramIndex = 2;

    if (followUpDate) {
      updateSql += `, follow_up_date = $${paramIndex}`;
      params.push(new Date(followUpDate));
      paramIndex++;
    }

    updateSql += `, last_called_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`;
    params.push(contactId);

    await db.query(updateSql, params);
    res.json({ message: 'Contact status updated successfully.' });
  } catch (error) {
    console.error('Update contact status error:', error);
    res.status(500).json({ error: 'Server error updating contact.' });
  }
};

// Manually assign single contact to telecaller
exports.assignContact = async (req, res) => {
  const { contactId } = req.params;
  const { telecallerId } = req.body;

  try {
    const contactResult = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    const assignedTo = (telecallerId && telecallerId !== 'null' && telecallerId !== '') 
        ? parseInt(telecallerId) 
        : null;

    await db.query(
      'UPDATE contacts SET assigned_to = $1 WHERE id = $2',
      [assignedTo, contactId]
    );

    res.json({ message: 'Contact assigned successfully.' });
  } catch (error) {
    console.error('Assign contact error:', error);
    res.status(500).json({ error: 'Server error assigning contact.' });
  }
};

// Bulk assign campaign contacts to a telecaller
exports.assignCampaignContacts = async (req, res) => {
  const { campaignId, telecallerId } = req.body;

  if (!campaignId) {
    return res.status(400).json({ error: 'Please specify a campaignId.' });
  }

  try {
    const assignedTo = (telecallerId && telecallerId !== 'null' && telecallerId !== '') 
        ? parseInt(telecallerId) 
        : null;

    await db.query(
      'UPDATE contacts SET assigned_to = $1 WHERE campaign_id = $2',
      [assignedTo, campaignId]
    );

    res.json({ message: 'Campaign contacts reassigned successfully.' });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ error: 'Failed to assign campaign contacts.' });
  }
};
