-- ============================================================
-- Coach Loai — Leads Dashboard
-- Run this SQL in your Supabase SQL Editor (supabase.com → SQL)
-- ============================================================

-- 1. Create the leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  form_name TEXT NOT NULL DEFAULT 'Main Landing Page',

  -- Step 1-4: Qualification
  gender TEXT,
  looking_for TEXT,
  reason TEXT,
  coachability TEXT,

  -- Step 5: Contact Details
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  email TEXT NOT NULL,

  -- Step 6: Goals
  big_goal TEXT,
  importance INTEGER CHECK (importance BETWEEN 1 AND 5),

  -- Step 7: Readiness
  ready_for_coach TEXT,
  timeline TEXT[],
  willing_to_invest TEXT,

  -- Step 8: Source
  referral TEXT[],
  location TEXT,

  -- Campaign tracking (UTM params)
  utm_source TEXT,
  utm_campaign TEXT
);

-- 2. Indexes for fast filtering & sorting
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_form_name ON leads(form_name);
CREATE INDEX IF NOT EXISTS idx_leads_location ON leads(location);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- 3. Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to INSERT (form submissions from the public landing page)
CREATE POLICY "Anyone can submit leads"
  ON leads FOR INSERT
  WITH CHECK (true);

-- Allow anyone to SELECT (dashboard uses password gate for access control)
CREATE POLICY "Anyone can read leads"
  ON leads FOR SELECT
  USING (true);
