/**
 * check_neondb_data.js
 * 
 * Checks ALL data currently stored in NeonDB from the mobile app:
 * - Public schema: companies, users, support_tickets
 * - Per-company schemas: users, campaigns, contacts, call_logs,
 *   telecaller_sessions, admin_notifications, lead_transfers
 * 
 * Run: node check_neondb_data.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function sep(title) {
  const line = '─'.repeat(50);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${title.padEnd(48)}│`);
  console.log(`└${line}┘`);
}

async function countAndSample(client, schema, table, limit = 5) {
  try {
    await client.query(`SET search_path TO "${schema}"`);
    const countRes = await client.query(`SELECT COUNT(*) AS cnt FROM ${table}`);
    const total = parseInt(countRes.rows[0].cnt);
    
    let sample = [];
    if (total > 0) {
      const sampleRes = await client.query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT ${limit}`);
      sample = sampleRes.rows;
    }
    return { total, sample };
  } catch (err) {
    return { total: -1, error: err.message, sample: [] };
  }
}

function printTable(rows, maxCols = 6) {
  if (!rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]).slice(0, maxCols);
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').slice(0, 30).length)));
  
  const header = cols.map((c, i) => c.padEnd(widths[i])).join(' │ ');
  const divider = widths.map(w => '─'.repeat(w)).join('─┼─');
  console.log('  ' + header);
  console.log('  ' + divider);
  rows.forEach(row => {
    const line = cols.map((c, i) => String(row[c] ?? '').slice(0, 30).padEnd(widths[i])).join(' │ ');
    console.log('  ' + line);
  });
}

async function main() {
  const client = await pool.connect();
  
  try {
    // ── PUBLIC SCHEMA ──────────────────────────────────────────────────────
    sep('PUBLIC SCHEMA');
    await client.query('SET search_path TO "public"');

    // Companies
    const comps = await countAndSample(client, 'public', 'companies');
    console.log(`\n📦 companies — Total rows: ${comps.total}`);
    printTable(comps.sample.map(r => ({ id: r.id, name: r.name, reg_num: r.reg_num, admin_email: r.admin_email, plan: r.plan_type })));

    // Master users (superadmin)
    const masterUsers = await countAndSample(client, 'public', 'users');
    console.log(`\n👤 users (master) — Total rows: ${masterUsers.total}`);
    printTable(masterUsers.sample.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status })));

    // Support tickets
    const tickets = await countAndSample(client, 'public', 'support_tickets');
    console.log(`\n🎫 support_tickets — Total rows: ${tickets.total}`);
    printTable(tickets.sample.map(r => ({ id: r.id, company: r.company_reg_num, subject: r.subject, status: r.status })));

    // Password resets
    const pwdRes = await countAndSample(client, 'public', 'password_resets');
    console.log(`\n🔑 password_resets — Total rows: ${pwdRes.total}`);

    // ── TENANT SCHEMAS ─────────────────────────────────────────────────────
    await client.query('SET search_path TO "public"');
    const companiesRes = await client.query('SELECT reg_num, name FROM companies ORDER BY id');
    
    for (const company of companiesRes.rows) {
      const schema = `company_${company.reg_num}`;
      sep(`TENANT: ${company.name} (${schema})`);

      // Users
      const users = await countAndSample(client, schema, 'users', 10);
      console.log(`\n👥 users — Total: ${users.total}`);
      if (users.error) console.log(`   ⚠  ${users.error}`);
      printTable(users.sample.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, photo: r.profile_photo ? '✓' : '' })));

      // Campaigns
      const campaigns = await countAndSample(client, schema, 'campaigns');
      console.log(`\n📣 campaigns — Total: ${campaigns.total}`);
      if (campaigns.error) console.log(`   ⚠  ${campaigns.error}`);
      printTable(campaigns.sample.map(r => ({ id: r.id, name: r.name, status: r.status, created_at: String(r.created_at).slice(0,19) })));

      // Contacts
      const contacts = await countAndSample(client, schema, 'contacts', 8);
      console.log(`\n📞 contacts — Total: ${contacts.total}`);
      if (contacts.error) console.log(`   ⚠  ${contacts.error}`);
      printTable(contacts.sample.map(r => ({ id: r.id, name: r.name, phone: r.phone_number, status: r.status, assigned_to: r.assigned_to })));

      // Call logs
      const callLogs = await countAndSample(client, schema, 'call_logs', 8);
      console.log(`\n📋 call_logs — Total: ${callLogs.total}`);
      if (callLogs.error) console.log(`   ⚠  ${callLogs.error}`);
      printTable(callLogs.sample.map(r => ({ id: r.id, contact_id: r.contact_id, caller: r.telecaller_id, status: r.call_status, duration: r.duration, called_at: String(r.called_at).slice(0,19) })));

      // Telecaller sessions
      const sessions = await countAndSample(client, schema, 'telecaller_sessions', 8);
      console.log(`\n⏱  telecaller_sessions — Total: ${sessions.total}`);
      if (sessions.error) console.log(`   ⚠  ${sessions.error}`);
      printTable(sessions.sample.map(r => ({ id: r.id, telecaller_id: r.telecaller_id, date: r.date, work: r.total_working_time, talk: r.total_calling_time, break: r.total_break_time })));

      // Admin notifications
      const notifs = await countAndSample(client, schema, 'admin_notifications');
      console.log(`\n🔔 admin_notifications — Total: ${notifs.total}`);
      if (notifs.error) console.log(`   ⚠  ${notifs.error}`);
      printTable(notifs.sample.map(r => ({ id: r.id, message: r.message?.slice(0, 50), created_at: String(r.created_at).slice(0,19) })));

      // Lead transfers
      const transfers = await countAndSample(client, schema, 'lead_transfers');
      console.log(`\n🔁 lead_transfers — Total: ${transfers.total}`);
      if (transfers.error) console.log(`   ⚠  ${transfers.error}`);
      printTable(transfers.sample.map(r => ({ id: r.id, contact_id: r.contact_id, from: r.from_user_id, to: r.to_user_id, status: r.status })));
    }

    // ── SUMMARY ────────────────────────────────────────────────────────────
    sep('SUMMARY — Mobile App → NeonDB Data Flow');
    await client.query('SET search_path TO "public"');
    const companyCount = (await client.query('SELECT COUNT(*) AS c FROM companies')).rows[0].c;
    const masterUserCount = (await client.query('SELECT COUNT(*) AS c FROM users')).rows[0].c;
    console.log(`\n  Companies registered : ${companyCount}`);
    console.log(`  Master users         : ${masterUserCount}`);
    
    for (const company of companiesRes.rows) {
      const schema = `company_${company.reg_num}`;
      await client.query(`SET search_path TO "${schema}"`);
      const tc = async (t) => parseInt((await client.query(`SELECT COUNT(*) AS c FROM ${t}`)).rows[0].c);
      console.log(`\n  ── ${company.name} (${company.reg_num})`);
      console.log(`     users              : ${await tc('users')}`);
      console.log(`     campaigns          : ${await tc('campaigns')}`);
      console.log(`     contacts           : ${await tc('contacts')}`);
      console.log(`     call_logs          : ${await tc('call_logs')}`);
      console.log(`     telecaller_sessions: ${await tc('telecaller_sessions')}`);
      console.log(`     admin_notifications: ${await tc('admin_notifications')}`);
      console.log(`     lead_transfers     : ${await tc('lead_transfers')}`);
    }
    
    console.log('\n✅ NeonDB data check complete!\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
