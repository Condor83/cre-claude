-- CRE Appraisal Copilot - SQLite Schema
-- All tables for the MVP: documents, chunks, properties, sales, leases, reports

-- Source documents (the 100 archived reports)
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
  page_count INTEGER,
  report_number TEXT,
  report_date TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT
);

-- Smart chunks from PDFs
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_type TEXT NOT NULL CHECK(chunk_type IN ('clause', 'exemplar', 'evidence', 'table')),
  section_label TEXT,
  page_start INTEGER,
  page_end INTEGER,
  content TEXT NOT NULL,
  confidence REAL DEFAULT 1.0
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section_label);

-- Canonical property/parcel records
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL,
  address_normalized TEXT,
  city TEXT,
  state TEXT DEFAULT 'UT',
  zip TEXT,
  apn TEXT,
  property_type TEXT,
  year_built INTEGER,
  building_sf REAL,
  land_sf REAL,
  land_acres REAL,
  stories INTEGER,
  construction_class TEXT,
  quality TEXT,
  condition TEXT,
  zoning TEXT,
  latitude REAL,
  longitude REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_apn ON properties(apn) WHERE apn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_addr_norm ON properties(address_normalized);

-- Junction: which documents reference which properties, and in what role
CREATE TABLE IF NOT EXISTS document_properties (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('subject', 'comp_sale', 'comp_lease')),
  source_page INTEGER,
  confidence REAL DEFAULT 1.0,
  UNIQUE(document_id, property_id, role)
);
CREATE INDEX IF NOT EXISTS idx_docprops_document ON document_properties(document_id);
CREATE INDEX IF NOT EXISTS idx_docprops_property ON document_properties(property_id);
CREATE INDEX IF NOT EXISTS idx_docprops_role ON document_properties(role);

-- Sales events linked to properties
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  sale_date TEXT,
  sale_price REAL,
  price_per_sf REAL,
  cap_rate REAL,
  grantor TEXT,
  grantee TEXT,
  financing TEXT,
  verification_source TEXT,
  source_document_id INTEGER REFERENCES documents(id),
  source_page INTEGER,
  confidence REAL DEFAULT 1.0,
  mls_sourced BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sales_property ON sales(property_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);

-- Lease events linked to properties
CREATE TABLE IF NOT EXISTS leases (
  id INTEGER PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  tenant_name TEXT,
  lease_sf REAL,
  rent_per_sf REAL,
  lease_type TEXT,
  commencement_date TEXT,
  term_years REAL,
  escalations TEXT,
  office_pct REAL,
  source_document_id INTEGER REFERENCES documents(id),
  source_page INTEGER,
  confidence REAL DEFAULT 1.0,
  mls_sourced BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_leases_property ON leases(property_id);

-- Reports being authored
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  report_number TEXT,
  subject_property_id INTEGER REFERENCES properties(id),
  approach TEXT CHECK(approach IN ('sales_comparison', 'income_cap', 'both')),
  effective_date TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'final')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Report sections (editor state, per-section)
CREATE TABLE IF NOT EXISTS report_sections (
  id INTEGER PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  content_json TEXT,
  content_html TEXT,
  last_saved TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_id, section_key)
);
CREATE INDEX IF NOT EXISTS idx_sections_report ON report_sections(report_id);

-- Comp selections for a report
CREATE TABLE IF NOT EXISTS report_comps (
  id INTEGER PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  comp_type TEXT NOT NULL CHECK(comp_type IN ('sale', 'lease')),
  property_id INTEGER REFERENCES properties(id),
  sale_id INTEGER REFERENCES sales(id),
  lease_id INTEGER REFERENCES leases(id),
  rank INTEGER,
  adjustment_json TEXT,
  analysis_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_comps_report ON report_comps(report_id);
