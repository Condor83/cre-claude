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

-- Smart chunks from PDFs (canonical, deduplicated by content_hash)
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  content_hash TEXT NOT NULL,
  chunk_type TEXT NOT NULL CHECK(chunk_type IN ('clause', 'exemplar', 'evidence', 'table')),
  section_label TEXT,
  content TEXT NOT NULL,
  confidence REAL DEFAULT 1.0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section_label);

-- Junction: which documents contain which chunks (M:N for deduplication)
CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  page_start INTEGER,
  page_end INTEGER,
  UNIQUE(document_id, chunk_id)
);
CREATE INDEX IF NOT EXISTS idx_dc_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_dc_chunk ON document_chunks(chunk_id);

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
  market_value REAL,
  county_data_json TEXT,
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
  approach TEXT,
  effective_date TEXT,
  client_name TEXT,
  intended_use TEXT DEFAULT 'estimate market value',
  property_rights TEXT DEFAULT 'fee simple',
  target_price_psf REAL,
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
  analysis_text TEXT,
  content_html TEXT,
  form_data TEXT
);
CREATE INDEX IF NOT EXISTS idx_comps_report ON report_comps(report_id);

-- Appraiser settings (key/value store for appraiser profile)
CREATE TABLE IF NOT EXISTS appraiser_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Market data store (population, employment, vacancy tables per market area)
CREATE TABLE IF NOT EXISTS market_data (
  id INTEGER PRIMARY KEY,
  market_area TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data_json TEXT NOT NULL,
  year INTEGER,
  source TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(market_area, data_type)
);
CREATE INDEX IF NOT EXISTS idx_market_data_area ON market_data(market_area);
CREATE INDEX IF NOT EXISTS idx_market_data_type ON market_data(data_type);

-- Section images (filesystem paths, not BLOBs)
CREATE TABLE IF NOT EXISTS section_images (
  id INTEGER PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  file_path TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_section_images_report ON section_images(report_id);
CREATE INDEX IF NOT EXISTS idx_section_images_key ON section_images(report_id, section_key);
