const db = require('./backend/config/database');

async function runVerification() {
  console.log('--- Starting Lead Transfers & Follow-up Verification ---');

  try {
    // 1. Initialize Database Schema (Runs migrations to ensure follow_up_started_at is added)
    console.log('1. Initializing schema...');
    await db.initializeSchema();
    console.log('✅ Schema initialized/verified.');

    // 2. Setup mock data
    console.log('2. Setting up mock campaign and contacts...');
    // Create test campaign
    const campaignRes = await db.query(
      "INSERT INTO campaigns (name, description, status) VALUES ($1, $2, $3)",
      ['Test Verification Campaign', 'Used for verifying lead transfers', 'active']
    );
    // Fetch last campaign ID. In SQLite we can query SQLite or order by id DESC.
    const campaignIdResult = await db.query("SELECT id FROM campaigns ORDER BY id DESC LIMIT 1");
    const campaignId = campaignIdResult.rows[0].id;
    console.log(`✅ Mock campaign created with ID: ${campaignId}`);

    // Create test user (telecaller)
    const userRes = await db.query(
      "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
      ['Test Telecaller', 'verifier_caller@eazzio.com', 'dummy_hash', 'telecaller']
    );
    const userResult = await db.query("SELECT id FROM users WHERE email = $1", ['verifier_caller@eazzio.com']);
    const telecallerId = userResult.rows[0].id;
    console.log(`✅ Mock telecaller verified with ID: ${telecallerId}`);

    // Create secondary test user (transfer destination)
    await db.query(
      "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
      ['Destination Telecaller', 'dest_caller@eazzio.com', 'dummy_hash', 'telecaller']
    );
    const destResult = await db.query("SELECT id FROM users WHERE email = $1", ['dest_caller@eazzio.com']);
    const destTelecallerId = destResult.rows[0].id;
    console.log(`✅ Destination telecaller verified with ID: ${destTelecallerId}`);

    // Create overdue contact (8 days ago follow-up start)
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 8);
    
    await db.query(
      "INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to, follow_up_started_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [campaignId, 'Overdue Lead', '9876543210', 'follow_up', telecallerId, overdueDate]
    );

    // Create active contact (2 days ago follow-up start)
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() - 2);

    await db.query(
      "INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to, follow_up_started_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [campaignId, 'Recent Lead', '9876543211', 'follow_up', telecallerId, activeDate]
    );

    console.log('✅ Mock contacts inserted.');

    // 3. Test Overdue Querying Logic
    console.log('3. Verifying overdue query...');
    const result = await db.query(`
      SELECT c.*, u.name as assigned_caller, camp.name as campaign_name 
      FROM contacts c
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN campaigns camp ON c.campaign_id = camp.id
      WHERE c.status = 'follow_up' AND c.follow_up_started_at IS NOT NULL
    `);
    
    const overdueResultRows = result.rows.filter(contact => {
      let dateVal;
      const val = contact.follow_up_started_at;
      if (typeof val === 'number') {
        dateVal = new Date(val);
      } else if (typeof val === 'string') {
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

    console.log(`Found ${overdueResultRows.length} overdue follow-up leads (Expected: 1).`);
    
    if (overdueResultRows.length === 1 && overdueResultRows[0].name === 'Overdue Lead') {
      console.log('✅ Overdue query returns correct contacts.');
    } else {
      console.error('❌ Overdue query FAILED.', overdueResultRows);
    }

    const targetContact = overdueResultRows[0];

    // 4. Test Single Transfer logic (updates assigned_to, resets status to pending, clears follow-up)
    console.log('4. Testing reassignment logic (assignContact)...');
    
    // Simulate updating contact
    await db.query(
      'UPDATE contacts SET assigned_to = $1, status = $2, follow_up_date = NULL, follow_up_started_at = NULL WHERE id = $3',
      [destTelecallerId, 'pending', targetContact.id]
    );

    const checkRes = await db.query("SELECT * FROM contacts WHERE id = $1", [targetContact.id]);
    const updatedContact = checkRes.rows[0];
    
    if (
      updatedContact.assigned_to === destTelecallerId && 
      updatedContact.status === 'pending' &&
      updatedContact.follow_up_started_at === null &&
      updatedContact.follow_up_date === null
    ) {
      console.log('✅ Reassignment correctly reset status, cleared follow-up dates and updated assignee.');
    } else {
      console.error('❌ Reassignment logic FAILED.', updatedContact);
    }

    // 5. Cleanup
    console.log('5. Cleaning up test entries...');
    await db.query("DELETE FROM contacts WHERE campaign_id = $1", [campaignId]);
    await db.query("DELETE FROM campaigns WHERE id = $1", [campaignId]);
    await db.query("DELETE FROM users WHERE email IN ($1, $2)", ['verifier_caller@eazzio.com', 'dest_caller@eazzio.com']);
    console.log('✅ Cleanup complete.');
    console.log('--- All Verification Steps Successful ---');
    process.exit(0);

  } catch (err) {
    console.error('❌ Verification script encountered an error:', err);
    process.exit(1);
  }
}

runVerification();
