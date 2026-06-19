-- CRM Core Schema (PostgreSQL)
-- Single database, shared modules for CRM, Sales, CallCRM, Marketing, Automation, Analytics.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_contact_status') THEN
    CREATE TYPE crm_contact_status AS ENUM ('Active', 'Inactive', 'Prospect', 'Customer', 'Supplier', 'Partner');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_company_status') THEN
    CREATE TYPE crm_company_status AS ENUM ('Active', 'Inactive', 'Prospect', 'Customer', 'Supplier', 'Partner');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_activity_type') THEN
    CREATE TYPE crm_activity_type AS ENUM ('Call', 'Email', 'Meeting', 'Visit', 'Task', 'Note');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_activity_status') THEN
    CREATE TYPE crm_activity_status AS ENUM ('Open', 'Completed', 'Cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_task_priority') THEN
    CREATE TYPE crm_task_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_task_status') THEN
    CREATE TYPE crm_task_status AS ENUM ('Open', 'In Progress', 'Completed', 'Cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_document_category') THEN
    CREATE TYPE crm_document_category AS ENUM ('Contracts', 'Invoices', 'Proposals', 'Images', 'Reports', 'Other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_entity_type') THEN
    CREATE TYPE crm_entity_type AS ENUM ('contact', 'company', 'activity', 'task', 'note', 'document');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  role             TEXT NOT NULL DEFAULT 'User',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS companies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  industry         TEXT,
  website          TEXT,
  email            TEXT,
  phone            TEXT,
  address          TEXT,
  city             TEXT,
  country          TEXT,
  postcode         TEXT,
  annual_revenue   NUMERIC(14, 2),
  employee_count   INTEGER,
  linkedin_url     TEXT,
  owner_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  status           crm_company_status NOT NULL DEFAULT 'Prospect',
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (name);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies (status);

CREATE TABLE IF NOT EXISTS contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       TEXT NOT NULL,
  last_name        TEXT,
  display_name     TEXT,
  job_title        TEXT,
  department       TEXT,
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  email            TEXT,
  mobile           TEXT,
  phone            TEXT,
  website          TEXT,
  address1         TEXT,
  address2         TEXT,
  city             TEXT,
  county           TEXT,
  country          TEXT,
  postcode         TEXT,
  linkedin_url     TEXT,
  owner_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  status           crm_contact_status NOT NULL DEFAULT 'Prospect',
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);

CREATE TABLE IF NOT EXISTS activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type             crm_activity_type NOT NULL,
  subject          TEXT,
  description      TEXT,
  date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  owner_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  status           crm_activity_status NOT NULL DEFAULT 'Open',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities (company_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities (date DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  priority         crm_task_priority NOT NULL DEFAULT 'Medium',
  due_date         TIMESTAMPTZ,
  start_date       TIMESTAMPTZ,
  status           crm_task_status NOT NULL DEFAULT 'Open',
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  reminder_date    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks (contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks (company_id);

CREATE TABLE IF NOT EXISTS notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT,
  content          TEXT NOT NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notes_contact ON notes (contact_id);
CREATE INDEX IF NOT EXISTS idx_notes_company ON notes (company_id);

CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         crm_document_category NOT NULL DEFAULT 'Other',
  description      TEXT,
  file_name        TEXT NOT NULL,
  file_size        BIGINT,
  mime_type        TEXT,
  version          INTEGER NOT NULL DEFAULT 1,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_documents_contact ON documents (contact_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents (company_id);

CREATE TABLE IF NOT EXISTS tags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  color            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS entity_tags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      crm_entity_type NOT NULL,
  entity_id        UUID NOT NULL,
  tag_id           UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_path        TEXT,
  file_url         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name       TEXT NOT NULL,
  record_id        UUID NOT NULL,
  action           TEXT NOT NULL,
  before_data      JSONB,
  after_data       JSONB,
  actor_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
