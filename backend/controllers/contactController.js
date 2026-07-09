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
      // Normalize all keys to lowercase, trimming whitespace and stripping UTF-8 BOM if present
      const normalizedRow = {};
      for (const key of Object.keys(row)) {
        const cleanKey = key.trim().replace(/^\ufeff/, '').toLowerCase();
        normalizedRow[cleanKey] = row[key];
      }

      // Find name value using normalized keys and common synonyms
      const nameVal = normalizedRow['name'] || 
                      normalizedRow['full name'] || 
                      normalizedRow['fullname'] || 
                      normalizedRow['contact name'] || 
                      normalizedRow['customer name'] || 
                      normalizedRow['lead name'] || 
                      'Unknown';

      // Find phone value using normalized keys and common synonyms
      const phoneVal = normalizedRow['phone'] || 
                       normalizedRow['phone number'] || 
                       normalizedRow['phonenumber'] || 
                       normalizedRow['phone_number'] || 
                       normalizedRow['mobile'] || 
                       normalizedRow['mobile number'] || 
                       normalizedRow['mobilenumber'] || 
                       normalizedRow['mobile_number'] || 
                       normalizedRow['contact'] || 
                       normalizedRow['contact number'] || 
                       normalizedRow['contactnumber'] || 
                       normalizedRow['contact_number'] || 
                       normalizedRow['number'];

      if (phoneVal) {
        const cleanName = String(nameVal).trim() || 'Unknown';
        const cleanPhone = String(phoneVal).trim();
        if (cleanPhone) {
          contactsToInsert.push({ name: cleanName, phone: cleanPhone });
        }
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

    if (status === 'follow_up') {
      updateSql += ', follow_up_started_at = COALESCE(follow_up_started_at, CURRENT_TIMESTAMP)';
    } else {
      updateSql += ', follow_up_started_at = NULL';
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

    // Reset status to pending, clear follow_up_date and follow_up_started_at upon reassignment
    await db.query(
      'UPDATE contacts SET assigned_to = $1, status = $2, follow_up_date = NULL, follow_up_started_at = NULL WHERE id = $3',
      [assignedTo, 'pending', contactId]
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

// Get contacts that have been in follow up status for more than 7 days
exports.getFollowUpOverdueContacts = async (req, res) => {
  try {
    const sql = `
      SELECT c.*, u.name as assigned_caller, camp.name as campaign_name 
      FROM contacts c
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN campaigns camp ON c.campaign_id = camp.id
      WHERE c.status = 'follow_up' AND c.follow_up_started_at IS NOT NULL
      ORDER BY c.follow_up_started_at ASC
    `;
    const result = await db.query(sql);

    // Filter in JS for maximum compatibility between SQLite and PostgreSQL date representations
    const overdueContacts = result.rows.filter(contact => {
      let dateVal;
      const val = contact.follow_up_started_at;
      if (typeof val === 'number') {
        dateVal = new Date(val);
      } else if (typeof val === 'string' || val instanceof String) {
        if (!isNaN(val)) {
          dateVal = new Date(parseInt(val, 10));
        } else {
          let dateStr = val;
          if (!dateStr.includes('Z') && !dateStr.includes('T')) {
            if (dateStr.includes(' ') && dateStr.includes('-')) {
              dateStr = dateStr.replace(' ', 'T') + 'Z';
            }
          }
          dateVal = new Date(dateStr);
        }
      } else if (val instanceof Date) {
        dateVal = val;
      }

      if (!dateVal || isNaN(dateVal.getTime())) return false;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return dateVal <= oneWeekAgo;
    });

    res.json(overdueContacts);
  } catch (error) {
    console.error('Get overdue follow-up contacts error:', error);
    res.status(500).json({ error: 'Server error retrieving overdue follow-up contacts.' });
  }
};

// Bulk transfer specific contacts to another telecaller
exports.bulkTransferContacts = async (req, res) => {
  const { contactIds, telecallerId } = req.body;

  if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'Please specify contactIds as a non-empty array.' });
  }

  try {
    const assignedTo = (telecallerId && telecallerId !== 'null' && telecallerId !== '') 
        ? parseInt(telecallerId) 
        : null;

    const placeholders = contactIds.map((_, index) => `$${index + 2}`).join(', ');
    const sql = `UPDATE contacts SET assigned_to = $1, status = 'pending', follow_up_date = NULL, follow_up_started_at = NULL WHERE id IN (${placeholders})`;

    await db.query(sql, [assignedTo, ...contactIds]);

    res.json({ message: `Successfully transferred ${contactIds.length} contacts.` });
  } catch (error) {
    console.error('Bulk transfer contacts error:', error);
    res.status(500).json({ error: 'Server error bulk transferring contacts.' });
  }
};

// Add a single lead to a campaign with collision checking
exports.addLead = async (req, res) => {
  const { campaignId, name, phoneNumber } = req.body;
  const userId = req.user.id;

  if (!campaignId || !name || !phoneNumber) {
    return res.status(400).json({ error: 'Campaign ID, name, and phone number are required.' });
  }

  try {
    // Normalize phone number (strip non-digits)
    const cleanPhone = String(phoneNumber).replace(/\D/g, '');
    if (!cleanPhone) {
      return res.status(400).json({ error: 'A valid phone number is required.' });
    }

    // Verify campaign exists
    const campaignCheck = await db.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    // Search for duplicates in the same company context (routed via search_path automatically)
    // Querying with suffix match to optimize database indexing
    const searchSuffix = cleanPhone.length > 8 ? cleanPhone.slice(-8) : cleanPhone;
    const existingResult = await db.query(
      `SELECT c.*, u.name as telecaller_name 
       FROM contacts c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.phone_number LIKE $1`,
      [`%${searchSuffix}`]
    );

    const duplicate = existingResult.rows.find(row => {
      const dbPhoneClean = row.phone_number.replace(/\D/g, '');
      return dbPhoneClean.endsWith(cleanPhone) || cleanPhone.endsWith(dbPhoneClean);
    });

    if (duplicate) {
      const callerName = duplicate.telecaller_name || 'another telecaller';
      return res.status(409).json({
        error: 'already_exists',
        message: `This lead was already added by ${callerName}.`
      });
    }

    // Insert the new contact and assign to this telecaller
    const insertResult = await db.query(
      `INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [campaignId, name, phoneNumber, 'pending', userId]
    );

    res.status(201).json({
      success: true,
      message: 'Lead added successfully.',
      contact: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Add lead error:', error);
    res.status(500).json({ error: 'Server error adding lead.' });
  }
};
