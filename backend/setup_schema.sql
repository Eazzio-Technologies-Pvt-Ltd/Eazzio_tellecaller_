-- =============================================================================
-- EAZZIO TELECALLER - FULL POSTGRESQL SCHEMA DEFINITION
-- =============================================================================
-- This script contains all raw SQL statements needed to initialize or restore
-- the Eazzio Telecaller database structure on Neon DB (PostgreSQL).
-- =============================================================================

-- =============================================================================
-- SECTION 1: PUBLIC SCHEMA (Master Configuration & Administration Tables)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS "public";
SET search_path TO "public";

-- 1. companies (Company registration metadata & limits configuration)
CREATE TABLE IF NOT EXISTS public.companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nature VARCHAR(100) NOT NULL,
    no_of_telecallers INTEGER DEFAULT 0,
    reg_num VARCHAR(50) UNIQUE NOT NULL,
    admin_email VARCHAR(100) UNIQUE NOT NULL,
    admin_password_hash VARCHAR(255) NOT NULL,
    admin_plain_password VARCHAR(255) NOT NULL,
    price_per_telecaller INTEGER DEFAULT 59,
    plan_type VARCHAR(20) DEFAULT 'monthly',
    subscription_start TIMESTAMP DEFAULT NULL,
    subscription_end TIMESTAMP DEFAULT NULL,
    edit_count INTEGER DEFAULT 0,
    mac_address VARCHAR(255),
    call_recording_enabled INTEGER DEFAULT 0,
    call_recording_end_date TIMESTAMP DEFAULT NULL,
    work_time_limit_hours INTEGER DEFAULT 8,
    talk_time_limit_hours INTEGER DEFAULT 4,
    proxy_limit_minutes INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. users (Platform Admins and Global users)
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'telecaller',
    status VARCHAR(20) DEFAULT 'offline',
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    plain_password VARCHAR(255),
    current_token TEXT,
    profile_photo TEXT DEFAULT NULL
);

-- 3. support_tickets (Customer issue reporting)
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id SERIAL PRIMARY KEY,
    company_reg_num VARCHAR(50) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    admin_email VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    image_url VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL
);

-- 4. password_resets (OTP requests tracker)
CREATE TABLE IF NOT EXISTS public.password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. contacts (Master contacts storage template/bulk imports schema)
CREATE TABLE IF NOT EXISTS public.contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    assigned_to INTEGER,
    added_by INTEGER,
    last_called_at TIMESTAMP,
    follow_up_date TIMESTAMP,
    follow_up_started_at TIMESTAMP,
    try_count INTEGER DEFAULT 0,
    last_try_date DATE DEFAULT NULL,
    response_1 TEXT,
    response_2 TEXT,
    response_3 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. payments (Razorpay transaction entries)
CREATE TABLE IF NOT EXISTS public.payments (
    id SERIAL PRIMARY KEY,
    company_reg_num VARCHAR(50) NOT NULL REFERENCES public.companies(reg_num) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(255),
    amount INTEGER NOT NULL,
    plan_type VARCHAR(20) NOT NULL,
    no_of_telecallers INTEGER NOT NULL,
    call_recording BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. call_recordings (Payment verified recording records)
CREATE TABLE IF NOT EXISTS public.call_recordings (
    id SERIAL PRIMARY KEY,
    company_reg_num VARCHAR(50) NOT NULL REFERENCES public.companies(reg_num) ON DELETE CASCADE,
    call_log_id INTEGER NOT NULL,
    recording_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- =============================================================================
-- SECTION 2: TENANT SCHEMA TEMPLATE (Provisioning Dynamic Company Data)
-- =============================================================================
-- The queries below represent the structures created dynamically inside each isolated
-- company schema (e.g. schema name: "company_EAZ-552057").
-- Run these statements within the respective tenant's search path.
--
-- EXAMPLE INSTRUCTIONS TO MANUALLY CREATE A NEW TENANT SCHEMA:
--   CREATE SCHEMA IF NOT EXISTS "company_EAZ-XXXXXX";
--   SET search_path TO "company_EAZ-XXXXXX";
--   [Execute table creation statements below...]
-- =============================================================================

-- Template schema helper placeholder (e.g., SET search_path TO "company_TEMPLATE")

-- 1. tenant users (Company Admins and Telecallers)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'telecaller',
    status VARCHAR(20) DEFAULT 'offline',
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    plain_password VARCHAR(255),
    current_token TEXT,
    profile_photo TEXT DEFAULT NULL
);

-- 2. campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. contacts (Tenant specific telecalling contacts)
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_called_at TIMESTAMP,
    follow_up_date TIMESTAMP,
    follow_up_started_at TIMESTAMP,
    try_count INTEGER DEFAULT 0,
    last_try_date DATE DEFAULT NULL,
    response_1 TEXT,
    response_2 TEXT,
    response_3 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. call_logs (Voice recording URLs and telecaller summaries)
CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    call_status VARCHAR(20) NOT NULL,
    duration INTEGER DEFAULT 0,
    feedback TEXT,
    recording_url TEXT,
    called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4b. call_recordings (Linked call recording files)
CREATE TABLE IF NOT EXISTS call_recordings (
    id SERIAL PRIMARY KEY,
    call_log_id INTEGER REFERENCES call_logs(id) ON DELETE CASCADE,
    recording_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 5. lead_transfers (Allotted or transferred contacts history)
CREATE TABLE IF NOT EXISTS lead_transfers (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. telecaller_sessions (Working times and WhatsApp metrics logs)
CREATE TABLE IF NOT EXISTS telecaller_sessions (
    id SERIAL PRIMARY KEY,
    telecaller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    total_working_time INTEGER DEFAULT 0,
    total_calling_time INTEGER DEFAULT 0,
    total_idle_time INTEGER DEFAULT 0,
    total_break_time INTEGER DEFAULT 0,
    whatsapp_messages_count INTEGER DEFAULT 0,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (telecaller_id, date)
);

-- 7. admin_notifications (Realtime logs shown to company admin)
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
