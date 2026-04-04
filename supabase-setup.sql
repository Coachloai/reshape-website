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

-- ============================================================
-- 4. Appointment Types — Admin-defined appointment templates
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30,
  location TEXT NOT NULL DEFAULT 'Ipswich',
  weekdays INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  max_attendees INTEGER NOT NULL DEFAULT 1 CHECK (max_attendees BETWEEN 1 AND 150),
  availability_mode TEXT NOT NULL DEFAULT 'rolling',
  rolling_weeks INTEGER DEFAULT 4,
  range_start DATE,
  range_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read appointment types" ON appointment_types FOR SELECT USING (true);
CREATE POLICY "Anyone can insert appointment types" ON appointment_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update appointment types" ON appointment_types FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete appointment types" ON appointment_types FOR DELETE USING (true);

-- ============================================================
-- 5. Booking Slots — Auto-generated from appointment types
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  appointment_type_id UUID REFERENCES appointment_types(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL DEFAULT 'Ipswich',
  max_attendees INTEGER NOT NULL DEFAULT 1 CHECK (max_attendees BETWEEN 1 AND 150),
  booked_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_slots_date ON booking_slots(date);
CREATE INDEX IF NOT EXISTS idx_slots_location ON booking_slots(location);
CREATE INDEX IF NOT EXISTS idx_slots_active ON booking_slots(is_active);

ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active slots"
  ON booking_slots FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert slots"
  ON booking_slots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update slots"
  ON booking_slots FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete slots"
  ON booking_slots FOR DELETE
  USING (true);

-- ============================================================
-- 5. Bookings — Individual bookings by applicants
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slot_id UUID NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed'
);

CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read bookings"
  ON bookings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update bookings"
  ON bookings FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete bookings"
  ON bookings FOR DELETE
  USING (true);

-- ============================================================
-- 6. Message Queue — Automated nurture messages
-- ============================================================
CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_email TEXT NOT NULL,
  lead_phone TEXT,
  lead_name TEXT,
  sequence TEXT NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  error TEXT,
  external_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_mq_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_mq_send_at ON message_queue(send_at);
CREATE INDEX IF NOT EXISTS idx_mq_sequence ON message_queue(sequence);
CREATE INDEX IF NOT EXISTS idx_mq_email ON message_queue(lead_email);

ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mq_read" ON message_queue FOR SELECT USING (true);
CREATE POLICY "mq_insert" ON message_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "mq_update" ON message_queue FOR UPDATE USING (true);
CREATE POLICY "mq_delete" ON message_queue FOR DELETE USING (true);
GRANT ALL ON message_queue TO anon, authenticated, service_role;
