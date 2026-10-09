-- Famy MDRRMO DRRM Multi-Module Database Schema
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ir_number TEXT UNIQUE NOT NULL,
    date_time DATETIME NOT NULL,
    nature TEXT NOT NULL,
    place TEXT NOT NULL,
    landmark TEXT,
    severity TEXT NOT NULL,
    gis_latitude REAL,
    gis_longitude REAL,
    patients_json TEXT NOT NULL,
    photos_json TEXT,
    responders_json TEXT,
    command_personnel_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_master_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL, -- 'responder', 'operator', 'incident_type', 'hospital'
    item_value TEXT NOT NULL
);