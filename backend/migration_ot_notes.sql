-- Migration: add notes + supervisor_notes columns to overtime_requests
-- Safe to run on any existing database (idempotent via IF NOT EXISTS)
CREATE SCHEMA IF NOT EXISTS hris_ssb;
SET search_path TO hris_ssb, public;

ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS notes VARCHAR(500);
ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS supervisor_notes VARCHAR(500);
