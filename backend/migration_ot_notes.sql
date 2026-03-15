-- Migration: add notes + supervisor_notes columns to overtime_requests
-- Safe to run on any existing database (idempotent via IF NOT EXISTS)
ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS notes VARCHAR(500);
ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS supervisor_notes VARCHAR(500);
