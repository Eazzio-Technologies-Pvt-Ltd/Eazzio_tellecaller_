const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const db = require('./config/database');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_eazzio_telecaller_system_2026';

// Tenant DB Selection Middleware
app.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  let companyRegNum = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.companyRegNum) {
        companyRegNum = decoded.companyRegNum;
      }
    } catch (err) {
      // Ignored: auth middleware handles token validation
    }
  }
  
  // Extract registration number from request body if available (e.g. login)
  if (!companyRegNum && req.body && req.body.companyRegNum) {
    companyRegNum = req.body.companyRegNum;
  }
  
  db.dbStorage.run({ companyRegNum }, () => {
    next();
  });
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const callLogRoutes = require('./routes/callLogRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const supportRoutes = require('./routes/supportRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/call-logs', callLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: db.dbType, time: new Date() });
});

// Background job to check and mark inactive telecallers as offline (due to network/app close)
async function checkOfflineTelecallers() {
  try {
    // 1. Fetch all companies from main database
    let companies = [];
    try {
      const companiesResult = await db.queryMain('SELECT reg_num FROM companies');
      companies = companiesResult.rows;
    } catch (dbErr) {
      // If table doesn't exist yet, ignore
    }

    const checkOfflineForTenant = async (regNum) => {
      const isPg = db.dbType === 'postgres';
      const checkSql = isPg
        ? `SELECT id, name FROM users WHERE role = 'telecaller' AND status != 'offline' AND last_active_at < NOW() - INTERVAL '35 seconds'`
        : `SELECT id, name FROM users WHERE role = 'telecaller' AND status != 'offline' AND last_active_at < datetime('now', '-35 seconds')`;
        
      const result = await db.query(checkSql);
      for (const row of result.rows) {
        console.log(`[StatusMonitor][${regNum || 'Main'}] Telecaller ${row.name} (ID: ${row.id}) inactive for >35s. Setting status to offline.`);
        
        // Update status to offline
        await db.query(
          'UPDATE users SET status = $1, last_active_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['offline', row.id]
        );
        
        // Insert notification
        await db.query(
          'INSERT INTO admin_notifications (message) VALUES ($1)',
          [`Telecaller ${row.name} went offline (connection lost)`]
        );
      }
    };

    // Run for main/default DB (regNum: null)
    await db.dbStorage.run({ companyRegNum: null }, async () => {
      await checkOfflineForTenant(null);
    });

    // Run for each company DB
    for (const company of companies) {
      await db.dbStorage.run({ companyRegNum: company.reg_num }, async () => {
        await checkOfflineForTenant(company.reg_num);
      });
    }
  } catch (err) {
    console.error('Error in checkOfflineTelecallers background job:', err);
  }
}

// Background job to clean up expired demo companies (5 minutes life duration)
async function cleanupDemoCompanies() {
  try {
    const isPg = db.dbType === 'postgres';
    const checkSql = isPg
      ? `SELECT reg_num FROM companies WHERE reg_num LIKE 'EAZ-DEMO-%' AND subscription_end < NOW()`
      : `SELECT reg_num FROM companies WHERE reg_num LIKE 'EAZ-DEMO-%' AND subscription_end < datetime('now')`;
      
    const result = await db.queryMain(checkSql);
    
    for (const row of result.rows) {
      const regNum = row.reg_num;
      console.log(`[DemoMonitor] Demo company ${regNum} expired. Initiating database cleanup.`);
      
      // 1. Close active cached database connection to release sqlite file lock
      db.closeCompanyConnection(regNum);
      
      // 2. Delete database file (for SQLite)
      if (db.dbType === 'sqlite') {
        const databasesDir = db.getDatabasesDir();
        const sqliteFile = path.join(databasesDir, `company_${regNum}.sqlite`);
        if (fs.existsSync(sqliteFile)) {
          try {
            fs.unlinkSync(sqliteFile);
            console.log(`[DemoMonitor] Deleted company database file: ${sqliteFile}`);
          } catch (err) {
            console.error(`[DemoMonitor] Failed to delete file ${sqliteFile}:`, err.message);
          }
        }
      } else {
        // For Postgres, drop schema
        try {
          const client = await db.pgPool.connect();
          try {
            await client.query(`DROP SCHEMA IF EXISTS "company_${regNum}" CASCADE`);
            console.log(`[DemoMonitor] Dropped Postgres schema company_${regNum}`);
          } finally {
            client.release();
          }
        } catch (pgErr) {
          console.error(`[DemoMonitor] Failed to drop schema company_${regNum}:`, pgErr.message);
        }
      }
      
      // 3. Delete company record from main database
      await db.queryMain('DELETE FROM companies WHERE reg_num = $1', [regNum]);
      console.log(`[DemoMonitor] Successfully deleted company ${regNum} record from master DB.`);
    }
  } catch (err) {
    console.error('Error in cleanupDemoCompanies background job:', err);
  }
}

// Initialize database schema and start server
db.initializeSchema()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`- Local address: http://localhost:${PORT}`);
      
      // Periodically check for disconnected/inactive telecallers (every 10 seconds)
      setInterval(checkOfflineTelecallers, 10000);
      
      // Periodically clean up expired demo companies (every 30 seconds)
      setInterval(cleanupDemoCompanies, 30000);
      
      // Get and print local network IP addresses
      let primaryIp = 'localhost';
      const interfaces = os.networkInterfaces();
      for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`- Network address: http://${iface.address}:${PORT}`);
            // Prefer typical local subnets (192.168.x.x, 10.x.x.x, 172.x.x.x)
            if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
              primaryIp = iface.address;
            }
          }
        }
      }

      // Auto-sync the IP address to the mobile app's assets/.env configuration
      try {
        const envPath = path.join(__dirname, '../mobile-app/assets/.env');
        if (fs.existsSync(envPath)) {
          fs.writeFileSync(envPath, `API_URL=http://${primaryIp}:${PORT}\n`);
          console.log(`- Auto-synced mobile app assets/.env to: http://${primaryIp}:${PORT}`);
        }
      } catch (err) {
        console.error('Failed to auto-sync mobile-app/assets/.env:', err.message);
      }
      
      console.log(`Audio attachments will be accessible at http://localhost:${PORT}/uploads/`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  });
